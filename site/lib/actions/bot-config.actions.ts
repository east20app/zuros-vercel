"use server";
import { revalidatePath } from "next/cache";
import databases from "@root/src/databases";
import { checkRateLimit } from "@root/src/functions/rate-limit";
import { ActionError, requireSessionUser } from "./context";
import { BOT_CONFIG_MODULES, isBotConfigModule, type BotConfigModule } from "@/lib/bot-config-modules";
import { botConfigSchemas } from "@/lib/bot-config-schemas";
import { getBotDocument, saveBotDocument, startBotConfigSyncWatcher } from "@/lib/drox-bot-config";
import { droxDefaultFor } from "@/lib/drox-defaults";

function sanitizedTechnicalCause(error: unknown) {
    if (!(error instanceof Error)) return { type: typeof error };
    const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
    const message = error.message
        .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, "[MONGODB_URI_REDACTED]")
        .replace(/(?:password|passwd|pwd|token|secret|uri)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]");
    return { name: error.name, code, message };
}

function logDroxFailure(operation: "read" | "write", moduleName: BotConfigModule, error: unknown) {
    console.error("[DROX_CONFIG] Falha técnica sanitizada", { operation, module: moduleName, cause: sanitizedTechnicalCause(error) });
}

async function ownedActiveApplication(appId: string) {
    const discordId = await requireSessionUser();
    const identifier = /^[a-f\d]{24}$/i.test(appId) ? { $or: [{ _id: appId }, { botId: appId }, { appId }] } : { botId: appId };
    const application = await databases.applications.findOne({ ...identifier, ownerId: discordId }, { botId: 1, status: 1, token: 1, serverId: 1 }).lean().catch(() => null);
    if (!application) throw new ActionError("Aplicação não encontrada ou sem permissão.");
    if (application.status !== "active") throw new ActionError("Esta aplicação não está ativa. Reative-a para editar as configurações.");
    if (!application.botId) throw new ActionError("Esta aplicação ainda não possui um bot vinculado.");
    return { appId: String(application._id), discordId, botId: application.botId, token: String(application.token || ""), serverId: String(application.serverId || "") };
}
function moduleOrThrow(module: string): BotConfigModule { if (!isBotConfigModule(module)) throw new ActionError("Módulo de configuração inválido."); return module; }

export async function getBotConfig(appId: string, modulo: string): Promise<Record<string, Record<string, unknown>>> {
    const moduleName = moduleOrThrow(modulo); const { botId } = await ownedActiveApplication(appId); const mapping = BOT_CONFIG_MODULES[moduleName] as Record<string, string>;
    if (!process.env.VERCEL) startBotConfigSyncWatcher();
    try { return Object.fromEntries(await Promise.all(Object.entries(mapping).map(async ([alias, docId]) => {
        const document = (await getBotDocument(botId, docId)) || droxDefaultFor(docId);
        if (docId !== "cloud_data" || !document || typeof document !== "object" || Array.isArray(document)) return [alias, document];
        const cloud = structuredClone(document) as Record<string, unknown>;
        const auth = cloud.zuros_auth && typeof cloud.zuros_auth === "object" && !Array.isArray(cloud.zuros_auth) ? cloud.zuros_auth as Record<string, unknown> : {};
        cloud.zuros_auth = { ...auth, bot_credential: "", credential_configured: Boolean(auth.bot_credential) };
        delete cloud.client_secret; delete cloud.bot_token; delete cloud.token;
        return [alias, cloud];
    }))); }
    catch (error) { logDroxFailure("read", moduleName, error); throw new ActionError("Não foi possível acessar as configurações do DROX agora."); }
}
export type BotConfigOverview = Record<BotConfigModule, { available: boolean; active: number; total: number }>;

function countBooleanFlags(value: unknown): { active: number; total: number } {
    if (typeof value === "boolean") return { active: value ? 1 : 0, total: 1 };
    if (!value || typeof value !== "object") return { active: 0, total: 0 };
    const children = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
    return children.reduce((sum, child) => {
        const next = countBooleanFlags(child);
        return { active: sum.active + next.active, total: sum.total + next.total };
    }, { active: 0, total: 0 });
}

/** Carrega o resumo de todos os módulos em uma única Server Action autenticada. */
export async function getBotConfigOverview(appId: string): Promise<BotConfigOverview> {
    const { botId } = await ownedActiveApplication(appId);
    const modules = Object.entries(BOT_CONFIG_MODULES) as Array<[BotConfigModule, Record<string, string>]>;
    const rows = await Promise.all(modules.map(async ([moduleName, mapping]) => {
        try {
            const documents = await Promise.all(Object.values(mapping).map(async (docId) =>
                (await getBotDocument(botId, docId)) || droxDefaultFor(docId)
            ));
            const counts = countBooleanFlags(documents);
            return [moduleName, { available: true, ...counts }] as const;
        } catch (error) {
            logDroxFailure("read", moduleName, error);
            return [moduleName, { available: false, active: 0, total: 0 }] as const;
        }
    }));
    return Object.fromEntries(rows) as BotConfigOverview;
}
export async function saveBotConfig(appId: string, modulo: string, data: Record<string, unknown>): Promise<{ ok: true; synced: boolean; warning?: string }> {
    const moduleName = moduleOrThrow(modulo); const { discordId, botId } = await ownedActiveApplication(appId);
    if (!process.env.VERCEL) startBotConfigSyncWatcher();
    if (!checkRateLimit(`site:bot-config:${discordId}:${appId}`, { windowMs: 60_000, maxRequests: 20 })) throw new ActionError("Muitas alterações em sequência. Aguarde alguns instantes.");
    const parsed = botConfigSchemas[moduleName].safeParse(data); if (!parsed.success) throw new ActionError("Os dados enviados são inválidos para este módulo.");
    const mapping = BOT_CONFIG_MODULES[moduleName] as Record<string, string>;
    try { await Promise.all(Object.entries(mapping).map(async ([alias, docId]) => {
        if (moduleName === "cloud" && alias === "tasks") return; // Histórico somente leitura; o worker do bot é o único escritor.
        let nextDocument = parsed.data[alias] ?? droxDefaultFor(docId);
        if (docId === "cloud_data") {
            const existing = await getBotDocument(botId, docId) || {};
            const existingAuth = existing.zuros_auth && typeof existing.zuros_auth === "object" && !Array.isArray(existing.zuros_auth) ? existing.zuros_auth as Record<string, unknown> : {};
            const incomingAuth = nextDocument.zuros_auth && typeof nextDocument.zuros_auth === "object" && !Array.isArray(nextDocument.zuros_auth) ? nextDocument.zuros_auth as Record<string, unknown> : {};
            const credential = String(incomingAuth.bot_credential || "").trim() || String(existingAuth.bot_credential || "");
            nextDocument = { ...existing, ...nextDocument, zuros_auth: { ...existingAuth, ...incomingAuth, bot_credential: credential } };
            delete (nextDocument.zuros_auth as Record<string, unknown>).credential_configured;
        }
        await saveBotDocument(botId, docId, nextDocument);
    })); }
    catch (error) { logDroxFailure("write", moduleName, error); throw new ActionError("Não foi possível salvar no DROX. Tente novamente em instantes."); }
    revalidatePath(`/dashboard/${appId}/config`); revalidatePath(`/dashboard/${appId}/config/${moduleName}`);
    // O watcher do bot invalida o cache por Change Stream ou polling em até 4s.
    return { ok: true, synced: true };
}
export async function getBotConfigStatus(appId: string): Promise<{ online: boolean }> {
    try { await getBotConfig(appId, "customizacao"); return { online: true }; } catch { return { online: false }; }
}

export async function publishDroxProduct(appId: string, productId: string, channelId: string): Promise<{ ok: true; messageId: string }> {
    const { discordId, botId, token, serverId } = await ownedActiveApplication(appId);
    if (!checkRateLimit(`site:product-publish:${discordId}:${appId}`, { windowMs: 60_000, maxRequests: 10 })) throw new ActionError("Muitos envios em sequência. Aguarde alguns instantes.");
    if (!token || !serverId) throw new ActionError("Configure o token e o servidor principal antes de publicar.");
    const [channelResponse, rawProducts] = await Promise.all([
        fetch(`https://discord.com/api/v10/channels/${channelId}`, { headers: { Authorization: `Bot ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) }).catch(() => null),
        getBotDocument(botId, "loja_products"),
    ]);
    if (!channelResponse?.ok) throw new ActionError("Canal não encontrado ou sem acesso para o bot.");
    const channel = await channelResponse.json() as { guild_id?: string; type?: number };
    if (String(channel.guild_id || "") !== serverId || ![0, 5].includes(Number(channel.type))) throw new ActionError("Escolha um canal de texto do servidor principal.");
    const products = rawProducts && typeof rawProducts === "object" && !Array.isArray(rawProducts) ? rawProducts as Record<string, unknown> : {};
    const product = products[productId] && typeof products[productId] === "object" ? products[productId] as Record<string, unknown> : null;
    if (!product) throw new ActionError("Produto não encontrado.");
    const info = product.info && typeof product.info === "object" ? product.info as Record<string, unknown> : {};
    const fields = product.campos && typeof product.campos === "object" ? Object.values(product.campos as Record<string, unknown>) : [];
    const prices = fields.map((field) => Number(field && typeof field === "object" ? (field as Record<string, unknown>).price : NaN)).filter(Number.isFinite);
    const format = (price: number) => price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const priceText = prices.length ? (Math.min(...prices) === Math.max(...prices) ? format(Math.min(...prices)) : `${format(Math.min(...prices))} - ${format(Math.max(...prices))}`) : "Consulte as opções";
    const rawColor = String(info.hex_color || "#7c3aed").replace("#", "");
    const color = /^[0-9a-f]{6}$/i.test(rawColor) ? Number.parseInt(rawColor, 16) : 0x7c3aed;
    const embed: Record<string, unknown> = {
        title: String(product.name || "Produto"),
        description: String(info.description || "Produto disponível para compra"),
        color,
        fields: [{ name: "💰 Preço", value: `\`${priceText}\``, inline: true }],
    };
    const banner = String(info.banner || "").trim();
    if (/^https:\/\//i.test(banner)) embed.image = { url: banner };
    const buyButton = info.buy_button && typeof info.buy_button === "object" ? info.buy_button as Record<string, unknown> : {};
    const payload = { embeds: [embed], components: [{ type: 1, components: [{ type: 2, style: 2, label: String(buyButton.label || "Comprar").slice(0, 80), custom_id: `buy_product:${productId}` }] }] };
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, { method: "POST", headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (!response?.ok) throw new ActionError("O Discord recusou a publicação. Verifique a permissão Enviar mensagens e Incorporar links.");
    const message = await response.json() as { id?: string };
    const messages = Array.isArray(product.messages) ? product.messages : [];
    products[productId] = { ...product, messages: [...messages, { message_id: String(message.id || ""), channel_id: channelId, guild_id: serverId, mode: "legacy", formatted_desc: true, image_size: "large", created_at: Math.floor(Date.now() / 1000) }] };
    await saveBotDocument(botId, "loja_products", products);
    revalidatePath(`/dashboard/${appId}/vendas/produtos`);
    return { ok: true, messageId: String(message.id || "") };
}
export type DiscordGuildRole = { id: string; name: string; color: number; position: number; managed: boolean };
export type DiscordGuildChannel = { id: string; name: string; type: number; position: number; parentId: string | null; guildId: string };

export async function getBotGuildResources(appId: string): Promise<{ roles: DiscordGuildRole[]; channels: DiscordGuildChannel[] }> {
    const { token, serverId } = await ownedActiveApplication(appId);
    if (!token || !serverId) return { roles: [], channels: [] };
    const headers = { Authorization: `Bot ${token}` };
    const [rolesResponse, channelsResponse] = await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${serverId}/roles`, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) }).catch(() => null),
        fetch(`https://discord.com/api/v10/guilds/${serverId}/channels`, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) }).catch(() => null),
    ]);
    if (!rolesResponse?.ok || !channelsResponse?.ok) throw new ActionError("Não foi possível consultar os cargos e canais do servidor.");
    const [rawRoles, rawChannels] = await Promise.all([rolesResponse.json(), channelsResponse.json()]) as [Array<Partial<DiscordGuildRole>>, Array<{ id?: string; name?: string; type?: number; position?: number; parent_id?: string | null }>];
    if (!Array.isArray(rawRoles) || !Array.isArray(rawChannels)) throw new ActionError("O Discord retornou recursos inválidos.");
    const roles = rawRoles.filter((role) => role.id && role.name && role.name !== "@everyone")
        .map((role) => ({ id: String(role.id), name: String(role.name), color: Number(role.color || 0), position: Number(role.position || 0), managed: Boolean(role.managed) }))
        .sort((a, b) => b.position - a.position);
    const channels = rawChannels.filter((channel) => channel.id && channel.name)
        .map((channel) => ({ id: String(channel.id), name: String(channel.name), type: Number(channel.type || 0), position: Number(channel.position || 0), parentId: channel.parent_id ? String(channel.parent_id) : null, guildId: serverId }))
        .sort((a, b) => a.position - b.position);
    return { roles, channels };
}
export async function getBotGuildRoles(appId: string): Promise<DiscordGuildRole[]> {
    const { token, serverId } = await ownedActiveApplication(appId);
    if (!token || !serverId) return [];
    const response = await fetch(`https://discord.com/api/v10/guilds/${serverId}/roles`, {
        headers: { Authorization: `Bot ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (!response?.ok) throw new ActionError("Não foi possível consultar os cargos. Verifique o servidor principal e as permissões do bot.");
    const roles = await response.json() as Array<Partial<DiscordGuildRole>>;
    if (!Array.isArray(roles)) throw new ActionError("O Discord retornou uma lista de cargos inválida.");
    return roles.filter((role) => role.id && role.name && role.name !== "@everyone")
        .map((role) => ({ id: String(role.id), name: String(role.name), color: Number(role.color || 0), position: Number(role.position || 0), managed: Boolean(role.managed) }))
        .sort((a, b) => b.position - a.position);
}

export async function getBotGuildChannels(appId: string): Promise<DiscordGuildChannel[]> {
    const { token, serverId } = await ownedActiveApplication(appId);
    if (!token || !serverId) return [];
    const response = await fetch(`https://discord.com/api/v10/guilds/${serverId}/channels`, {
        headers: { Authorization: `Bot ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (!response?.ok) throw new ActionError("Não foi possível consultar os canais do servidor.");
    const channels = await response.json() as Array<{ id?: string; name?: string; type?: number; position?: number; parent_id?: string | null }>;
    if (!Array.isArray(channels)) throw new ActionError("O Discord retornou uma lista de canais inválida.");
    return channels.filter((channel) => channel.id && channel.name)
        .map((channel) => ({ id: String(channel.id), name: String(channel.name), type: Number(channel.type || 0), position: Number(channel.position || 0), parentId: channel.parent_id ? String(channel.parent_id) : null, guildId: serverId }))
        .sort((a, b) => a.position - b.position);
}

export type PublishableBotPanel = "balance" | "stock_requests" | "tickets" | "cloud";

function discordButtonStyle(value: unknown): number {
    const style = String(value || "green").toLowerCase();
    return style === "red" ? 4 : style === "green" ? 3 : style === "blue" || style === "blurple" ? 1 : 2;
}

function discordColor(value: unknown, fallback = 0x7c3aed): number {
    const normalized = String(value || "").replace("#", "");
    return /^[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized, 16) : fallback;
}

function unicodeEmoji(value: unknown): { name: string } | undefined {
    const emoji = typeof value === "string" ? value.trim() : "";
    return emoji && !emoji.startsWith("<") ? { name: emoji } : undefined;
}

function panelPayload(config: Record<string, unknown>, customId: string, defaultLabel: string, componentOverride?: Record<string, unknown>) {
    const style = String(config.message_style || "embed");
    const button = config.button && typeof config.button === "object" ? config.button as Record<string, unknown> : {};
    const discordButton = {
        type: 2,
        style: discordButtonStyle(button.style),
        label: String(button.label || defaultLabel).slice(0, 80),
        custom_id: customId,
        emoji: unicodeEmoji(button.emoji),
    };
    const interactiveComponent = componentOverride || discordButton;
    if (style === "content") {
        const content = config.content && typeof config.content === "object" ? config.content as Record<string, unknown> : {};
        return { content: String(content.content || defaultLabel).slice(0, 2000), components: [{ type: 1, components: [interactiveComponent] }] };
    }
    if (style === "container") {
        const container = config.container && typeof config.container === "object" ? config.container as Record<string, unknown> : {};
        return {
            flags: 32768,
            components: [{
                type: 17,
                accent_color: discordColor(container.color),
                components: [
                    { type: 10, content: String(container.content || `## ${defaultLabel}`).slice(0, 4000) },
                    { type: 1, components: [interactiveComponent] },
                ],
            }],
        };
    }
    const embed = config.embed && typeof config.embed === "object" ? config.embed as Record<string, unknown> : {};
    const imageUrl = typeof embed.image_url === "string" && /^https?:\/\//i.test(embed.image_url) ? embed.image_url : undefined;
    const thumbnailUrl = typeof embed.thumbnail_url === "string" && /^https?:\/\//i.test(embed.thumbnail_url) ? embed.thumbnail_url : undefined;
    return {
        embeds: [{
            title: String(embed.title || defaultLabel).slice(0, 256),
            description: String(embed.description || "Use o botão abaixo para continuar.").slice(0, 4096),
            color: discordColor(embed.color),
            image: imageUrl ? { url: imageUrl } : undefined,
            thumbnail: thumbnailUrl ? { url: thumbnailUrl } : undefined,
        }],
        components: [{ type: 1, components: [interactiveComponent] }],
    };
}

export async function publishBotPanel(appId: string, panel: PublishableBotPanel, channelId: string, panelId?: string): Promise<{ ok: true; messageId: string }> {
    const { discordId, botId, token, serverId } = await ownedActiveApplication(appId);
    if (!checkRateLimit(`site:publish-panel:${discordId}:${appId}`, { windowMs: 60_000, maxRequests: 8 })) {
        throw new ActionError("Muitos envios em sequência. Aguarde um minuto.");
    }
    if (!token || !serverId) throw new ActionError("Configure o token e o servidor principal antes de enviar o painel.");
    if (!/^\d{15,25}$/.test(channelId)) throw new ActionError("Selecione um canal válido.");
    const headers = { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
    const channelResponse = await fetch(`https://discord.com/api/v10/channels/${channelId}`, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!channelResponse?.ok) throw new ActionError("O bot não consegue acessar o canal selecionado.");
    const channel = await channelResponse.json() as { guild_id?: string; type?: number };
    if (String(channel.guild_id || "") !== serverId) throw new ActionError("O canal não pertence ao servidor principal.");
    if (![0, 5].includes(Number(channel.type))) throw new ActionError("Escolha um canal de texto ou anúncios.");

    let documentId: string;
    let root: Record<string, unknown>;
    let messageConfig: Record<string, unknown>;
    let customId: string;
    let defaultLabel: string;
    if (panel === "balance") {
        documentId = "loja_saldo_config";
        root = (await getBotDocument(botId, documentId)) || droxDefaultFor(documentId);
        messageConfig = root.deposit_panel && typeof root.deposit_panel === "object" ? root.deposit_panel as Record<string, unknown> : {};
        customId = "deposit_saldo_open";
        defaultLabel = "Depositar saldo";
    } else if (panel === "stock_requests") {
        documentId = "loja_preferences";
        root = (await getBotDocument(botId, documentId)) || droxDefaultFor(documentId);
        const stock = root.stock_requests && typeof root.stock_requests === "object" ? root.stock_requests as Record<string, unknown> : {};
        messageConfig = stock.panel_message && typeof stock.panel_message === "object" ? stock.panel_message as Record<string, unknown> : {};
        customId = "StockRequest_OpenModal";
        defaultLabel = "Solicitar estoque";
    } else if (panel === "cloud") {
        documentId = "cloud_data";
        root = (await getBotDocument(botId, documentId)) || droxDefaultFor(documentId);
        messageConfig = root.message_verify && typeof root.message_verify === "object" ? root.message_verify as Record<string, unknown> : {};
        customId = "Cloud_GetAuthLink";
        defaultLabel = "Verificar";
    } else {
        documentId = "tickets_config";
        root = (await getBotDocument(botId, documentId)) || droxDefaultFor(documentId);
        const panels = root.panels && typeof root.panels === "object" ? root.panels as Record<string, unknown> : {};
        if (!panelId || !panels[panelId] || typeof panels[panelId] !== "object") throw new ActionError("Selecione um painel de ticket válido.");
        messageConfig = panels[panelId] as Record<string, unknown>;
        customId = `create_ticket_${panelId}`;
        defaultLabel = "Abrir ticket";
    }
    let componentOverride: Record<string, unknown> | undefined;
    if (panel === "tickets" && panelId) {
        const options = Array.isArray(messageConfig.options) ? messageConfig.options.filter((option): option is Record<string, unknown> => Boolean(option && typeof option === "object")) : [];
        if (options.length > 1) {
            componentOverride = { type: 3, custom_id: `ticket_panel_option_select_${panelId}`, placeholder: "Selecione uma opção para abrir o ticket...", options: options.slice(0, 25).map((option, index) => ({ label: String(option.name || "Opção sem nome").slice(0, 100), value: String(option.id || index), description: option.description ? String(option.description).slice(0, 100) : undefined, emoji: unicodeEmoji(option.emoji) })) };
        }
    }
    const payload = panelPayload(messageConfig, customId, defaultLabel, componentOverride);
    const previousId = (panel === "balance" || panel === "tickets") && typeof messageConfig.message_id === "string" ? messageConfig.message_id : "";
    let response: Response | null = null;
    if (previousId) {
        response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${previousId}`, { method: "PATCH", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000) }).catch(() => null);
    }
    if (!response?.ok) {
        response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000) }).catch(() => null);
    }
    if (!response?.ok) {
        const detail = response ? await response.text().catch(() => "") : "";
        console.error("[DROX_PANEL] Falha no Discord", { panel, status: response?.status, detail: detail.slice(0, 300) });
        throw new ActionError("Não foi possível enviar o painel. Confira as permissões do bot no canal.");
    }
    const sent = await response.json() as { id?: string };
    if (!sent.id) throw new ActionError("O Discord não confirmou o envio do painel.");
    if (panel === "balance") {
        root.deposit_panel = { ...messageConfig, channel_id: channelId, message_id: sent.id };
        await saveBotDocument(botId, documentId, root);
    } else if (panel === "tickets" && panelId) {
        const panels = root.panels && typeof root.panels === "object" ? root.panels as Record<string, unknown> : {};
        panels[panelId] = { ...messageConfig, channel_id: channelId, message_id: sent.id, has_pending_changes: false };
        root.panels = panels;
        await saveBotDocument(botId, documentId, root);
    }
    revalidatePath(`/dashboard/${appId}/config/loja`);
    return { ok: true, messageId: sent.id };
}