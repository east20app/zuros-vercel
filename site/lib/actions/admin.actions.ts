"use server";

import databases from "@root/src/databases";
import sdkWrapper from "@root/src/functions/camposcloud-sdk";
import efiWrapper from "@root/src/functions/efi_wrapper";
import promisseWrapper from "@root/src/functions/promisse_wrapper";
import sharpifyWrapper from "@root/src/functions/sharpify_wrapper";
import { changeBalance } from "@root/src/functions/extracts";
import { getUserHasPermissionOnStore, PermissionsStore } from "@root/src/functions/acl";
import { getProductReleases as getProductReleasesDTO } from "@root/src/integration/releases";
import { productMessageSchema, type ProductMessageDTO } from "@root/src/integration/dtos";
import CamposCloudSDK from "@camposcloud/sdk";
import axios from "axios";
import crypto from "node:crypto";
import type { Types, UpdateQuery } from "mongoose";
import type { IApplications } from "@root/src/databases/schemas/applications";
import type { ICartsBuy } from "@root/src/databases/schemas/carts-buy";
import type { ICartsRenew } from "@root/src/databases/schemas/carts-renew";
import type { ICoupons } from "@root/src/databases/schemas/coupons";
import type { IExtracts } from "@root/src/databases/schemas/extracts";
import type { IProducts } from "@root/src/databases/schemas/products";
import type { ISettings } from "@root/src/databases/schemas/user-settings";
import { releaseExists } from "@root/src/functions/hosted-bot";
import { processProductApplicationUpdates } from "@root/src/integration/application-updates";
import { releaseCouponReservation } from "@root/src/integration/coupon-reservations";
import { calculateCheckoutCents, fromCents } from "@root/src/integration/money";

import type {
    AppSummary,
    CartBuyView,
    CartRenewView,
    CouponView,
    ExtractView,
    PaymentGateway,
    ProductView,
    SettingsView,
    StoreView,
} from "@/lib/types";
import { ActionError, getStoreSdk, PRIMARY_ADMIN_STORE_ID, requireSessionUser } from "./context";

const VALID_RUNTIMES = ["nodejs", "python", "java", "go", "rust", "dotnet", "deno"];
const DISCORD_API_TIMEOUT_MS = 15_000;

async function requireBotOwner(): Promise<string> {
    const discordId = await requireSessionUser();
    if (!process.env.OWNER_ID || discordId !== process.env.OWNER_ID) {
        throw new ActionError("Apenas o proprietário do bot pode alterar esta configuração.");
    }
    return discordId;
}

type ProductDoc = IProducts;
type AppDoc = IApplications;
type CouponDoc = ICoupons & { _id: Types.ObjectId };
type ExtractDoc = IExtracts & { _id: Types.ObjectId; createdAt: Date };
type CartRenewDoc = ICartsRenew & { _id: Types.ObjectId };
type CartBuyDoc = ICartsBuy & { _id: Types.ObjectId };
interface ApprovalCartLike {
    _id: Types.ObjectId;
    storeId: unknown;
    step: string;
    status: string;
    price: number;
    couponDiscountSnapshot?: number;
    couponReservationState?: string;
    confirmedAt?: Date;
    confirmedBy?: string;
    paymentProvider?: string;
    paymentSource?: string;
    delivered?: boolean;
    deliveryState?: string;
    applicationId?: unknown;
    days?: number;
    lifetime?: boolean;
    paymentId?: string;
    save(): Promise<unknown>;
}
type ApprovalCart = ApprovalCartLike;
type AppPopulated = AppDoc & { productId: ProductDoc };
type CartRenewAppPopulated = CartRenewDoc & { applicationId: AppDoc; coupon: CouponDoc | null };
type CartBuyProductPopulated = CartBuyDoc & { productId: ProductDoc };

function toISO(date: unknown): string | null {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date as string);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

async function requireStoreAccess(discordId: string, storeId: string): Promise<void> {
    if (storeId !== PRIMARY_ADMIN_STORE_ID) throw new ActionError("Esta loja não está disponível neste painel.");
    const hasPermission = await getUserHasPermissionOnStore({
        userId: discordId,
        storeId,
        permission: PermissionsStore.ADMIN,
    });
    if (!hasPermission) {
        throw new ActionError("Você não tem permissão nesta loja.");
    }
}

async function getUserStoreIds(discordId: string): Promise<string[]> {
    if (process.env.OWNER_ID && discordId === process.env.OWNER_ID) {
        const store = await databases.stores.exists({ _id: PRIMARY_ADMIN_STORE_ID });
        return store ? [PRIMARY_ADMIN_STORE_ID] : [];
    }
    const settings = await databases.userSettings.findOne({ userId_discord: discordId }, { userId_campos: 1 });
    const stores = await databases.stores.find(
        {
            _id: PRIMARY_ADMIN_STORE_ID,
            $or: [
                { ownerId_campos: settings?.userId_campos || "__none__" },
                { permissions: { $elemMatch: { userId: discordId, permissions: PermissionsStore.ADMIN } } },
            ],
        },
        { _id: 1 }
    );
    return stores.map((s) => String(s._id));
}

export interface AdminOverview {
    storesCount: number;
    balance: number;
    applicationsCount: number;
    productsCount: number;
    couponsCount: number;
    pendingPaymentsCount: number;
    recentExtracts: ExtractView[];
}

export async function getAdminOverview(): Promise<AdminOverview> {
    const discordId = await requireSessionUser();
    const storeIds = await getUserStoreIds(discordId);

    const stores = await databases.stores.find({ _id: { $in: storeIds } });
    const balance = stores.reduce((acc, s) => acc + (s.balance || 0), 0);

    const [applicationsCount, productsCount, couponsCount] = await Promise.all([
        databases.applications.countDocuments({ storeId: { $in: storeIds } }),
        databases.products.countDocuments({ storeId: { $in: storeIds } }),
        databases.coupons.countDocuments({ storeId: { $in: storeIds } }),
    ]);

    const [pendingRenew, pendingBuy] = await Promise.all([
        databases.cartsRenew.countDocuments({ storeId: { $in: storeIds }, status: "opened", step: "waiting-payment" }),
        databases.cartsBuy.countDocuments({ storeId: { $in: storeIds }, status: "opened", step: "waiting-payment" }),
    ]);

    const recentExtracts = (await databases.extracts
        .find({ storeId: { $in: storeIds } })
        .sort({ createdAt: -1 })
        .limit(10)) as unknown as ExtractDoc[];

    return {
        storesCount: stores.length,
        balance,
        applicationsCount,
        productsCount,
        couponsCount,
        pendingPaymentsCount: pendingRenew + pendingBuy,
        recentExtracts: recentExtracts.map((e) => ({
            id: String(e._id),
            storeId: String(e.storeId),
            storeName: stores.find((s) => String(s._id) === String(e.storeId))?.name || "Loja",
            origin: e.origin,
            action: e.action,
            description: e.description || null,
            amount: e.amount,
            createdAt: toISO(e.createdAt) || "",
        })),
    };
}

export async function listAdminStores(): Promise<StoreView[]> {
    const discordId = await requireSessionUser();
    if (process.env.OWNER_ID && discordId === process.env.OWNER_ID) {
        const ownerStore = await databases.stores.find({ _id: PRIMARY_ADMIN_STORE_ID });
        return Promise.all(ownerStore.map(async (store) => ({
            id: String(store._id), name: store.name, balance: store.balance || 0,
            applicationsCount: await databases.applications.countDocuments({ storeId: store._id }),
            productsCount: await databases.products.countDocuments({ storeId: store._id }),
            couponsCount: await databases.coupons.countDocuments({ storeId: store._id }),
        })));
    }
    const stores = await databases.stores.find(
        {
            _id: PRIMARY_ADMIN_STORE_ID,
            $or: [
                { ownerId_campos: (await databases.userSettings.findOne({ userId_discord: discordId }, { userId_campos: 1 }))?.userId_campos || "__none__" },
                { ownerId_campos: `discord:${discordId}` },
                { permissions: { $elemMatch: { userId: discordId, permissions: PermissionsStore.ADMIN } } },
            ],
        }
    );

    const result: StoreView[] = [];
    for (const store of stores) {
        const [applicationsCount, productsCount, couponsCount] = await Promise.all([
            databases.applications.countDocuments({ storeId: store._id }),
            databases.products.countDocuments({ storeId: store._id }),
            databases.coupons.countDocuments({ storeId: store._id }),
        ]);
        result.push({
            id: String(store._id),
            name: store.name,
            balance: store.balance || 0,
            applicationsCount,
            productsCount,
            couponsCount,
        });
    }
    return result;
}

export interface StoreStats {
    store: StoreView;
    pendingRenew: number;
    pendingBuy: number;
    appsGracePeriod: number;
    appsWithError: number;
}

export async function getStoreStats(storeId: string): Promise<StoreStats> {
    const discordId = await requireSessionUser();
    await requireStoreAccess(discordId, storeId);

    const store = await databases.stores.findById(storeId);
    if (!store) throw new ActionError("Loja não encontrada.");

    const [applicationsCount, productsCount, couponsCount, pendingRenew, pendingBuy, appsGracePeriod, appsWithError] = await Promise.all([
        databases.applications.countDocuments({ storeId }),
        databases.products.countDocuments({ storeId }),
        databases.coupons.countDocuments({ storeId }),
        databases.cartsRenew.countDocuments({ storeId, status: "opened", step: "waiting-payment" }),
        databases.cartsBuy.countDocuments({ storeId, status: "opened", step: "waiting-payment" }),
        databases.applications.countDocuments({ storeId, status: "grace_period" }),
        databases.applications.countDocuments({ storeId, errorOnUpdate: true }),
    ]);

    return {
        store: {
            id: String(store._id),
            name: store.name,
            balance: store.balance || 0,
            applicationsCount,
            productsCount,
            couponsCount,
        },
        pendingRenew,
        pendingBuy,
        appsGracePeriod,
        appsWithError,
    };
}

export async function listStoreApps(storeId: string): Promise<AppSummary[]> {
    const discordId = await requireSessionUser();
    await requireStoreAccess(discordId, storeId);

    const apps = (await databases.applications.find({ storeId }).populate("productId")) as unknown as AppPopulated[];
    return apps.map((app) => {
        const product = app.productId;
        return {
            id: String(app._id),
            name: app.name,
            status: app.status,
            lifetime: !!app.lifetime,
            expiresAt: toISO(app.expiresAt),
            version: String(app.version),
            errorOnUpdate: !!app.errorOnUpdate,
            productName: product?.name || "Sem produto",
            storeId,
            storeName: "",
            ownerId: app.ownerId,
            botId: app.botId,
        };
    });
}

export interface StoreAdministrationView {
    id: string;
    name: string;
    logsAndRoles: { sales: string; renovations: string; transferOwnership: string; expiredApplication: string; customerRole: string };
    permissions: Array<{ userId: string; permissions: string[] }>;
}

export async function getStoreAdministration(storeId: string): Promise<StoreAdministrationView> {
    const discordId = await requireSessionUser();
    await requireStoreAccess(discordId, storeId);
    const store = await databases.stores.findById(storeId).lean();
    if (!store) throw new ActionError("Loja não encontrada.");
    return {
        id: String(store._id), name: store.name,
        logsAndRoles: {
            sales: store.logsAndRoles?.sales || "", renovations: store.logsAndRoles?.renovations || "",
            transferOwnership: store.logsAndRoles?.transferOwnership || "", expiredApplication: store.logsAndRoles?.expiredApplication || "",
            customerRole: store.logsAndRoles?.customerRole || "",
        },
        permissions: (store.permissions || []).map((item) => ({ userId: item.userId, permissions: [...item.permissions] })),
    };
}

export async function createStore(name: string): Promise<{ id: string }> {
    const discordId = await requireBotOwner();
    const normalized = name.trim();
    if (!normalized || normalized.length > 60) throw new ActionError("Informe um nome de loja com até 60 caracteres.");
    const settings = await databases.userSettings.findOne({ userId_discord: discordId }, { userId_campos: 1 });
    const ownerId = settings?.userId_campos || "discord:" + discordId;
    if (await databases.stores.exists({ _id: PRIMARY_ADMIN_STORE_ID })) {
        throw new ActionError("A loja principal já existe.");
    }
    const store = await databases.stores.create({ _id: PRIMARY_ADMIN_STORE_ID, name: normalized, ownerId_campos: ownerId, permissions: [] });
    return { id: String(store._id) };
}

export async function updateStoreAdministration(storeId: string, input: { name: string; logsAndRoles: StoreAdministrationView["logsAndRoles"] }): Promise<{ ok: true }> {
    const discordId = await requireSessionUser();
    await requireStoreAccess(discordId, storeId);
    const name = input.name.trim();
    if (!name || name.length > 60) throw new ActionError("Nome da loja inválido.");
    const cleanId = (value: string) => value.trim() && /^\d{15,25}$/.test(value.trim()) ? value.trim() : null;
    await databases.stores.updateOne({ _id: storeId }, { $set: { name, logsAndRoles: {
        sales: cleanId(input.logsAndRoles.sales), renovations: cleanId(input.logsAndRoles.renovations),
        transferOwnership: cleanId(input.logsAndRoles.transferOwnership), expiredApplication: cleanId(input.logsAndRoles.expiredApplication),
        customerRole: cleanId(input.logsAndRoles.customerRole),
    } } });
    return { ok: true };
}

export async function saveStorePermission(storeId: string, userId: string, permissions: string[]): Promise<{ ok: true }> {
    const discordId = await requireSessionUser();
    await requireStoreAccess(discordId, storeId);
    if (!/^\d{15,25}$/.test(userId.trim())) throw new ActionError("ID do usuário Discord inválido.");
    const allowed = new Set(Object.values(PermissionsStore));
    const selected = permissions.filter((permission) => allowed.has(permission as PermissionsStore));
    await databases.stores.updateOne({ _id: storeId }, { $pull: { permissions: { userId: userId.trim() } } });
    await databases.stores.updateOne({ _id: storeId }, { $push: { permissions: { userId: userId.trim(), permissions: selected } } });
    return { ok: true };
}

export async function removeStorePermission(storeId: string, userId: string): Promise<{ ok: true }> {
    const discordId = await requireSessionUser();
    await requireStoreAccess(discordId, storeId);
    await databases.stores.updateOne({ _id: storeId }, { $pull: { permissions: { userId } } });
    return { ok: true };
}

export async function deleteStore(storeId: string, confirmation: string): Promise<{ ok: true }> {
    const discordId = await requireSessionUser();
    await requireStoreAccess(discordId, storeId);
    const store = await databases.stores.findById(storeId);
    if (!store) throw new ActionError("Loja não encontrada.");
    if (confirmation !== store.name) throw new ActionError("Digite o nome exato da loja para confirmar.");
    if (await databases.applications.exists({ storeId })) throw new ActionError("Remova as aplicações da loja antes de excluí-la.");
    await Promise.all([databases.products.deleteMany({ storeId }), databases.coupons.deleteMany({ storeId }), databases.stores.deleteOne({ _id: storeId })]);
    return { ok: true };
}

export async function deleteStoreApplication(appId: string): Promise<{ ok: true }> {
    const discordId = await requireSessionUser();
    const application = await databases.applications.findById(appId);
    if (!application) throw new ActionError("Aplicação não encontrada.");
    const storeId = String(application.storeId);
    await requireStoreAccess(discordId, storeId);

    if (application.appId) {
        const sdk = await getStoreSdk(storeId);
        if (!sdk) throw new ActionError("Não foi possível conectar à hospedagem. A aplicação não foi removida.");
        try {
            await sdk.deleteApplication({ appId: application.appId });
        } catch (error: unknown) {
            const status = axios.isAxiosError(error) ? error.response?.status : undefined;
            if (status !== 404) throw new ActionError("A hospedagem recusou a exclusão. Nenhum dado local foi removido.");
        }
    }

    await databases.applications.deleteOne({ _id: application._id, storeId: application.storeId });
    return { ok: true };
}

export async function controlStoreApplication(appId: string, operation: "start" | "stop" | "restart"): Promise<{ ok: true }> {
    const discordId = await requireSessionUser();
    const application = await databases.applications.findById(appId);
    if (!application) throw new ActionError("Aplicação não encontrada.");
    await requireStoreAccess(discordId, String(application.storeId));
    if (!application.appId) throw new ActionError("Aplicação sem identificador de hospedagem.");
    const sdk = await getStoreSdk(String(application.storeId));
    if (!sdk) throw new ActionError("Serviço de hospedagem indisponível.");
    const hosted = await sdk.getApplication({ appId: application.appId }).catch(() => null);
    if (!hosted) throw new ActionError("Aplicação não encontrada na hospedagem.");
    if (operation === "start") await hosted.start();
    else if (operation === "stop") await hosted.stop();
    else await hosted.restart();
    return { ok: true };
}

export async function updateStoreApplication(appId: string, input: { name?: string; ownerId?: string; days?: number; hours?: number; minutes?: number; lifetime?: boolean }): Promise<{ ok: true }> {
    const discordId = await requireSessionUser();
    const application = await databases.applications.findById(appId);
    if (!application) throw new ActionError("Aplicação não encontrada.");
    await requireStoreAccess(discordId, String(application.storeId));
    if (input.name !== undefined) {
        const name = input.name.trim(); if (!name || name.length > 40) throw new ActionError("Nome inválido."); application.name = name;
    }
    if (input.ownerId !== undefined) {
        if (!/^\d{15,25}$/.test(input.ownerId.trim())) throw new ActionError("ID do novo proprietário inválido.");
        application.ownerId = input.ownerId.trim();
    }
    if (input.lifetime !== undefined) application.lifetime = input.lifetime;
    if (input.lifetime) application.expiresAt = undefined;
    else if (input.days !== undefined || input.hours !== undefined || input.minutes !== undefined) {
        const milliseconds = Math.max(0, input.days || 0) * 86_400_000 + Math.max(0, input.hours || 0) * 3_600_000 + Math.max(0, input.minutes || 0) * 60_000;
        if (!milliseconds) throw new ActionError("Informe uma duração válida.");
        application.expiresAt = new Date(Date.now() + milliseconds); application.status = "active";
    }
    await application.save(); return { ok: true };
}

export async function getStoreProducts(storeId: string): Promise<ProductView[]> {
    const discordId = await requireSessionUser();
    await requireStoreAccess(discordId, storeId);

    const products = await databases.products.find({ storeId });
    const store = await databases.stores.findById(storeId, { name: 1 });

    const result: ProductView[] = [];
    for (const product of products) {
        const [applicationsCount, pendingUpdate, errorUpdate] = await Promise.all([
            databases.applications.countDocuments({ productId: product._id }),
            databases.applications.countDocuments({ productId: product._id, $or: [{ version: { $ne: product.currentReleaseVersion } }, { forceUpdate: true }] }),
            databases.applications.countDocuments({ productId: product._id, errorOnUpdate: true }),
        ]);

        const releases = (product.releases || []).map((r) => ({
            id: String(r._id),
            version: r.version,
            date: toISO(r.date) || "",
            isCurrent: String(r.version) === String(product.currentReleaseVersion),
        }));
        const prices = product.prices;

        result.push({
            id: String(product._id),
            storeId,
            storeName: store?.name || "",
            name: product.name,
            productType: product.productType || "bot",
            authSettings: { plan: product.authSettings?.plan || "basic", servers: product.authSettings?.servers || 1, verifiedUsers: product.authSettings?.verifiedUsers || 1000, features: [...(product.authSettings?.features || [])] },
            runtimeEnvironment: product.runtimeEnvironment,
            runCommand: product.runCommand,
            needToUpdateApplications: !!product.needToUpdateApplications,
            // Mongoose nested documents have a toJSON method and cannot cross
            // the Server/Client Component boundary. Copy only scalar values.
            prices: {
                ...(typeof prices?.weekly === "number" ? { weekly: prices.weekly } : {}),
                ...(typeof prices?.biweekly === "number" ? { biweekly: prices.biweekly } : {}),
                ...(typeof prices?.monthly === "number" ? { monthly: prices.monthly } : {}),
                ...(typeof prices?.lifetime === "number" ? { lifetime: prices.lifetime } : {}),
            },
            currentReleaseVersion: product.currentReleaseVersion || null,
            lastReleaseCreatedVersion: product.lastReleaseCreatedVersion || "0.0.0",
            protectedFiles: product.protectedFiles || [],
            redeemSettings: { active: !!product.redeemSettings?.active, days: product.redeemSettings?.days, webhook: product.redeemSettings?.webhook },
            memoryMB: product.memoryMB || 256,
            messageSettings: {
                description: product.messageSettings?.description || "",
                banner: product.messageSettings?.banner || "",
                video: product.messageSettings?.video || "",
                buttonName: product.messageSettings?.buttonName || "Comprar",
            },
            applicationsCount,
            pendingUpdateApplications: pendingUpdate,
            errorOnUpdateApplications: errorUpdate,
            releases,
        });
    }
    return result;
}

export async function getProductReleases(storeId: string, productId: string) {
    const requesterId = await requireSessionUser();
    return getProductReleasesDTO({ requesterId, storeId, productId });
}

export async function setCurrentProductRelease(productId: string, version: string): Promise<{ ok: true; warning?: string }> {
    const discordId = await requireSessionUser();
    const product = await databases.products.findById(productId);
    if (!product) throw new ActionError("Produto não encontrado.");
    await requireStoreAccess(discordId, String(product.storeId));

    if (product.needToUpdateApplications) {
        throw new ActionError("Aguarde a atualização atual das aplicações terminar antes de trocar a release.");
    }
    const release = product.releases?.find((item) => item.version === version);
    if (!release) throw new ActionError("Release não encontrada.");
    if (product.currentReleaseVersion === release.version) return { ok: true };
    if (!await releaseExists(String(product._id), release.version).catch(() => false)) {
        throw new ActionError("O arquivo ZIP desta release não está disponível. Envie a release novamente antes de defini-la como atual.");
    }

    product.currentReleaseVersion = release.version;
    product.needToUpdateApplications = true;
    await product.save();
    const queued = await databases.applications.updateMany(
        { productId: product._id },
        { $set: { updateAttempts: 0, errorOnUpdate: false }, $unset: { errorOnUpdateMessage: "", updateLeaseUntil: "" } },
    );
    let warning: string | undefined;
    if (queued.matchedCount > 0) {
        try {
            await processProductApplicationUpdates(String(product._id));
        } catch (error) {
            // Erros de ambiente (SDK indisponível, arquivo sem legibilidade)
            // não podem travar a troca de release para sempre: o cron continua
            // tentando e o admin recebe um aviso claro em vez de um bloqueio mudo.
            const detail = error instanceof Error ? error.message : "Falha ao iniciar a atualização automática.";
            warning = `A release foi definida como atual, mas a atualização automática não pôde começar agora (${detail}). O sistema continuará tentando.`;
            console.error("[setCurrentProductRelease] Atualização automática adiada:", detail);
        }
    }
    return { ok: true, warning };
}

export async function retryProductUpdates(productId: string): Promise<{ count: number }> {
    const discordId = await requireSessionUser(); const product = await databases.products.findById(productId);
    if (!product) throw new ActionError("Produto não encontrado."); await requireStoreAccess(discordId, String(product.storeId));
    const result = await databases.applications.updateMany({ productId: product._id, errorOnUpdate: true }, { $set: { updateAttempts: 0, errorOnUpdate: false }, $unset: { errorOnUpdateMessage: "" } });
    if (result.modifiedCount) { product.needToUpdateApplications = true; await product.save(); }
    return { count: result.modifiedCount };
}

export async function forceUpdateAllProductApplications(productId: string): Promise<{ count: number; updated: number; failed: number; pending: number }> {
    const discordId = await requireSessionUser();
    const product = await databases.products.findById(productId);
    if (!product) throw new ActionError("Produto não encontrado.");
    await requireStoreAccess(discordId, String(product.storeId));
    if (!product.currentReleaseVersion) throw new ActionError("Defina uma release atual antes de atualizar os bots.");
    if (!await releaseExists(String(product._id), product.currentReleaseVersion).catch(() => false)) {
        throw new ActionError("O arquivo da release atual não está disponível.");
    }
    const result = await databases.applications.updateMany(
        { productId: product._id },
        { $set: { forceUpdate: true, updateAttempts: 0, errorOnUpdate: false }, $unset: { errorOnUpdateMessage: "" } },
    );
    product.needToUpdateApplications = result.matchedCount > 0;
    await product.save();
    if (!result.matchedCount) return { count: 0, updated: 0, failed: 0, pending: 0 };
    const processed = await processProductApplicationUpdates(String(product._id));
    return { count: result.matchedCount, updated: processed.updated, failed: processed.failed, pending: processed.pending };
}
export interface ProductInput {
    name: string;
    productType?: "bot" | "auth" | "complete";
    authSettings?: { plan: "basic" | "cloud" | "pro"; servers?: number; verifiedUsers?: number; features?: string[] };
    runtimeEnvironment: string;
    runCommand: string;
    needToUpdateApplications?: boolean;
    memoryMB?: number;
    prices?: { weekly?: number; biweekly?: number; monthly?: number; lifetime?: number };
    messageSettings?: ProductMessageDTO;
    protectedFiles?: string[];
    redeemSettings?: { active: boolean; days?: number; webhook?: string };
}

export async function createProduct(storeId: string, input: ProductInput): Promise<{ id: string }> {
    const discordId = await requireSessionUser();
    await requireStoreAccess(discordId, storeId);

    if (!input.name || !input.name.trim()) throw new ActionError("Nome do produto é obrigatório.");
    const productType = input.productType || "bot";
    if (productType !== "auth" && !VALID_RUNTIMES.includes(input.runtimeEnvironment)) throw new ActionError("Runtime inválido.");
    if (productType !== "auth" && (!input.runCommand || !input.runCommand.trim())) throw new ActionError("Comando de execução é obrigatório.");

    const product = await databases.products.create({
        storeId,
        name: input.name.trim(),
        productType,
        authSettings: productType !== "bot" ? input.authSettings : undefined,
        runtimeEnvironment: input.runtimeEnvironment,
        runCommand: productType === "auth" ? "saas" : input.runCommand.trim(),
        needToUpdateApplications: !!input.needToUpdateApplications,
        memoryMB: input.memoryMB || 256,
        prices: input.prices || {},
        messageSettings: input.messageSettings ? productMessageSchema.parse(input.messageSettings) : undefined,
        protectedFiles: input.protectedFiles || [],
        redeemSettings: input.redeemSettings,
    });

    return { id: String(product._id) };
}

export async function updateProduct(productId: string, input: Partial<ProductInput>): Promise<{ ok: true }> {
    const discordId = await requireSessionUser();
    const product = await databases.products.findById(productId);
    if (!product) throw new ActionError("Produto não encontrado.");
    await requireStoreAccess(discordId, String(product.storeId));

    if (input.name !== undefined) {
        if (!input.name.trim()) throw new ActionError("Nome do produto não pode ser vazio.");
        product.name = input.name.trim();
    }
    if (input.productType !== undefined) product.productType = input.productType;
    if (input.authSettings !== undefined) product.authSettings = input.authSettings;
    if (input.runtimeEnvironment !== undefined) {
        if ((input.productType || product.productType) !== "auth" && !VALID_RUNTIMES.includes(input.runtimeEnvironment)) throw new ActionError("Runtime inválido.");
        product.runtimeEnvironment = input.runtimeEnvironment as IProducts["runtimeEnvironment"];
    }
    if (input.runCommand !== undefined) {
        if (!input.runCommand.trim()) throw new ActionError("Comando de execução não pode ser vazio.");
        product.runCommand = input.runCommand.trim();
    }
    if (input.needToUpdateApplications !== undefined) product.needToUpdateApplications = input.needToUpdateApplications;
    if (input.memoryMB !== undefined) product.memoryMB = input.memoryMB;
    if (input.prices !== undefined) product.prices = { ...(product.prices || {}), ...input.prices };
    if (input.messageSettings !== undefined) product.messageSettings = productMessageSchema.parse(input.messageSettings);
    if (input.protectedFiles !== undefined) product.protectedFiles = input.protectedFiles.map((item) => item.trim()).filter(Boolean).slice(0, 100);
    if (input.redeemSettings !== undefined) product.redeemSettings = input.redeemSettings;

    await product.save();
    return { ok: true };
}

export async function publishProductToDiscord(productId: string, channelId: string): Promise<{ ok: true }> {
    const discordId = await requireSessionUser();
    const product = await databases.products.findById(productId);
    if (!product) throw new ActionError("Produto não encontrado.");
    await requireStoreAccess(discordId, String(product.storeId));
    if (!/^\d{15,25}$/.test(channelId.trim())) throw new ActionError("ID do canal Discord inválido.");
    const token = process.env.BOT_TOKEN; if (!token) throw new ActionError("Bot Discord não configurado.");
    const prices = Object.entries(product.prices || {}).filter(([, value]) => typeof value === "number" && value > 0).map(([plan, value]) => `${plan}: R$ ${Number(value).toFixed(2)}`).join(" • ");
    const payload = {
        embeds: [{ title: product.name, description: product.messageSettings?.description || "Produto disponível", color: 0x10b981, image: product.messageSettings?.banner ? { url: product.messageSettings.banner } : undefined, fields: prices ? [{ name: "Planos", value: prices }] : undefined }],
        components: [{ type: 1, components: [{ type: 2, style: 3, label: product.messageSettings?.buttonName || "Comprar", custom_id: `buy-product:${product.storeId}:${product._id}` }, ...(product.messageSettings?.video ? [{ type: 2, style: 5, label: "Vídeo demonstrativo", url: product.messageSettings.video }] : [])] }],
    };
    const response = await axios.post(`https://discord.com/api/v10/channels/${channelId.trim()}/messages`, payload, { headers: { Authorization: `Bot ${token}` }, timeout: DISCORD_API_TIMEOUT_MS }).catch(() => null);
    if (!response?.data?.id) throw new ActionError("Não foi possível publicar. Verifique o canal e as permissões do bot.");
    product.messageSettings = { ...(product.messageSettings || {}), channelId: channelId.trim(), messageId: String(response.data.id) };
    await product.save(); return { ok: true };
}

export async function deleteProduct(productId: string): Promise<{ ok: true }> {
    const discordId = await requireSessionUser();
    const product = await databases.products.findById(productId);
    if (!product) throw new ActionError("Produto não encontrado.");
    await requireStoreAccess(discordId, String(product.storeId));

    await product.deleteOne();
    return { ok: true };
}

export async function listCoupons(storeId: string): Promise<CouponView[]> {
    const discordId = await requireSessionUser();
    await requireStoreAccess(discordId, storeId);

    const coupons = await databases.coupons.find({ storeId });
    const store = await databases.stores.findById(storeId, { name: 1 });
    const products = await databases.products.find({ storeId }, { name: 1 });

    return coupons.map((coupon) => {
        const productsList = coupon.products || ["all"];
        const names = productsList.includes("all")
            ? "Todos os produtos"
            : productsList
                  .map((id) => products.find((p) => String(p._id) === id)?.name)
                  .filter(Boolean)
                  .join(", ") || "—";

        return {
            id: String(coupon._id),
            storeId,
            storeName: store?.name || "",
            code: coupon.code,
            discount: coupon.discount,
            remainingUses: coupon.remainingUses,
            expiresAt: toISO(coupon.expiresAt) || "",
            roles: coupon.roles || [],
            products: productsList,
            applicableProductNames: names,
            valid: !!coupon.expiresAt && new Date(coupon.expiresAt) > new Date() && coupon.remainingUses > 0,
        };
    });
}

export interface CouponInput {
    code: string;
    discount: number;
    remainingUses: number;
    expiresAt: string;
    roles?: string[];
    products?: string[];
}

export async function createCoupon(storeId: string, input: CouponInput): Promise<{ id: string }> {
    const discordId = await requireSessionUser();
    await requireStoreAccess(discordId, storeId);

    if (!input.code || !input.code.trim()) throw new ActionError("Código do cupom é obrigatório.");
    if (!Number.isFinite(input.discount) || input.discount < 0 || input.discount > 100) {
        throw new ActionError("Desconto deve ser entre 0 e 100.");
    }
    if (!Number.isFinite(input.remainingUses) || input.remainingUses < 0) {
        throw new ActionError("Usos restantes inválidos.");
    }
    if (!input.expiresAt || isNaN(new Date(input.expiresAt).getTime())) {
        throw new ActionError("Data de expiração inválida.");
    }

    const existing = await databases.coupons.findOne({ code: input.code.trim() });
    if (existing) throw new ActionError("Já existe um cupom com esse código.");

    const coupon = await databases.coupons.create({
        storeId,
        code: input.code.trim(),
        discount: input.discount,
        remainingUses: input.remainingUses,
        expiresAt: new Date(input.expiresAt),
        roles: input.roles || [],
        products: input.products && input.products.length ? input.products : ["all"],
    });

    return { id: String(coupon._id) };
}

export async function deleteCoupon(couponId: string): Promise<{ ok: true }> {
    const discordId = await requireSessionUser();
    const coupon = await databases.coupons.findById(couponId);
    if (!coupon) throw new ActionError("Cupom não encontrado.");
    await requireStoreAccess(discordId, String(coupon.storeId));

    await coupon.deleteOne();
    return { ok: true };
}

export interface PendingPayments {
    renew: (CartRenewView & { appName: string })[];
    buy: (CartBuyView & { productName: string })[];
}

export interface OpenCartEntry {
    id: string;
    type: "renew" | "buy";
    userId: string;
    channelId: string | null;
    itemName: string;
    step: string;
    price: number;
    finalPrice: number;
    days: number | null;
    lifetime: boolean;
    automaticPayment: boolean | null;
    paymentId: string | null;
    expiresAt: string | null;
    createdAt: string;
}

export async function listOpenCarts(storeId: string): Promise<OpenCartEntry[]> {
    const discordId = await requireSessionUser();
    await requireStoreAccess(discordId, storeId);

    const [renewCarts, buyCarts] = await Promise.all([
        databases.cartsRenew
            .find({ storeId, status: "opened" })
            .populate("applicationId")
            .sort({ _id: -1 }),
        databases.cartsBuy
            .find({ storeId, status: "opened" })
            .populate("productId")
            .sort({ _id: -1 }),
    ]) as unknown as [CartRenewAppPopulated[], CartBuyProductPopulated[]];

    const renew: OpenCartEntry[] = renewCarts.map((cart) => ({
        id: String(cart._id),
        type: "renew",
        userId: cart.userId,
        channelId: cart.channelId || null,
        itemName: cart.applicationId?.name || "Aplicação",
        step: cart.step,
        price: cart.price || 0,
        finalPrice: cart.finalPrice || 0,
        days: cart.days || null,
        lifetime: !!cart.lifetime,
        automaticPayment: null,
        paymentId: cart.paymentId || null,
        expiresAt: toISO(cart.expiresAt),
        createdAt: toISO(cart._id.getTimestamp()) || "",
    }));

    const buy: OpenCartEntry[] = buyCarts.map((cart) => ({
        id: String(cart._id),
        type: "buy",
        userId: cart.userId,
        channelId: cart.channelId || null,
        itemName: cart.productId?.name || "Produto",
        step: cart.step,
        price: cart.price || 0,
        finalPrice: cart.finalPrice || 0,
        days: cart.days || null,
        lifetime: !!cart.lifetime,
        automaticPayment: !!cart.automaticPayment,
        paymentId: cart.paymentId || null,
        expiresAt: toISO(cart.expiresAt),
        createdAt: toISO(cart._id.getTimestamp()) || "",
    }));

    return [...renew, ...buy].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listPendingPayments(storeId?: string): Promise<PendingPayments> {
    const discordId = await requireSessionUser();
    if (storeId) await requireStoreAccess(discordId, storeId);
    const storeIds = storeId ? [storeId] : await getUserStoreIds(discordId);
    if (!storeIds.length) return { renew: [], buy: [] };

    const renewCarts = (await databases.cartsRenew
        .find({ storeId: { $in: storeIds }, status: "opened", step: "waiting-payment" })
        .populate("applicationId")
        .sort({ expiresAt: 1 })) as unknown as CartRenewAppPopulated[];

    const buyCarts = (await databases.cartsBuy
        .find({ storeId: { $in: storeIds }, status: "opened", step: "waiting-payment" })
        .populate("productId")
        .sort({ expiresAt: 1 })) as unknown as CartBuyProductPopulated[];

    const renew = renewCarts.map((cart) => ({
        id: String(cart._id),
        userId: cart.userId,
        appId: String(cart.applicationId),
        appName: cart.applicationId?.name || "Aplicação",
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
    }));

    const buy = buyCarts.map((cart) => ({
        id: String(cart._id),
        channelId: cart.channelId,
        userId: cart.userId,
        guildId: cart.guildId,
        storeId: String(cart.storeId),
        productId: String(cart.productId),
        productName: cart.productId?.name || "Produto",
        price: cart.price || 0,
        finalPrice: cart.finalPrice || 0,
        automaticPayment: !!cart.automaticPayment,
        status: cart.status,
        step: cart.step,
        paymentId: cart.paymentId || null,
        expiresAt: toISO(cart.expiresAt),
        createdAt: toISO(cart._id.getTimestamp()),
    }));

    return { renew, buy };
}

export async function approvePayment(args: { type: "renew" | "buy"; id: string; addBalance: boolean }): Promise<{ ok: true }> {
    const discordId = await requireSessionUser();
    const cartType = args.type === "renew" ? "renew" : "buy";

    const cart: ApprovalCart | null =
        (cartType === "renew" ? await databases.cartsRenew.findById(args.id) : await databases.cartsBuy.findById(args.id)) as unknown as ApprovalCart | null;
    if (!cart) throw new ActionError("Carrinho não encontrado.");
    await requireStoreAccess(discordId, String(cart.storeId));

    if (cart.step !== "waiting-payment") {
        throw new ActionError("Para aprovar o carrinho, ele deve estar no passo de pagamento.");
    }
    if (cart.status === "cancelled" || cart.status === "closed") {
        throw new ActionError("Este carrinho não está disponível para aprovação.");
    }

    if (args.addBalance) {
        // Considera o cupom já aplicado na reserva para não supercreditar o saldo.
        const discount = Number(cart.couponDiscountSnapshot ?? 0);
        const prices = calculateCheckoutCents(Number(cart.price || 0), discount, 1.2);
        const operationKey = `sale:manual:${cartType}:${args.id}`;
        const existingLedger = await databases.ledgerOperations.exists({ operationKey });
        if (!existingLedger) {
            await databases.stores.updateOne({ _id: cart.storeId, creditedOperationKeys: { $ne: operationKey } }, { $inc: { balance: fromCents(prices.netCents) }, $addToSet: { creditedOperationKeys: operationKey } });
            await databases.ledgerOperations.updateOne({ operationKey }, { $setOnInsert: { operationKey, cartType, cartId: args.id, storeId: String(cart.storeId), externalPaymentId: String(cart.paymentId || `manual:${args.id}`), provider: "manual", amountCents: prices.netCents, state: "applied", appliedAt: new Date() } }, { upsert: true });
            await databases.extracts.updateOne({ operationKey }, { $setOnInsert: { operationKey, origin: "sales", action: "add", amount: fromCents(prices.netCents), description: `${cartType === "renew" ? "Renovação" : "Carrinho"} aprovado pelo painel (${discordId})`, storeId: String(cart.storeId) } }, { upsert: true });
        }
    }

    cart.status = cartType === "renew" ? "closed" : "opened";
    cart.step = "payment-confirmed";
    cart.delivered = cartType === "renew";
    if (cartType === "renew") cart.deliveryState = "delivered";
    cart.confirmedAt = new Date();
    cart.confirmedBy = `manual:${discordId}`;
    cart.paymentProvider = "manual";
    cart.paymentSource = "manual";
    if (cart.couponReservationState === "reserved") cart.couponReservationState = "consumed";
    await cart.save();

    if (cartType === "renew") {
        const application = await databases.applications.findOne({ _id: cart.applicationId, storeId: cart.storeId });
        if (application) {
            if (cart.lifetime) {
                application.lifetime = true;
            } else if (cart.days) {
                const base = application.expiresAt ? new Date(application.expiresAt) : new Date();
                application.expiresAt = new Date(base.getTime() + cart.days * 24 * 60 * 60 * 1000);
                application.status = "active";
            }
            await application.save();
        }
    }
    return { ok: true };
}

export async function rejectPayment(args: { type: "renew" | "buy"; id: string }): Promise<{ ok: true }> {
    const discordId = await requireSessionUser();
    const cartType = args.type === "renew" ? "renew" : "buy";

    const cart: ApprovalCart | null =
        (cartType === "renew" ? await databases.cartsRenew.findById(args.id) : await databases.cartsBuy.findById(args.id)) as unknown as ApprovalCart | null;
    if (!cart) throw new ActionError("Carrinho não encontrado.");
    await requireStoreAccess(discordId, String(cart.storeId));
    if (cart.status === "cancelled" || cart.status === "closed") throw new ActionError("Este carrinho já foi encerrado.");

    // Devolve o uso do cupom reservado para não vazá-lo em rejeições.
    const released = await releaseCouponReservation({ cartType, cartId: args.id }).catch(() => ({ released: false as const }));
    cart.status = "cancelled";
    cart.deliveryState = "cancelled";
    if (released.released) cart.couponReservationState = "released";
    await cart.save();
    return { ok: true };
}

export async function getStoreExtracts(storeId: string, limit = 50): Promise<ExtractView[]> {
    const discordId = await requireSessionUser();
    await requireStoreAccess(discordId, storeId);

    const store = await databases.stores.findById(storeId, { name: 1 });
    const extracts = (await databases.extracts.find({ storeId }).sort({ createdAt: -1 }).limit(limit)) as unknown as ExtractDoc[];

    return extracts.map((e) => ({
        id: String(e._id),
        storeId,
        storeName: store?.name || "",
        origin: e.origin,
        action: e.action,
        description: e.description || null,
        amount: e.amount,
        createdAt: toISO(e.createdAt) || "",
    }));
}

export async function changeStoreBalance(storeId: string, args: { action: "add" | "remove"; amount: number; description?: string }): Promise<{ ok: true }> {
    const discordId = await requireSessionUser();
    await requireStoreAccess(discordId, storeId);

    if (!Number.isFinite(args.amount) || args.amount <= 0) {
        throw new ActionError("Valor inválido para alteração de saldo.");
    }

    await changeBalance({
        action: args.action,
        amount: args.amount,
        origin: "manual",
        description: args.description || `Ajuste manual pelo painel (${discordId})`,
        storeId,
    });

    return { ok: true };
}

export async function getSettingsView(): Promise<SettingsView> {
    const discordId = await requireSessionUser();
    const settings = await databases.userSettings.findOne({ userId_discord: discordId });
    const stores = await listAdminStores();

    const token = settings?.settings?.["token_campos"] as string | undefined;

    let efiValid = false;
    if (settings?.efi_credentials?.client_id && settings.efi_credentials?.cert) {
        const efiInstance = await efiWrapper.getInstance(discordId).catch(() => null);
        efiValid = !!efiInstance?.isValid;
    }

    let promisseValid = false;
    if (settings?.promissepay_credentials?.api_key) {
        const promisseInstance = await promisseWrapper.getInstance(discordId).catch(() => null);
        promisseValid = !!promisseInstance?.isValid;
    }

    let sharpifyValid = false;
    if (settings?.sharpify_credentials?.client_id && settings.sharpify_credentials?.client_secret) {
        sharpifyValid = await sharpifyWrapper.checkIsValidConfig({
            client_id: settings.sharpify_credentials.client_id,
            client_secret: settings.sharpify_credentials.client_secret,
        }).catch(() => false);
    }
    return {
        userLinked: !!settings && !!(settings.userId_campos && token),
        tokenCamposMasked: token ? `${token.slice(0, 6)}...${token.slice(-4)}` : null,
        tokenCamposConfigured: !!token,
        paymentGateway: settings?.payment_gateway || null,
        efiConfigured: !!(settings?.efi_credentials?.client_id && settings.efi_credentials?.cert),
        efiValid,
        manualConfigured: !!(settings?.manual_payment_credentials?.pix_key),
        promisseConfigured: !!settings?.promissepay_credentials?.api_key,
        promisseValid,
        sharpifyConfigured: !!(settings?.sharpify_credentials?.client_id && settings.sharpify_credentials?.client_secret),
        sharpifyValid,
        stores,
    };
}

export async function saveCamposToken(newToken?: string): Promise<{ ok: true; masked?: string }> {
    const discordId = await requireBotOwner();

    if (newToken && newToken.trim()) {
        const sdk = new CamposCloudSDK({ apiToken: newToken.trim() });
        const userData = await sdk.getMe().catch(() => null);
        if (!userData) {
            throw new ActionError("Token inválido. Verifique e tente novamente.");
        }

        await databases.userSettings.updateMany(
            { userId_campos: userData._id, userId_discord: { $ne: discordId } },
            { $unset: { "settings.token_campos": "", token_campos: "", userId_campos: "" } }
        );

        await databases.userSettings.updateOne(
            { userId_discord: discordId },
            {
                $set: {
                    "settings.token_campos": newToken.trim(),
                    userId_campos: userData._id,
                    userId_discord: discordId,
                },
            },
            { upsert: true }
        );
        await databases.userSettings.updateOne({ userId_discord: discordId }, { $unset: { token_campos: "" } });

        sdkWrapper.clearInstance(discordId);
        return { ok: true, masked: `${newToken.trim().slice(0, 6)}...${newToken.trim().slice(-4)}` };
    }

    await databases.userSettings.updateOne(
        { userId_discord: discordId },
        { $unset: { "settings.token_campos": "", token_campos: "", userId_campos: "" } }
    );
    sdkWrapper.clearInstance(discordId);
    return { ok: true };
}

export async function savePaymentConfig(
    gateway: PaymentGateway,
    credentials: {
        efi?: { client_id?: string; client_secret?: string; pix_key?: string; cert?: string };
        manual?: { pix_key?: string; key_type?: string };
        promisse?: { api_key?: string };
        sharpify?: { client_id?: string; client_secret?: string };
    }
): Promise<{ ok: true }> {
    const discordId = await requireBotOwner();

    if (!["efi", "manual", "promisse", "sharpify"].includes(gateway)) {
        throw new ActionError("Gateway de pagamento inválido.");
    }

    const update: {
        payment_gateway: PaymentGateway;
        efi_credentials?: { client_id: string; client_secret: string; pix_key: string; cert: string };
        manual_payment_credentials?: { pix_key: string; key_type: string };
        promissepay_credentials?: { api_key: string };
        sharpify_credentials?: { client_id: string; client_secret: string; webhook_id: string };
    } = { payment_gateway: gateway };

    if (gateway === "efi") {
        if (!credentials.efi?.client_id || !credentials.efi?.client_secret || !credentials.efi?.pix_key) {
            throw new ActionError("Preencha client_id, client_secret e pix_key para o EFI.");
        }
        const current = await databases.userSettings.findOne({ userId_discord: discordId }, { efi_credentials: 1 });
        update.efi_credentials = {
            client_id: credentials.efi.client_id.trim(),
            client_secret: credentials.efi.client_secret.trim(),
            pix_key: credentials.efi.pix_key.trim(),
            cert: credentials.efi.cert?.trim() || current?.efi_credentials?.cert || "",
        };
        efiWrapper.clearInstance(discordId);
    }

    if (gateway === "manual") {
        if (!credentials.manual?.pix_key || !credentials.manual?.key_type) {
            throw new ActionError("Preencha a chave PIX e o tipo da chave para pagamento manual.");
        }
        update.manual_payment_credentials = {
            pix_key: credentials.manual.pix_key.trim(),
            key_type: credentials.manual.key_type,
        };
    }

    if (gateway === "promisse") {
        if (!credentials.promisse?.api_key) {
            throw new ActionError("Preencha a API Key do PromissePay.");
        }
        const apiKey = credentials.promisse.api_key.trim();
        const valid = await promisseWrapper.checkIsValidConfig(apiKey);
        if (!valid) {
            throw new ActionError("A PromissePay recusou a chave. Confirme a API Key, a lista de IPs permitidos e os escopos payments.create e payments.read.");
        }
        update.promissepay_credentials = { api_key: apiKey };
        promisseWrapper.clearInstance(discordId);
    }

    if (gateway === "sharpify") {
        const clientId = credentials.sharpify?.client_id?.trim() || "";
        const clientSecret = credentials.sharpify?.client_secret?.trim() || "";
        if (!clientId || !clientSecret) throw new ActionError("Preencha o Client ID e o Client Secret da Sharpify.");
        const valid = await sharpifyWrapper.checkIsValidConfig({ client_id: clientId, client_secret: clientSecret });
        if (!valid) throw new ActionError("A Sharpify recusou as credenciais. Confirme as permissões CREATE_PAYMENT_LINK e GET_PAYMENT_LINK.");
        update.sharpify_credentials = { client_id: clientId, client_secret: clientSecret, webhook_id: crypto.createHash("sha256").update(clientId).digest("hex") };
    }
    await databases.userSettings.updateOne({ userId_discord: discordId }, { $set: update } as UpdateQuery<ISettings>, { upsert: true });

    return { ok: true };
}

export interface SaleEntry {
    id: string;
    type: "renew" | "buy";
    userId: string;
    productOrAppName: string;
    price: number;
    finalPrice: number;
    lifetime: boolean;
    days: number | null;
    step: string;
    status: string;
    createdAt: string;
}

export async function listSales(storeId: string, limit = 50): Promise<SaleEntry[]> {
    const discordId = await requireSessionUser();
    await requireStoreAccess(discordId, storeId);

    const renewCarts = (await databases.cartsRenew
        .find({ storeId })
        .populate("applicationId")
        .sort({ _id: -1 })
        .limit(limit)) as unknown as CartRenewAppPopulated[];

    const buyCarts = (await databases.cartsBuy
        .find({ storeId })
        .populate("productId")
        .sort({ _id: -1 })
        .limit(limit)) as unknown as CartBuyProductPopulated[];

    const renew = renewCarts.map((cart) => ({
        id: String(cart._id),
        type: "renew" as const,
        userId: cart.userId,
        productOrAppName: cart.applicationId?.name || "Aplicação",
        price: cart.price || 0,
        finalPrice: cart.finalPrice || 0,
        lifetime: !!cart.lifetime,
        days: cart.days || null,
        step: cart.step,
        status: cart.status,
        createdAt: toISO(cart._id.getTimestamp()) || "",
    }));

    const buy = buyCarts.map((cart) => ({
        id: String(cart._id),
        type: "buy" as const,
        userId: cart.userId,
        productOrAppName: cart.productId?.name || "Produto",
        price: cart.price || 0,
        finalPrice: cart.finalPrice || 0,
        lifetime: false,
        days: null,
        step: cart.step,
        status: cart.status,
        createdAt: toISO(cart._id.getTimestamp()) || "",
    }));

    return [...renew, ...buy]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, limit);
}

export interface BotIdentityView {
    description: string;
    presences: string[];
}

function discordBotApi() {
    const token = process.env.BOT_TOKEN;
    if (!token) throw new ActionError("BOT_TOKEN não configurado.");
    return axios.create({
        baseURL: "https://discord.com/api/v10",
        headers: { Authorization: `Bot ${token}` },
        timeout: DISCORD_API_TIMEOUT_MS,
    });
}

export async function getBotIdentity(): Promise<BotIdentityView> {
    await requireBotOwner();
    const [application, presenceSetting] = await Promise.all([
        discordBotApi().get("/applications/@me").catch(() => null),
        databases.globalSettings.findOne({ key: "rich_presences" }),
    ]);
    return {
        description: typeof application?.data?.description === "string" ? application.data.description : "",
        presences: Array.isArray(presenceSetting?.value)
            ? presenceSetting.value.filter((value: unknown): value is string => typeof value === "string").slice(0, 5)
            : [],
    };
}

export async function saveBotIdentity(input: { description: string; presences: string[] }): Promise<{ ok: true }> {
    await requireBotOwner();
    const description = input.description.trim();
    if (description.length > 400) throw new ActionError("A biografia não pode ultrapassar 400 caracteres.");

    const presences = input.presences.map((value) => value.trim()).filter(Boolean).slice(0, 5);
    if (presences.some((value) => value.length > 128)) {
        throw new ActionError("Cada presença pode ter no máximo 128 caracteres.");
    }

    await Promise.all([
        discordBotApi().patch("/applications/@me", { description }),
        databases.globalSettings.updateOne({ key: "rich_presences" }, { value: presences }, { upsert: true }),
    ]);
    return { ok: true };
}

export async function saveBotAvatar(imageUrl: string): Promise<{ ok: true }> {
    await requireBotOwner();
    let url: URL;
    try {
        url = new URL(imageUrl);
    } catch {
        throw new ActionError("URL da imagem inválida.");
    }
    if (!["http:", "https:"].includes(url.protocol)) {
        throw new ActionError("A imagem deve usar HTTP ou HTTPS.");
    }

    const image = await axios.get<ArrayBuffer>(url.toString(), {
        responseType: "arraybuffer",
        timeout: DISCORD_API_TIMEOUT_MS,
        maxContentLength: 8 * 1024 * 1024,
    }).catch(() => null);
    const contentType = String(image?.headers?.["content-type"] || "").split(";")[0];
    if (!image?.data || !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(contentType)) {
        throw new ActionError("Não foi possível baixar uma imagem PNG, JPEG, GIF ou WebP válida.");
    }

    const base64 = Buffer.from(image.data).toString("base64");
    await discordBotApi().patch("/users/@me", { avatar: `data:${contentType};base64,${base64}` });
    return { ok: true };
}
