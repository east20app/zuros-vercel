"use server";

import { reserveCouponForCart } from "@root/src/integration/coupon-reservations";

import crypto from "crypto";
import QRCode from "qrcode";
import { QrCodePix } from "qrcode-pix";
import { revalidatePath } from "next/cache";

import databases from "@root/src/databases";
import sdkWrapper from "@root/src/functions/camposcloud-sdk";
import { getCachedInstanceStatus, invalidateInstanceStatus } from "@root/src/functions/status-cache";
import efiWrapper from "@root/src/functions/efi_wrapper";
import promisseWrapper from "@root/src/functions/promisse_wrapper";
import sharpifyWrapper from "@root/src/functions/sharpify_wrapper";
import { checkRateLimit } from "@root/src/functions/rate-limit";
import {
    startApplication, stopApplication, restartApplication, changeApplicationName,
    changeApplicationToken, changeApplicationMainServer, listBotGuilds as listApplicationGuilds,
} from "@root/src/integration/apps";

import type { HydratedDocument } from "mongoose";
import type { IApplications } from "@root/src/databases/schemas/applications";
import type { ICartsRenew } from "@root/src/databases/schemas/carts-renew";
import type { ICoupons } from "@root/src/databases/schemas/coupons";
import type { IProducts } from "@root/src/databases/schemas/products";
import type { IStores } from "@root/src/databases/schemas/stores";

import type { AppDetail, AppStatus, AppSummary, CartRenewView, ExtractEntry, RenewPrices } from "@/lib/types";
import { ActionError, requireSessionUser } from "./context";

const RENEW_CART_EXPIRES_MINUTES = 30;
const PIX_TAX = 1.2;

type Sdk = NonNullable<Awaited<ReturnType<typeof sdkWrapper.getInstance>>>["instance"];
type SdkApplication = Awaited<ReturnType<Sdk["getApplication"]>>;
type AppDoc = IApplications;
type ProductDoc = IProducts;
type StoreDoc = IStores;
type CartRenewDoc = HydratedDocument<ICartsRenew>;
type AppPopulated = HydratedDocument<IApplications> & { productId: ProductDoc; storeId: StoreDoc };
type CartRenewCouponPopulated = CartRenewDoc & { coupon: ICoupons | null };

export interface UserInvoiceDTO {
    id: string;
    type: "purchase" | "renewal";
    item: string;
    plan: string;
    amount: number;
    status: string;
    paymentId: string | null;
    paid: boolean;
    createdAt: string | null;
}

export interface AccountExtractDTO {
    id: string;
    storeName: string;
    origin: "sales" | "manual";
    action: "add" | "remove";
    description: string | null;
    amount: number;
    createdAt: string;
}

export async function listMyAccountExtracts(limit = 100): Promise<AccountExtractDTO[]> {
    const discordId = await requireSessionUser();
    const settings = await databases.userSettings.findOne(
        { userId_discord: discordId },
        { userId_campos: 1 }
    ).lean();
    if (!settings?.userId_campos) return [];

    const stores = await databases.stores.find(
        { ownerId_campos: settings.userId_campos },
        { name: 1 }
    ).lean();
    if (stores.length === 0) return [];

    const names = new Map(stores.map((store) => [String(store._id), store.name]));
    const rows = await databases.extracts
        .find({ storeId: { $in: Array.from(names.keys()) } })
        .sort({ createdAt: -1 })
        .limit(Math.min(Math.max(limit, 1), 200))
        .lean();

    return rows.map((row) => ({
        id: String(row._id),
        storeName: names.get(String(row.storeId)) || "Loja",
        origin: row.origin,
        action: row.action,
        description: row.description || null,
        amount: row.amount,
        createdAt: toISO((row as typeof row & { createdAt?: Date }).createdAt) || "",
    }));
}

function invoicePlan(cart: { days?: number; lifetime?: boolean }): string {
    if (cart.lifetime) return "Vitalício";
    if (cart.days === 7) return "Semanal";
    if (cart.days === 15) return "Quinzenal";
    if (cart.days === 30) return "Mensal";
    return cart.days ? `${cart.days} dias` : "Plano não informado";
}

export async function listMyInvoices(): Promise<UserInvoiceDTO[]> {
    const discordId = await requireSessionUser();
    const [buys, renewals] = await Promise.all([
        databases.cartsBuy
            .find({ userId: discordId, $or: [{ paymentId: { $exists: true } }, { step: "payment-confirmed" }] })
            .populate("productId", "name")
            .lean(),
        databases.cartsRenew
            .find({ userId: discordId, $or: [{ paymentId: { $exists: true } }, { step: "payment-confirmed" }] })
            .populate({ path: "applicationId", select: "name productId", populate: { path: "productId", select: "name" } })
            .lean(),
    ]);

    const purchaseRows = buys as unknown as Array<{
        _id: unknown; productId?: { name?: string }; days?: number; lifetime?: boolean;
        price?: number; finalPrice?: number; status: string; step?: string; paymentId?: string; createdAt?: Date;
    }>;
    const renewalRows = renewals as unknown as Array<{
        _id: unknown; applicationId?: { name?: string; productId?: { name?: string } };
        days?: number; lifetime?: boolean; price?: number; finalPrice?: number;
        status: string; step?: string; paymentId?: string; createdAt?: Date;
    }>;

    return [
        ...purchaseRows.map((cart) => ({ id: String(cart._id), type: "purchase" as const, item: cart.productId?.name || "Aplicação", plan: invoicePlan(cart), amount: cart.price || cart.finalPrice || 0, status: cart.status, paymentId: cart.paymentId || null, paid: cart.step === "payment-confirmed", createdAt: toISO(cart.createdAt) })),
        ...renewalRows.map((cart) => ({ id: String(cart._id), type: "renewal" as const, item: cart.applicationId?.name || cart.applicationId?.productId?.name || "Aplicação", plan: invoicePlan(cart), amount: cart.price || cart.finalPrice || 0, status: cart.status, paymentId: cart.paymentId || null, paid: cart.step === "payment-confirmed", createdAt: toISO(cart.createdAt) })),
    ];
}
type CartRenewAppPopulated = CartRenewDoc & { applicationId: AppDoc };
type CartRenewAppCouponPopulated = CartRenewAppPopulated & { coupon: ICoupons | null };

function toISO(date: unknown): string | null {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date as string);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

async function getApplicationPopulated(appId: string): Promise<AppPopulated> {
    const identifier = /^[a-f\d]{24}$/i.test(appId)
        ? { $or: [{ _id: appId }, { botId: appId }, { appId }] }
        : { botId: appId };
    const application = (await databases.applications
        .findOne(identifier)
        .populate("productId")
        .populate("storeId")) as unknown as AppPopulated | null;
    if (!application) throw new ActionError("Aplicação não encontrada.");
    return application;
}

async function getStoreSdkInstance(storeId: string): Promise<Sdk> {
    const store = await databases.stores.findById(storeId, { ownerId_campos: 1 });
    if (!store?.ownerId_campos) throw new ActionError("Loja não encontrada.");
    const ownerSettings = await databases.userSettings.findOne(
        { userId_campos: store.ownerId_campos },
        { userId_discord: 1 }
    );
    if (!ownerSettings?.userId_discord) {
        throw new ActionError("Dono da loja não está vinculado ao painel.");
    }
    const sdk = await sdkWrapper.getInstance(ownerSettings.userId_discord).catch(() => null);
    if (!sdk || !sdk.isValid) {
        throw new ActionError("Erro ao conectar com o serviço de hospedagem.");
    }
    return sdk.instance;
}

async function getCamposApplication(sdk: Sdk, appId: string | null | undefined): Promise<SdkApplication> {
    if (!appId) throw new ActionError("Aplicação sem identificador de hospedagem.");
    const currentApplication = await sdk.getApplication({ appId }).catch(() => null);
    if (!currentApplication) {
        throw new ActionError("Aplicação não encontrada na hospedagem.");
    }
    return currentApplication;
}

function getMetrics(currentApplicationCampos: SdkApplication) {
    const metrics = currentApplicationCampos?.data?.currentResourceMetrics || null;
    const online = !!metrics?.online;
    return {
        online,
        memoryUsedMB: metrics?.memoryUsageBytes ? Math.round(metrics.memoryUsageBytes / 1024 / 1024) : null,
        memoryMB: metrics?.memoryLimitBytes ? Math.round(metrics.memoryLimitBytes / 1024 / 1024) : null,
        uptime: metrics?.online ? (metrics.uptime ?? null) : null,
    };
}

export async function getBotIdentity(appId: string): Promise<{ id: string; name: string; botId: string; status: AppStatus; productName: string }> {
    const discordId = await requireSessionUser();
    const application = await getApplicationPopulated(appId);
    if (String(application.ownerId) !== discordId) {
        throw new ActionError("Você não possui esta aplicação.");
    }
    return {
        id: application.botId || String(application._id),
        name: application.name,
        botId: application.botId || "",
        status: application.status,
        productName: application.productId?.name || "Sem produto",
    };
}

export async function listMyApps(): Promise<AppSummary[]> {
    const discordId = await requireSessionUser();
    const [apps, authLicenses] = await Promise.all([
        databases.applications.find({ ownerId: discordId }).populate("productId").populate("storeId"),
        databases.authLicenses.find({ ownerId: discordId, status: { $in: ["active", "pending", "error"] } }).populate("productId").populate("storeId"),
    ]) as unknown as [AppPopulated[], Array<{ _id: unknown; applicationId?: unknown; externalLicenseId?: string; dashboardUrl?: string; plan: string; status: string; lifetime: boolean; expiresAt?: Date; productId?: ProductDoc; storeId?: StoreDoc }>];
    const botApps: AppSummary[] = apps.map((app) => ({ id: String(app._id), botId: app.botId || "", name: app.name, status: app.status, lifetime: !!app.lifetime, expiresAt: toISO(app.expiresAt), version: String(app.version), errorOnUpdate: !!app.errorOnUpdate, productName: app.productId?.name || "Sem produto", storeId: String(app.storeId?._id || app.storeId), storeName: app.storeId?.name || "Loja removida", kind: app.productId?.productType === "complete" ? "complete" : "bot" }));
    const linked = new Set(authLicenses.filter((license) => license.applicationId).map((license) => String(license.applicationId)));
    for (const app of botApps) if (linked.has(app.id)) app.kind = "complete";
    const authApps: AppSummary[] = authLicenses.filter((license) => !license.applicationId).map((license) => ({ id: String(license._id), name: license.productId?.name || "ZUROS Auth", status: license.status === "active" ? "active" : "grace_period", lifetime: !!license.lifetime, expiresAt: toISO(license.expiresAt), version: license.plan, errorOnUpdate: license.status === "error", productName: license.productId?.name || "ZUROS Auth", storeId: String(license.storeId?._id || license.storeId || ""), storeName: license.storeId?.name || "ZUROS", kind: "auth", dashboardUrl: license.dashboardUrl || "https://auth.zuros.site/app" }));
    return [...botApps, ...authApps];
}

export interface MyAuthLicenseView { id: string; name: string; plan: string; status: string; lifetime: boolean; expiresAt: string | null; servers: number; verifiedUsers: number; features: string[]; externalLicenseId: string | null; configured: boolean; }
export async function getMyAuthLicense(licenseId: string): Promise<MyAuthLicenseView> {
    const discordId = await requireSessionUser();
    const license = await databases.authLicenses.findOne({ _id: licenseId, ownerId: discordId }).populate("productId");
    if (!license) throw new ActionError("Licença ZUROS Auth não encontrada.");
    const product = license.productId as unknown as ProductDoc;
    return { id: String(license._id), name: product?.name || "ZUROS Auth", plan: license.plan, status: license.status, lifetime: !!license.lifetime, expiresAt: toISO(license.expiresAt), servers: license.limits?.servers || 1, verifiedUsers: license.limits?.verifiedUsers || 1000, features: [...(license.features || [])], externalLicenseId: license.externalLicenseId || null, configured: !!license.setupCompletedAt && !!license.authId };
}
export async function getAppDetail(appId: string): Promise<AppDetail> {
    const discordId = await requireSessionUser();
    const application = await getApplicationPopulated(appId);
    if (String(application.ownerId) !== discordId) {
        throw new ActionError("Você não possui esta aplicação.");
    }

    const product = application.productId;
    const store = application.storeId;

    let metrics = { online: false, memoryUsedMB: null as number | null, memoryMB: null as number | null, uptime: null as number | null };
    try {
        const sdk = await getStoreSdkInstance(String(store?._id || application.storeId));
        const appId = application.appId;
        if (appId) {
            metrics = await getCachedInstanceStatus(appId, async () => {
                const currentApplicationCampos = await getCamposApplication(sdk, appId);
                return getMetrics(currentApplicationCampos);
            });
        }
    } catch {
        // offline ou loja sem SDK configurado
    }

    const currentVersion = product?.currentReleaseVersion || null;

    return {
        id: String(application._id),
        storeId: String(store?._id || application.storeId),
        name: application.name,
        botId: application.botId,
        status: application.status,
        lifetime: !!application.lifetime,
        expiresAt: toISO(application.expiresAt),
        version: String(application.version),
        errorOnUpdate: !!application.errorOnUpdate,
        errorOnUpdateMessage: application.errorOnUpdateMessage || "",
        productId: String(application.productId),
        productName: product?.name || "Sem produto",
        appId: application.appId || null,
        online: metrics.online,
        memoryMB: metrics.memoryMB,
        memoryUsedMB: metrics.memoryUsedMB,
        uptime: metrics.uptime,
        needsUpdate: !!currentVersion && String(application.version) !== String(currentVersion),
    };
}

async function assertOwnsApp(appId: string, discordId: string) {
    const application = await getApplicationPopulated(appId);
    if (String(application.ownerId) !== discordId) {
        throw new ActionError("Você não possui esta aplicação.");
    }
    return application;
}

function enforceAppRateLimit(discordId: string, operation: string) {
    if (!checkRateLimit(`site:apps:${operation}:${discordId}`, { windowMs: 10_000, maxRequests: 3 })) {
        throw new ActionError("Muitas solicitações em sequência. Aguarde alguns segundos e tente novamente.");
    }
}

function revalidateApplication(appId: string) {
    invalidateInstanceStatus(appId);
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${appId}`);
}

export type AppControlResult = { ok: true } | { ok: false; error: string };

function appControlError(error: unknown): AppControlResult {
    return { ok: false, error: error instanceof Error ? error.message : "Não foi possível controlar a aplicação." };
}

export async function startApp(appId: string): Promise<AppControlResult> {
    try {
        const discordId = await requireSessionUser();
        enforceAppRateLimit(discordId, "start");
        const application = await assertOwnsApp(appId, discordId);
        await startApplication(String(application._id), discordId);
        revalidateApplication(appId);
        return { ok: true };
    } catch (error) { return appControlError(error); }
    /* legacy implementation kept temporarily for compatibility auditing
    const application = await assertOwnsApp(appId, discordId);
    const store = application.storeId;
    const storeId = String(store?._id || application.storeId);

    if (application.status !== "active") {
        throw new ActionError("A aplicação não está ativa. Não é possível iniciar.");
    }

    const sdk = await getStoreSdkInstance(storeId);
    const currentApplicationCampos = await getCamposApplication(sdk, application.appId);

    if (currentApplicationCampos.data.currentResourceMetrics?.online) {
        throw new ActionError("A aplicação já está online.");
    }

    await currentApplicationCampos.start();
    return { ok: true }; */
}

export async function stopApp(appId: string): Promise<AppControlResult> {
    try {
        const discordId = await requireSessionUser();
        enforceAppRateLimit(discordId, "stop");
        const application = await assertOwnsApp(appId, discordId);
        await stopApplication(String(application._id), discordId);
        revalidateApplication(appId);
        return { ok: true };
    } catch (error) { return appControlError(error); }
    /* legacy implementation kept temporarily for compatibility auditing
    const application = await assertOwnsApp(appId, discordId);
    const store = application.storeId;
    const storeId = String(store?._id || application.storeId);

    if (application.status !== "active") {
        throw new ActionError("A aplicação não está ativa. Não é possível parar.");
    }

    const sdk = await getStoreSdkInstance(storeId);
    const currentApplicationCampos = await getCamposApplication(sdk, application.appId);

    if (!currentApplicationCampos.data.currentResourceMetrics?.online) {
        throw new ActionError("A aplicação já está offline.");
    }

    await currentApplicationCampos.stop();
    return { ok: true }; */
}

export async function restartApp(appId: string): Promise<AppControlResult> {
    try {
        const discordId = await requireSessionUser();
        enforceAppRateLimit(discordId, "restart");
        const application = await assertOwnsApp(appId, discordId);
        await restartApplication(String(application._id), discordId);
        revalidateApplication(appId);
        return { ok: true };
    } catch (error) { return appControlError(error); }
    /* legacy implementation kept temporarily for compatibility auditing
    const application = await assertOwnsApp(appId, discordId);
    const store = application.storeId;
    const storeId = String(store?._id || application.storeId);

    if (application.status !== "active") {
        throw new ActionError("A aplicação não está ativa. Não é possível reiniciar.");
    }

    const sdk = await getStoreSdkInstance(storeId);
    const currentApplicationCampos = await getCamposApplication(sdk, application.appId);

    if (!currentApplicationCampos.data.currentResourceMetrics?.online) {
        throw new ActionError("A aplicação não está online. Não é possível reiniciar.");
    }

    await currentApplicationCampos.restart();
    return { ok: true }; */
}

export async function changeAppName(appId: string, name: string): Promise<{ ok: true }> {
    const discordId = await requireSessionUser();
    enforceAppRateLimit(discordId, "rename");
    const application = await assertOwnsApp(appId, discordId);
    await changeApplicationName(String(application._id), discordId, name);
    revalidateApplication(appId);
    return { ok: true };
    /* legacy implementation kept temporarily for compatibility auditing
    const application = await assertOwnsApp(appId, discordId);

    if (!name || !name.trim()) {
        throw new ActionError("O nome não pode ser vazio.");
    }
    if (name.trim().length > 40) {
        throw new ActionError("O nome não pode ter mais de 40 caracteres.");
    }

    application.name = name.trim();
    await application.save();
    return { ok: true }; */
}

export async function changeAppToken(appId: string, newToken: string): Promise<{ ok: true; botId: string }> {
    const discordId = await requireSessionUser();
    enforceAppRateLimit(discordId, "token");
    const application = await assertOwnsApp(appId, discordId);
    await changeApplicationToken(String(application._id), discordId, newToken);
    revalidateApplication(appId);
    const updated = await databases.applications.findById(application._id, { botId: 1 }).lean();
    if (!updated?.botId) throw new ActionError("Token atualizado, mas não foi possível confirmar o ID do bot.");
    return { ok: true, botId: updated.botId };
    /* legacy implementation kept temporarily for compatibility auditing
    const application = await assertOwnsApp(appId, discordId);
    const product = application.productId;
    const store = application.storeId;
    const storeId = String(store?._id || application.storeId);

    if (!newToken || !newToken.trim()) {
        throw new ActionError("O token não pode ser vazio.");
    }

    const botInfo = await axios
        .get(`https://discord.com/api/v10/applications/@me`, {
            headers: {
                "content-type": "application/json",
                Authorization: `Bot ${newToken.trim()}`,
            },
        })
        .catch(() => null);

    if (!botInfo?.data?.id) {
        throw new ActionError("Não foi possível obter informações do bot com o novo token. Verifique se o token está correto.");
    }

    const version = application.version || product?.currentReleaseVersion;
    if (!version) {
        throw new ActionError("Não foi possível determinar a versão da release. Verifique o produto.");
    }

    await releaseExists(String(product._id), String(version)).catch(() => {
        throw new ActionError(`Release ${version} do produto não encontrada no disco. Impossível reconstruir o pacote.`);
    });

    const sdk = await getStoreSdkInstance(storeId);
    const currentApplicationCampos = await getCamposApplication(sdk, application.appId);
    const runtime = getRuntimeEnvironment(product?.runtimeEnvironment);

    if (currentApplicationCampos.data.currentResourceMetrics?.online) {
        await sdk.stopApplication({ appId: application.appId || "" }).catch(() => null);
    }

    await currentApplicationCampos.updateApplication({
        appName: currentApplicationCampos.data.name,
        memoryMB: currentApplicationCampos.data.allocatedMemoryMB,
        runtimeEnvironment: runtime,
        startupCommand: currentApplicationCampos.data.startupCommand,
        environmentVariables: [
            { key: "BOT_TOKEN", value: newToken.trim() },
            { key: "BOT_TOKEN_DISCORD", value: newToken.trim() },
            { key: "TOKEN", value: newToken.trim() },
            { key: "DISCORD_TOKEN", value: newToken.trim() },
            { key: "OWNER_ID", value: discordId },
            { key: "APPLICATION_ID", value: String(application._id) },
            { key: "BOT_ID", value: botInfo.data.id },
            { key: "API_URL", value: "https://api.droxbot.com.br" },
            { key: "VERSION", value: String(version) },
            { key: "DROX_EMOJIS", value: "true" },
            { key: "SAVE_CONFIG", value: "false" },
            { key: "START_ON_BACKUP", value: "true" },
            { key: "SERVER_ID", value: store?.teamId_campos || "" },
            { key: "PERMS", value: discordId },
        ],
    });

    await redeployWithNewToken(currentApplicationCampos, String(product._id), String(version), buildHostedBotConfig({
        token: newToken.trim(),
        botId: botInfo.data.id,
        version: String(version),
        ownerId: discordId,
        appId: String(application._id),
        serverId: store?.teamId_campos,
    }));

    await currentApplicationCampos.start().catch(() => null);

    application.botId = botInfo.data.id;
    application.token = newToken.trim();
    await application.save();

    return { ok: true }; */
}

export interface BotGuildOption {
    id: string;
    name: string;
}

export async function listBotGuilds(appId: string): Promise<BotGuildOption[]> {
    const discordId = await requireSessionUser();
    enforceAppRateLimit(discordId, "guilds");
    const application = await assertOwnsApp(appId, discordId);
    return listApplicationGuilds(String(application._id), discordId);
    /* legacy implementation kept temporarily for compatibility auditing
    const application = await assertOwnsApp(appId, discordId);

    const response = await axios.get("https://discord.com/api/v10/users/@me/guilds", {
        headers: { Authorization: `Bot ${application.token}` },
        timeout: DISCORD_API_TIMEOUT_MS,
    }).catch(() => null);

    if (!response?.data || !Array.isArray(response.data)) {
        throw new ActionError("Não foi possível consultar os servidores do bot. Verifique o token.");
    }

    return response.data
        .filter((guild: unknown): guild is { id: string; name: string } => {
            return !!guild && typeof guild === "object" && "id" in guild && "name" in guild;
        })
        .map((guild) => ({ id: String(guild.id), name: String(guild.name) }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")); */
}

export async function changeAppMainServer(appId: string, serverId: string): Promise<{ ok: true }> {
    const discordId = await requireSessionUser();
    enforceAppRateLimit(discordId, "server");
    const application = await assertOwnsApp(appId, discordId);
    await changeApplicationMainServer(String(application._id), discordId, serverId);
    revalidateApplication(appId);
    return { ok: true };
    /* legacy implementation kept temporarily for compatibility auditing
    const application = await assertOwnsApp(appId, discordId);
    const product = application.productId;
    const store = application.storeId;
    const storeId = String(store?._id || application.storeId);

    if (!/^\d{17,20}$/.test(serverId)) {
        throw new ActionError("ID do servidor Discord inválido.");
    }

    const guilds = await listBotGuilds(appId);
    if (!guilds.some((guild) => guild.id === serverId)) {
        throw new ActionError("O bot não participa do servidor selecionado.");
    }

    const version = application.version || product?.currentReleaseVersion;
    if (!version) throw new ActionError("Não foi possível determinar a versão da release.");

    await releaseExists(String(product._id), String(version)).catch(() => {
        throw new ActionError(`Release ${version} do produto não encontrada no disco.`);
    });

    const sdk = await getStoreSdkInstance(storeId);
    const camposApp = await getCamposApplication(sdk, application.appId);
    const wasOnline = !!camposApp.data.currentResourceMetrics?.online;

    if (wasOnline) {
        await sdk.stopApplication({ appId: application.appId || "" });
    }

    await camposApp.updateApplication({
        appName: camposApp.data.name,
        memoryMB: camposApp.data.allocatedMemoryMB,
        runtimeEnvironment: getRuntimeEnvironment(product.runtimeEnvironment),
        startupCommand: camposApp.data.startupCommand,
        environmentVariables: [
            { key: "BOT_TOKEN", value: application.token },
            { key: "BOT_TOKEN_DISCORD", value: application.token },
            { key: "TOKEN", value: application.token },
            { key: "DISCORD_TOKEN", value: application.token },
            { key: "OWNER_ID", value: application.ownerId },
            { key: "APPLICATION_ID", value: String(application._id) },
            { key: "BOT_ID", value: application.botId },
            { key: "API_URL", value: "https://api.droxbot.com.br" },
            { key: "VERSION", value: String(version) },
            { key: "DROX_EMOJIS", value: "true" },
            { key: "SAVE_CONFIG", value: "false" },
            { key: "START_ON_BACKUP", value: "true" },
            { key: "SERVER_ID", value: serverId },
            { key: "PERMS", value: application.ownerId },
        ],
    });

    await redeployWithNewToken(camposApp, String(product._id), String(version), buildHostedBotConfig({
        botId: application.botId,
        version: String(version),
        ownerId: application.ownerId,
        appId: String(application._id),
        serverId,
    }));

    if (wasOnline) await camposApp.start();
    return { ok: true }; */
}

export async function getRenewPrices(appId: string): Promise<{ prices: RenewPrices; appName: string; productName: string }> {
    const discordId = await requireSessionUser();
    const application = await assertOwnsApp(appId, discordId);
    const product = application.productId;

    if (!product?.prices || (!product.prices.weekly && !product.prices.biweekly && !product.prices.monthly && !product.prices.lifetime)) {
        throw new ActionError("Este produto não possui preços definidos. Contate o administrador.");
    }

    return {
        prices: {
            weekly: product.prices?.weekly,
            biweekly: product.prices?.biweekly,
            monthly: product.prices?.monthly,
            lifetime: product.prices?.lifetime,
        },
        appName: application.name,
        productName: product.name || "Sem produto",
    };
}

export async function startRenew(appId: string, plan: "weekly" | "biweekly" | "monthly" | "lifetime"): Promise<{ cartId: string }> {
    const discordId = await requireSessionUser();
    const application = await assertOwnsApp(appId, discordId);
    const product = application.productId;
    const store = application.storeId;
    const storeId = String(store?._id || application.storeId);

    if (!product?.prices?.[plan]) {
        throw new ActionError("Preço não definido para este plano.");
    }
    if (application.lifetime) {
        throw new ActionError("A aplicação já é vitalícia.");
    }

    const price = product.prices[plan];
    const days = plan === "weekly" ? 7 : plan === "biweekly" ? 15 : plan === "monthly" ? 30 : null;

    const cart = await databases.cartsRenew.create({
        userId: discordId,
        applicationId: application._id,
        storeId,
        price,
        days: days ?? undefined,
        lifetime: plan === "lifetime",
        step: "select-coupons",
        expiresAt: new Date(Date.now() + RENEW_CART_EXPIRES_MINUTES * 60_000),
    });

    return { cartId: String(cart._id) };
}

export async function applyRenewCoupon(cartId: string, code: string): Promise<{ discount: number }> {
    const discordId = await requireSessionUser();
    const cart = await databases.cartsRenew.findOne({ _id: cartId, userId: discordId }, { applicationId: 1 }).populate("applicationId").lean();
    if (!cart) throw new ActionError("Carrinho não encontrado.");
    const application = cart.applicationId as unknown as IApplications;
    const result = await reserveCouponForCart({ cartType: "renew", cartId, userId: discordId, code, productId: String(application.productId) });
    return { discount: result.discount };
}

export async function generateRenewPayment(cartId: string): Promise<{
    qrcodeDataUrl: string;
    copyPaste: string;
    paymentId: string;
    finalPrice: number;
}> {
    const discordId = await requireSessionUser();
    const cart = (await databases.cartsRenew.findById(cartId).populate("coupon")) as unknown as CartRenewCouponPopulated | null;
    if (!cart) throw new ActionError("Carrinho não encontrado ou expirado.");
    if (String(cart.userId) !== discordId) throw new ActionError("Este carrinho não pertence a você.");
    if (cart.status !== "opened") throw new ActionError("Este carrinho não está mais aberto.");
    if (cart.step !== "select-coupons") throw new ActionError("Passo do carrinho inválido.");
    if (!cart.price) throw new ActionError("Carrinho sem preço definido.");

    const storeId = String(cart.storeId);
    const store = await databases.stores.findById(storeId);
    if (!store) throw new ActionError("Loja não encontrada.");

    const ownerSettings = await databases.userSettings.findOne(
        { userId_campos: store.ownerId_campos },
        { userId_discord: 1, efi_credentials: 1, payment_gateway: 1, manual_payment_credentials: 1, promissepay_credentials: 1, sharpify_credentials: 1 }
    );
    if (!ownerSettings) throw new ActionError("Dono da loja não configurado.");

    const coupon = cart.coupon;
    const couponDiscount = (cart.coupon ? coupon?.discount : 0) || 0;
    const priceWithDiscount = cart.price - cart.price * (couponDiscount / 100);
    const finalPrice = priceWithDiscount / (1 - PIX_TAX / 100);

    let qrcodeDataUrl = "";
    let copyPaste = "";
    let paymentId = "";

    if (ownerSettings.payment_gateway === "efi") {
        const efiInstance = await efiWrapper.getInstance(ownerSettings.userId_discord);
        if (!efiInstance || !efiInstance.isValid) {
            throw new ActionError("Não foi possível conectar-se ao gateway de pagamento.");
        }

        const pixKey = ownerSettings.efi_credentials?.pix_key;
        if (!pixKey) {
            throw new ActionError("O dono da loja não configurou a chave PIX do EFI.");
        }

        const txid = crypto.randomBytes(16).toString("hex").slice(0, 26);
        const payment = await efiInstance.instance
            .pixCreateCharge(
                { txid },
                {
                    calendario: { expiracao: 3600 },
                    valor: { original: finalPrice.toFixed(2) },
                    chave: pixKey,
                }
            )
            .catch((e: unknown) => {
                console.error("EFI create charge error:", e);
                return null;
            });

        if (!payment?.pixCopiaECola) {
            throw new ActionError("Não foi possível gerar o pagamento. Informe um administrador.");
        }

        qrcodeDataUrl = await QRCode.toDataURL(payment.pixCopiaECola, { errorCorrectionLevel: "M" });
        copyPaste = payment.pixCopiaECola;
        paymentId = payment.txid;
    } else if (ownerSettings.payment_gateway === "manual") {
        const manual = ownerSettings.manual_payment_credentials;
        if (!manual?.pix_key || !manual?.key_type) {
            throw new ActionError("O dono da loja não configurou as credenciais de pagamento manual.");
        }

        const qrcodeId = Math.random().toString(36).substring(2, 15);
        const qrCodePix = QrCodePix({
            version: "01",
            key: manual.pix_key,
            name: "ZUROS APP",
            city: "SAO PAULO",
            transactionId: qrcodeId,
            message: `Renovação do bot ${cart._id}`,
            value: finalPrice,
        });

        qrcodeDataUrl = await qrCodePix.base64();
        copyPaste = qrCodePix.payload();
    } else if (ownerSettings.payment_gateway === "promisse") {
        const promisse = ownerSettings.promissepay_credentials;
        if (!promisse?.api_key) {
            throw new ActionError("O dono da loja não configurou o PromissePay.");
        }

        const transaction = await promisseWrapper.createTransaction(promisse.api_key, Math.round(finalPrice * 100));
        if (!transaction) {
            throw new ActionError("Não foi possível gerar o pagamento via PromissePay.");
        }

        qrcodeDataUrl = `data:image/png;base64,${transaction.qrCodeBase64}`;
        copyPaste = transaction.copyPaste;
        paymentId = transaction.id;
    } else if (ownerSettings.payment_gateway === "sharpify") {
        const credentials = ownerSettings.sharpify_credentials;
        if (!credentials?.client_id || !credentials.client_secret) throw new ActionError("O administrador não configurou a Sharpify.");
        const transaction = await sharpifyWrapper.createTransaction({ client_id: credentials.client_id, client_secret: credentials.client_secret }, finalPrice, String(cart._id));
        if (!transaction) throw new ActionError("Não foi possível gerar o pagamento via Sharpify.");
        copyPaste = transaction.copyPaste;
        qrcodeDataUrl = await QRCode.toDataURL(copyPaste, { errorCorrectionLevel: "M" });
        paymentId = transaction.id;
    } else {
        throw new ActionError("O dono da loja não configurou o gateway de pagamento.");
    }

    cart.pix_qrcode = qrcodeDataUrl.split(",")[1] || qrcodeDataUrl;
    cart.pix_copy_and_paste = copyPaste;
    cart.paymentId = paymentId;
    cart.finalPrice = finalPrice;
    cart.step = "waiting-payment";
    cart.expiresAt = new Date(Date.now() + RENEW_CART_EXPIRES_MINUTES * 60_000);
    await cart.save();

    return { qrcodeDataUrl, copyPaste, paymentId, finalPrice };
}

export async function pollRenewCart(cartId: string): Promise<CartRenewView> {
    const discordId = await requireSessionUser();
    const cart = (await databases.cartsRenew.findById(cartId).populate("applicationId")) as unknown as CartRenewAppCouponPopulated | null;
    if (!cart) throw new ActionError("Carrinho não encontrado.");
    if (String(cart.userId) !== discordId) throw new ActionError("Este carrinho não pertence a você.");

    const application = cart.applicationId;
    return {
        id: String(cart._id),
        userId: cart.userId,
        appId: String(application?._id ?? cart.applicationId),
        appName: application?.name || "Aplicação",
        storeId: String(cart.storeId),
        price: cart.price || 0,
        finalPrice: cart.finalPrice || 0,
        days: cart.days || null,
        lifetime: !!cart.lifetime,
        couponCode: cart.coupon?.code || null,
        status: cart.status,
        step: cart.step,
        paymentId: cart.paymentId || null,
        expiresAt: toISO(cart.expiresAt),
        createdAt: toISO(cart._id.getTimestamp()),
    };
}

export async function listAppExtracts(appId: string): Promise<ExtractEntry[]> {
    const discordId = await requireSessionUser();
    const application = await assertOwnsApp(appId, discordId);
    const carts = (await databases.cartsRenew.find({
        applicationId: application._id,
        status: "closed",
        step: "payment-confirmed",
    })) as unknown as CartRenewDoc[];

    return carts.map((cart) => ({
        id: String(cart._id),
        price: cart.price || 0,
        finalPrice: cart.finalPrice || cart.price || 0,
        days: cart.days || null,
        lifetime: !!cart.lifetime,
        createdAt: toISO(cart._id.getTimestamp()),
    }));
}
