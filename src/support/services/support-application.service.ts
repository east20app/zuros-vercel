import databases from "../../databases";
import sdkWrapper from "../../functions/camposcloud-sdk";
import { restartApplication, startApplication, stopApplication } from "../../integration/apps";
import type { SafeApplication } from "../types";

async function getSdkForStore(storeId: string) {
    const store = await databases.stores.findById(storeId, { ownerId_campos: 1 });
    const owner = store && await databases.userSettings.findOne({ userId_campos: store.ownerId_campos }, { userId_discord: 1 });
    if (!owner?.userId_discord) throw new Error("A loja não está vinculada à CamposCloud.");
    const sdk = await sdkWrapper.getInstance(owner.userId_discord).catch(() => null);
    if (!sdk?.isValid) throw new Error("Não foi possível conectar à CamposCloud.");
    return sdk.instance;
}

export async function listUserApplications(ownerId: string): Promise<SafeApplication[]> {
    const applications = await databases.applications.find({ ownerId }).populate("productId").lean();
    return applications.map((app: any) => ({
        id: String(app._id), name: app.name, botId: app.botId, appId: app.appId,
        productName: app.productId?.name || "Produto removido", status: app.status,
        version: app.version || "1.0.0", lifetime: Boolean(app.lifetime), expiresAt: app.expiresAt,
        serverId: app.serverId, online: null,
    }));
}

export async function getUserApplicationStatus(ownerId: string, applicationId: string): Promise<SafeApplication> {
    const app: any = await databases.applications.findOne({ _id: applicationId, ownerId }).populate("productId").lean();
    if (!app) throw new Error("Aplicação não encontrada ou sem permissão.");
    let online: boolean | null = null;
    let uptime: number | null = null;
    if (app.appId) {
        try {
            const sdk = await getSdkForStore(String(app.storeId));
            const remote = await sdk.getApplication({ appId: app.appId });
            const metrics = remote.data?.currentResourceMetrics;
            online = Boolean(metrics?.online);
            uptime = metrics?.uptime ?? null;
        } catch { online = null; }
    }
    return { id: String(app._id), name: app.name, botId: app.botId, appId: app.appId, productName: app.productId?.name || "Produto removido", status: app.status, version: app.version || "1.0.0", lifetime: Boolean(app.lifetime), expiresAt: app.expiresAt, serverId: app.serverId, online, uptime };
}

export async function operateUserApplication(ownerId: string, applicationId: string, operation: "start" | "restart" | "stop") {
    if (operation === "start") await startApplication(applicationId, ownerId);
    if (operation === "restart") await restartApplication(applicationId, ownerId);
    if (operation === "stop") await stopApplication(applicationId, ownerId);
}

export function formatApplicationStatus(app: SafeApplication): string {
    const online = app.online === true ? "Online 🟢" : app.online === false ? "Offline 🔴" : "Não verificado ⚪";
    const memory = app.online === null ? "N/A" : online;
    const expiry = app.lifetime ? "Lifetime" : app.expiresAt ? `<t:${Math.floor(new Date(app.expiresAt).getTime() / 1000)}:R>` : "Não informado";
    return [`**${app.name}**`, `Produto: ${app.productName}`, `Status da aplicação: ${app.status}`, `Bot: ${online}`, `Memória: ${memory}`, `Versão: v${app.version}`, `Expiração: ${expiry}`].join("\n");
}
