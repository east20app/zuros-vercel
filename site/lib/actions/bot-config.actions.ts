"use server";
import { revalidatePath } from "next/cache";
import databases from "@root/src/databases";
import { checkRateLimit } from "@root/src/functions/rate-limit";
import { ActionError, requireSessionUser } from "./context";
import { BOT_CONFIG_MODULES, isBotConfigModule, type BotConfigModule } from "@/lib/bot-config-modules";
import { botConfigSchemas } from "@/lib/bot-config-schemas";
import { getBotDocument, saveBotDocument, startBotConfigSyncWatcher } from "@/lib/drox-bot-config";
import { droxDefaultFor } from "@/lib/drox-defaults";
import { restartApplication } from "@root/src/integration/apps";

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
    const identifier = /^[a-f\d]{24}$/i.test(appId) ? { $or: [{ _id: appId }, { botId: appId }] } : { botId: appId };
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
    try { return Object.fromEntries(await Promise.all(Object.entries(mapping).map(async ([alias, docId]) => [alias, (await getBotDocument(botId, docId)) || droxDefaultFor(docId)]))); }
    catch (error) { logDroxFailure("read", moduleName, error); throw new ActionError("Não foi possível acessar as configurações do DROX agora."); }
}
export async function saveBotConfig(appId: string, modulo: string, data: Record<string, unknown>): Promise<{ ok: true; synced: boolean; warning?: string }> {
    const moduleName = moduleOrThrow(modulo); const { appId: internalAppId, discordId, botId } = await ownedActiveApplication(appId);
    if (!process.env.VERCEL) startBotConfigSyncWatcher();
    if (!checkRateLimit(`site:bot-config:${discordId}:${appId}`, { windowMs: 60_000, maxRequests: 20 })) throw new ActionError("Muitas alterações em sequência. Aguarde alguns instantes.");
    const parsed = botConfigSchemas[moduleName].safeParse(data); if (!parsed.success) throw new ActionError("Os dados enviados são inválidos para este módulo.");
    const mapping = BOT_CONFIG_MODULES[moduleName] as Record<string, string>;
    try { await Promise.all(Object.entries(mapping).map(([alias, docId]) => saveBotDocument(botId, docId, parsed.data[alias] ?? droxDefaultFor(docId)))); }
    catch (error) { logDroxFailure("write", moduleName, error); throw new ActionError("Não foi possível salvar no DROX. Tente novamente em instantes."); }
    revalidatePath(`/dashboard/${appId}/config`); revalidatePath(`/dashboard/${appId}/config/${moduleName}`);
    try {
        await restartApplication(internalAppId, discordId);
        return { ok: true, synced: true };
    } catch (error) {
        logDroxFailure("write", moduleName, error);
        return { ok: true, synced: false, warning: "Configuração salva, mas o bot não pôde ser reiniciado. Inicie-o ou reinicie-o pelo painel para aplicar agora." };
    }
}
export async function getBotConfigStatus(appId: string): Promise<{ online: boolean }> {
    try { await getBotConfig(appId, "customizacao"); return { online: true }; } catch { return { online: false }; }
}

export type DiscordGuildRole = { id: string; name: string; color: number; position: number; managed: boolean };
export type DiscordGuildChannel = { id: string; name: string; type: number; position: number; parentId: string | null };

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
        .map((channel) => ({ id: String(channel.id), name: String(channel.name), type: Number(channel.type || 0), position: Number(channel.position || 0), parentId: channel.parent_id ? String(channel.parent_id) : null }))
        .sort((a, b) => a.position - b.position);
}
