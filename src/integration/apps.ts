import axios from "axios";
import { Types } from "mongoose";
import databases from "../databases";
import sdkWrapper from "../functions/camposcloud-sdk";
import { releaseExists, redeployWithNewToken, type HostedBotConfig } from "../functions/hosted-bot";
import type { IApplications } from "../databases/schemas/applications";
import type { IProducts } from "../databases/schemas/products";
import type { IStores } from "../databases/schemas/stores";

const DISCORD_API_TIMEOUT_MS = 15_000;
export const HOSTED_BOT_API_URL = "https://api.droxbot.com.br";

type PopulatedApplication = IApplications & { productId: IProducts; storeId: IStores };
type StoreSdk = NonNullable<Awaited<ReturnType<typeof sdkWrapper.getInstance>>>["instance"];
type CamposApplication = Awaited<ReturnType<StoreSdk["getApplication"]>>;
type ApplicationUpdate = Parameters<CamposApplication["updateApplication"]>[0];

function runtimeEnvironment(runtime?: string): "python" | "nodejs" {
    return runtime?.toLowerCase().includes("node") ? "nodejs" : "python";
}

async function updateCamposApplication(hosted: CamposApplication, data: ApplicationUpdate) {
    const compatible = hosted as unknown as {
        update?: (input: ApplicationUpdate) => Promise<unknown>;
        updateApplication?: (input: ApplicationUpdate) => Promise<unknown>;
    };
    const update = compatible.update ?? compatible.updateApplication;
    if (!update) throw new Error("A versão instalada do SDK da CamposCloud não permite atualizar aplicações.");
    try {
        await update.call(hosted, data);
    } catch (error) {
        // Some CamposCloud deployments return 500 from /update even though file
        // deployment remains available. The generated package contains the same
        // environment values, so allow that path to finish the token rotation.
        if (axios.isAxiosError(error) && (error.response?.status ?? 0) >= 500) {
            console.warn(`[CamposCloud] Atualização de metadados indisponível (${error.response?.status}); continuando com o envio do pacote.`);
            return;
        }
        throw camposError("atualizar os metadados da aplicação", error);
    }
}

function camposError(operation: string, error: unknown): Error {
    if (!axios.isAxiosError(error)) return error instanceof Error ? error : new Error(`Não foi possível ${operation}.`);
    const body = error.response?.data;
    const detail = typeof body === "string"
        ? body
        : body && typeof body === "object" && "message" in body && typeof body.message === "string"
            ? body.message
            : undefined;
    const status = error.response?.status;
    return new Error(`Não foi possível ${operation} na CamposCloud${status ? ` (HTTP ${status})` : ""}${detail ? `: ${detail}` : "."}`);
}

export function buildApplicationEnvironment(input: {
    token: string; ownerId: string; applicationId: string; botId: string;
    version: string; serverId?: string | null;
}) {
    return [
        { key: "BOT_TOKEN", value: input.token },
        { key: "BOT_TOKEN_DISCORD", value: input.token },
        { key: "TOKEN", value: input.token },
        { key: "DISCORD_TOKEN", value: input.token },
        { key: "OWNER_ID", value: input.ownerId },
        { key: "APPLICATION_ID", value: input.applicationId },
        { key: "BOT_ID", value: input.botId },
        { key: "API_URL", value: HOSTED_BOT_API_URL },
        { key: "VERSION", value: input.version },
        { key: "DROX_EMOJIS", value: "true" },
        { key: "SAVE_CONFIG", value: "false" },
        { key: "START_ON_BACKUP", value: "true" },
        { key: "SERVER_ID", value: input.serverId || "" },
        { key: "PERMS", value: input.ownerId },
    ];
}

export function buildApplicationPackageConfig(input: {
    token: string; ownerId: string; applicationId: string; botId: string;
    version: string; serverId?: string | null;
}): HostedBotConfig {
    return {
        botID: input.botId, botToken: input.token, apiURL: HOSTED_BOT_API_URL,
        version: input.version, syncEmojis: true, saveConfig: false, startOnBackup: true,
        bot: { token: input.token, owner: input.ownerId, id: input.botId, perms: input.ownerId, server: input.serverId || "" },
    };
}

async function ownedApplication(appId: string, actorId: string): Promise<PopulatedApplication> {
    if (!Types.ObjectId.isValid(appId)) throw new Error("Aplicação inválida.");
    const application = await databases.applications.findById(appId).populate("productId").populate("storeId") as unknown as PopulatedApplication | null;
    if (!application) throw new Error("Aplicação não encontrada.");
    if (String(application.ownerId) !== actorId) throw new Error("Você não possui esta aplicação.");
    return application;
}

async function storeSdk(storeId: string): Promise<StoreSdk> {
    const store = await databases.stores.findById(storeId, { ownerId_campos: 1 });
    const owner = store && await databases.userSettings.findOne({ userId_campos: store.ownerId_campos }, { userId_discord: 1 });
    if (!owner?.userId_discord) throw new Error("Dono da loja não está vinculado ao painel.");
    const sdk = await sdkWrapper.getInstance(owner.userId_discord).catch(() => null);
    if (!sdk?.isValid) throw new Error("Erro ao conectar com o SDK da CamposCloud.");
    return sdk.instance;
}

async function camposApplication(application: PopulatedApplication) {
    if (!application.appId) throw new Error("Aplicação sem ID na CamposCloud.");
    const sdk = await storeSdk(String(application.storeId?._id || application.storeId));
    try {
        const hosted = await sdk.getApplication({ appId: application.appId });
        return { sdk, hosted };
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            throw new Error("Aplicação não encontrada na CamposCloud.");
        }
        throw camposError("consultar a aplicação", error);
    }
}

function assertActive(application: PopulatedApplication, operation: string) {
    if (application.status !== "active") throw new Error(`A aplicação não está ativa. Não é possível ${operation}.`);
}

export async function startApplication(appId: string, actorId: string) {
    const application = await ownedApplication(appId, actorId); assertActive(application, "iniciar");
    const { hosted } = await camposApplication(application);
    // Idempotent because hosting telemetry can lag behind a recent click.
    if (hosted.data.currentResourceMetrics?.online) return;
    await hosted.start().catch((error) => { throw camposError("iniciar a aplicação", error); });
}

export async function stopApplication(appId: string, actorId: string) {
    const application = await ownedApplication(appId, actorId); assertActive(application, "parar");
    const { hosted } = await camposApplication(application);
    if (!hosted.data.currentResourceMetrics?.online) return;
    await hosted.stop().catch((error) => { throw camposError("parar a aplicação", error); });
}

export async function restartApplication(appId: string, actorId: string) {
    const application = await ownedApplication(appId, actorId); assertActive(application, "reiniciar");
    const { hosted } = await camposApplication(application);
    if (!hosted.data.currentResourceMetrics?.online) {
        await hosted.start().catch((error) => { throw camposError("iniciar a aplicação que estava offline", error); });
        return;
    }
    await hosted.restart().catch((error) => { throw camposError("reiniciar a aplicação", error); });
}

export async function changeApplicationName(appId: string, actorId: string, name: string) {
    const application = await ownedApplication(appId, actorId);
    const normalized = name.trim();
    if (!normalized) throw new Error("O nome não pode ser vazio.");
    if (normalized.length > 40) throw new Error("O nome não pode ter mais de 40 caracteres.");
    application.name = normalized; await (application as any).save();
}

export async function listBotGuilds(appId: string, actorId: string): Promise<Array<{ id: string; name: string }>> {
    const application = await ownedApplication(appId, actorId);
    const response = await axios.get("https://discord.com/api/v10/users/@me/guilds", {
        headers: { Authorization: `Bot ${application.token}` }, timeout: DISCORD_API_TIMEOUT_MS,
    }).catch(() => null);
    if (!Array.isArray(response?.data)) throw new Error("Não foi possível consultar os servidores do bot. Verifique o token.");
    return response.data.filter((g: any) => g && g.id && g.name).map((g: any) => ({ id: String(g.id), name: String(g.name) })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function redeploy(application: PopulatedApplication, hosted: CamposApplication, input: { token: string; botId: string; serverId?: string | null }) {
    const product = application.productId;
    const version = String(application.version || product?.currentReleaseVersion || "");
    if (!version) throw new Error("Não foi possível determinar a versão da release.");
    const config = { token: input.token, botId: input.botId, ownerId: application.ownerId, applicationId: String(application._id), version, serverId: input.serverId };
    await updateCamposApplication(hosted, {
        appName: hosted.data.name, memoryMB: hosted.data.allocatedMemoryMB,
        runtimeEnvironment: runtimeEnvironment(product.runtimeEnvironment), startupCommand: hosted.data.startupCommand,
        environmentVariables: buildApplicationEnvironment(config),
    });

    // Alterar token ou servidor não deve depender do arquivo histórico da
    // release. A aplicação já está implantada na CamposCloud e as variáveis
    // acima são suficientes para aplicar a configuração. Se o ZIP existir,
    // também reconstruímos o pacote para manter config.json/.env sincronizados.
    const releaseAvailable = await releaseExists(String(product._id), version).catch(() => false);
    if (!releaseAvailable) {
        console.warn(`[CAMPOSCLOUD] Release ${version} ausente no disco; configuração aplicada somente pelas variáveis de ambiente.`);
        return;
    }
    try {
        await redeployWithNewToken(hosted, String(product._id), version, buildApplicationPackageConfig(config));
    } catch (error) {
        throw camposError("enviar o pacote atualizado", error);
    }
}

export async function changeApplicationToken(appId: string, actorId: string, token: string) {
    const application = await ownedApplication(appId, actorId); const normalized = token.trim();
    if (!normalized) throw new Error("O token não pode ser vazio.");
    const info = await axios.get("https://discord.com/api/v10/applications/@me", { headers: { Authorization: `Bot ${normalized}` }, timeout: DISCORD_API_TIMEOUT_MS }).catch(() => null);
    if (!info?.data?.id) throw new Error("Não foi possível obter informações do bot com o novo token. Verifique se o token está correto.");
    const { hosted } = await camposApplication(application); const wasOnline = !!hosted.data.currentResourceMetrics?.online;
    if (wasOnline) await hosted.stop();
    try {
        await redeploy(application, hosted, { token: normalized, botId: String(info.data.id), serverId: application.serverId || application.storeId?.teamId_campos });
    } catch (error) {
        if (wasOnline) await hosted.start().catch(() => null);
        throw error;
    }
    application.token = normalized; application.botId = String(info.data.id); await (application as any).save();
    if (wasOnline) await hosted.start().catch((error) => { throw camposError("reiniciar a aplicação após trocar o token", error); });
}

export async function changeApplicationMainServer(appId: string, actorId: string, serverId: string) {
    const application = await ownedApplication(appId, actorId);
    if (!/^\d{17,20}$/.test(serverId)) throw new Error("ID do servidor Discord inválido.");
    const guilds = await listBotGuilds(appId, actorId);
    if (!guilds.some((guild) => guild.id === serverId)) throw new Error("O bot não participa do servidor selecionado.");
    const { hosted } = await camposApplication(application); const wasOnline = !!hosted.data.currentResourceMetrics?.online;
    if (wasOnline) await hosted.stop();
    try {
        await redeploy(application, hosted, { token: application.token, botId: application.botId, serverId });
    } catch (error) {
        if (wasOnline) await hosted.start().catch(() => null);
        throw error;
    }
    application.serverId = serverId;
    await (application as any).save();
    if (wasOnline) await hosted.start().catch((error) => { throw camposError("reiniciar a aplicação após trocar o servidor", error); });
}
