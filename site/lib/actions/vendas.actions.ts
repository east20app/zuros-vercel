"use server";

import { Types, type PipelineStage } from "mongoose";
import databases from "@root/src/databases";
import efiWrapper from "@root/src/functions/efi_wrapper";
import promisseWrapper from "@root/src/functions/promisse_wrapper";
import type { IApplications } from "@root/src/databases/schemas/applications";
import type { SettingsView, PaymentGateway } from "@/lib/types";
import { getBotDocument, saveBotDocument, startBotConfigSyncWatcher } from "@/lib/drox-bot-config";
import { ActionError, requireSessionUser } from "./context";

const LOJA_PRODUCTS_DOC = "loja_products";

export type SalesRange = "7d" | "30d" | "mes" | "tudo";

export interface VendasContext {
    appId: string;
    storeId: string;
    storeName: string;
    botId: string;
    botName: string;
    productName: string;
}

export interface SalesPoint { day: string; total: number; count: number }
export interface ProductSales { name: string; total: number; count: number }
export interface RecentSale { id: string; type: "buy" | "renew"; itemName: string; finalPrice: number; createdAt: string }

export interface SalesOverview {
    total: number;
    ordersCount: number;
    averageTicket: number;
    today: number;
    todayCount: number;
    pendingCount: number;
    byDay: SalesPoint[];
    byProduct: ProductSales[];
    recent: RecentSale[];
}

export interface OrderEntry {
    id: string;
    type: "buy" | "renew";
    itemName: string;
    userId: string;
    guildId: string | null;
    price: number;
    finalPrice: number;
    days: number | null;
    lifetime: boolean;
    step: string;
    status: string;
    paymentId: string | null;
    createdAt: string;
    expiresAt: string | null;
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

export interface CustomerEntry {
    userId: string;
    guildId: string | null;
    orders: number;
    totalSpent: number;
    lastPurchaseAt: string | null;
}

export interface OrderFilters { step?: string; status?: string; type?: "buy" | "renew" | "all" }

const DAY_MS = 24 * 60 * 60 * 1000;

type AppPopulated = IApplications & {
    storeId?: { _id: Types.ObjectId; name?: string } | Types.ObjectId | null;
    productId?: { name?: string } | null;
};

function toISO(date: unknown): string | null {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date as string);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

function dayKey(d: Date): string {
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function startOfLocalDay(): number {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function rangeStart(range: SalesRange): number {
    const now = Date.now();
    if (range === "7d") return now - 6 * DAY_MS;
    if (range === "30d") return now - 29 * DAY_MS;
    if (range === "mes") return new Date().setHours(0, 0, 0, 0) - (new Date().getDate() - 1) * DAY_MS;
    return 0;
}

async function resolveAppContext(appId: string): Promise<VendasContext> {
    const discordId = await requireSessionUser();
    const identifier = /^[a-f\d]{24}$/i.test(appId) ? { $or: [{ _id: appId }, { botId: appId }] } : { botId: appId };
    const app = (await databases.applications
        .findOne(identifier)
        .populate("storeId")
        .populate("productId")
        .lean()) as unknown as AppPopulated | null;
    if (!app || String(app.ownerId) !== discordId) {
        throw new ActionError("Você não possui esta aplicação.");
    }
    const storeRef = app.storeId && typeof app.storeId === "object" && "name" in app.storeId ? app.storeId : null;
    const productRef = app.productId && typeof app.productId === "object" && "name" in app.productId ? app.productId : null;
    return {
        appId: String(app._id),
        storeId: String(storeRef?._id ?? app.storeId),
        storeName: storeRef?.name || "Loja",
        botId: app.botId || "",
        botName: app.name,
        productName: productRef?.name || "Sem produto",
    };
}

export async function getVendasContext(appId: string): Promise<VendasContext> {
    return resolveAppContext(appId);
}

type DroxPurchase = Record<string, unknown> & { userId: string };
async function getDroxPurchases(ctx: VendasContext): Promise<DroxPurchase[]> {
    if (!ctx.botId) throw new ActionError("Esta aplicação ainda não possui um bot vinculado.");
    const document = await getBotDocument(ctx.botId, "loja_buys");
    const grouped = document?.purchases && typeof document.purchases === "object" && !Array.isArray(document.purchases)
        ? document.purchases as Record<string, unknown>
        : {};
    const entries: DroxPurchase[] = [];
    for (const [userId, purchases] of Object.entries(grouped)) {
        if (!Array.isArray(purchases)) continue;
        for (const purchase of purchases) {
            if (purchase && typeof purchase === "object" && !Array.isArray(purchase)) entries.push({ ...(purchase as Record<string, unknown>), userId });
        }
    }
    return entries.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
}

function nested(record: Record<string, unknown>, key: string): Record<string, unknown> {
    const value = record[key];
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Resumo comercial vindo diretamente do documento loja_products do bot DROX. */
export async function getSalesOverview(appId: string, _range: SalesRange = "7d"): Promise<SalesOverview> {
    const ctx = await resolveAppContext(appId);
    const start = rangeStart(_range);
    const allPurchases = await getDroxPurchases(ctx);
    const purchases = _range === "tudo" ? allPurchases : allPurchases.filter((purchase) => Number(purchase.timestamp || 0) * 1000 >= start);
    const todayStart = startOfLocalDay();
    const byDayMap = new Map<string, SalesPoint>();
    const byProductMap = new Map<string, ProductSales>();
    let total = 0; let today = 0; let todayCount = 0;
    for (const purchase of purchases) {
        const pricing = nested(purchase, "pricing");
        const product = nested(purchase, "product");
        const value = Number(pricing.final_price || 0);
        const timestamp = Number(purchase.timestamp || 0) * 1000;
        const name = String(product.name || "Produto");
        total += value;
        if (timestamp >= todayStart) { today += value; todayCount += 1; }
        if (timestamp > 0) {
            const day = dayKey(new Date(timestamp));
            const point = byDayMap.get(day) || { day, total: 0, count: 0 };
            point.total += value; point.count += 1; byDayMap.set(day, point);
        }
        const productPoint = byProductMap.get(name) || { name, total: 0, count: 0 };
        productPoint.total += value; productPoint.count += 1; byProductMap.set(name, productPoint);
    }
    const cartsDoc = await getBotDocument(ctx.botId, "loja_data");
    const carts = cartsDoc?.carts && typeof cartsDoc.carts === "object" && !Array.isArray(cartsDoc.carts) ? Object.values(cartsDoc.carts as Record<string, unknown>) : [];
    return {
        total,
        ordersCount: purchases.length,
        averageTicket: purchases.length ? total / purchases.length : 0,
        today,
        todayCount,
        pendingCount: carts.filter((cart) => cart && typeof cart === "object" && !["completed", "cancelled", "expired"].includes(String((cart as Record<string, unknown>).status || ""))).length,
        byDay: Array.from(byDayMap.values()).slice(-90),
        byProduct: Array.from(byProductMap.values()).sort((a, b) => b.total - a.total).slice(0, 10),
        recent: purchases.slice(0, 6).map((purchase) => ({
            id: String(purchase.purchase_id || ""), type: "buy" as const,
            itemName: String(nested(purchase, "product").name || "Produto"),
            finalPrice: Number(nested(purchase, "pricing").final_price || 0),
            createdAt: new Date(Number(purchase.timestamp || 0) * 1000).toISOString(),
        })),
    };
}

/** @deprecated Dados dos carrinhos comerciais da plataforma; não usar nas telas do bot DROX. */
export async function getPlatformSalesOverview(appId: string, range: SalesRange = "7d"): Promise<SalesOverview> {
    const ctx = await resolveAppContext(appId);
    const applicationId = new Types.ObjectId(ctx.appId);
    const now = Date.now();
    const start = rangeStart(range);
    const seriesStart = Math.max(start, now - 89 * DAY_MS);
    const idFilter = range === "tudo" ? {} : { _id: { $gte: Types.ObjectId.createFromTime(Math.floor(start / 1000)) } };

    const totalPipeline = (match: Record<string, unknown>): PipelineStage[] => [
        { $match: { ...match, step: "payment-confirmed" } },
        { $group: { _id: null, total: { $sum: "$finalPrice" }, count: { $sum: 1 } } },
    ];

    const [[buyAgg, renewAgg], [buyPending, renewPending]] = await Promise.all([
        Promise.all([
            databases.cartsBuy.aggregate<{ total: number; count: number }>(totalPipeline({ applicationId })),
            databases.cartsRenew.aggregate<{ total: number; count: number }>(totalPipeline({ applicationId })),
        ]),
        Promise.all([
            databases.cartsBuy.countDocuments({ applicationId, status: "opened", step: "waiting-payment" }),
            databases.cartsRenew.countDocuments({ applicationId, status: "opened", step: "waiting-payment" }),
        ]),
    ]);

    const total = (buyAgg[0]?.total || 0) + (renewAgg[0]?.total || 0);
    const ordersCount = (buyAgg[0]?.count || 0) + (renewAgg[0]?.count || 0);

    const [buyCarts, renewCarts] = await Promise.all([
        databases.cartsBuy
            .find({ applicationId, step: "payment-confirmed", ...idFilter })
            .populate("productId")
            .sort({ _id: -1 })
            .limit(2000)
            .lean(),
        databases.cartsRenew
            .find({ applicationId, step: "payment-confirmed", ...idFilter })
            .populate("applicationId")
            .sort({ _id: -1 })
            .limit(2000)
            .lean(),
    ]);

    type Item = { id: string; type: "buy" | "renew"; name: string; finalPrice: number; ts: number };
    const items: Item[] = [];
    for (const cart of buyCarts as unknown as (Record<string, unknown> & { _id: Types.ObjectId })[]) {
        items.push({
            id: String(cart._id),
            type: "buy",
            name: (cart.productId as unknown as { name?: string } | null)?.name || "Produto",
            finalPrice: Number(cart.finalPrice || 0),
            ts: cart._id.getTimestamp().getTime(),
        });
    }
    for (const cart of renewCarts as unknown as (Record<string, unknown> & { _id: Types.ObjectId })[]) {
        items.push({
            id: String(cart._id),
            type: "renew",
            name: (cart.applicationId as unknown as { name?: string } | null)?.name || "Aplicação",
            finalPrice: Number(cart.finalPrice || 0),
            ts: cart._id.getTimestamp().getTime(),
        });
    }

    const todayStart = startOfLocalDay();
    let today = 0;
    let todayCount = 0;
    for (const item of items) {
        if (item.ts >= todayStart) {
            today += item.finalPrice;
            todayCount += 1;
        }
    }

    const byDayMap = new Map<string, SalesPoint>();
    const first = new Date(seriesStart);
    first.setHours(0, 0, 0, 0);
    const todayDate = new Date(todayStart);
    for (let d = new Date(first); d.getTime() <= todayDate.getTime(); d.setDate(d.getDate() + 1)) {
        byDayMap.set(dayKey(d), { day: dayKey(d), total: 0, count: 0 });
    }
    for (const item of items) {
        const point = byDayMap.get(dayKey(new Date(item.ts)));
        if (point) {
            point.total += item.finalPrice;
            point.count += 1;
        }
    }

    const byName = new Map<string, { total: number; count: number }>();
    for (const item of items) {
        const entry = byName.get(item.name) ?? { total: 0, count: 0 };
        entry.total += item.finalPrice;
        entry.count += 1;
        byName.set(item.name, entry);
    }

    return {
        total,
        ordersCount,
        averageTicket: ordersCount > 0 ? total / ordersCount : 0,
        today,
        todayCount,
        pendingCount: buyPending + renewPending,
        byDay: Array.from(byDayMap.values()),
        byProduct: Array.from(byName.entries())
            .map(([name, entry]) => ({ name, total: entry.total, count: entry.count }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10),
        recent: items.slice(0, 6).map((item) => ({
            id: item.id,
            type: item.type,
            itemName: item.name,
            finalPrice: item.finalPrice,
            createdAt: new Date(item.ts).toISOString(),
        })),
    };
}

export async function listOrders(appId: string, _filters: OrderFilters = {}): Promise<OrderEntry[]> {
    const ctx = await resolveAppContext(appId);
    const purchases = await getDroxPurchases(ctx);
    return purchases.map((purchase) => {
        const product = nested(purchase, "product");
        const pricing = nested(purchase, "pricing");
        const payment = nested(purchase, "payment");
        const timestamp = Number(purchase.timestamp || 0);
        return {
            id: String(purchase.purchase_id || ""), type: "buy" as const,
            itemName: String(product.name || "Produto"), userId: purchase.userId,
            guildId: null, price: Number(pricing.total_price || pricing.final_price || 0),
            finalPrice: Number(pricing.final_price || 0), days: null, lifetime: false,
            step: "payment-confirmed", status: "closed",
            paymentId: String(nested(purchase, "metadata").payment_id || payment.method || "") || null,
            createdAt: timestamp ? new Date(timestamp * 1000).toISOString() : "",
            expiresAt: null,
        };
    }).filter((entry) => (!_filters.status || entry.status === _filters.status) && (!_filters.step || entry.step === _filters.step));
}

/** @deprecated Histórico comercial da plataforma. */
export async function listPlatformOrders(appId: string, filters: OrderFilters = {}): Promise<OrderEntry[]> {
    const ctx = await resolveAppContext(appId);
    const match: Record<string, unknown> = { applicationId: new Types.ObjectId(ctx.appId) };
    if (filters.step) match.step = filters.step;
    if (filters.status) match.status = filters.status;

    const [buyCarts, renewCarts] = await Promise.all([
        databases.cartsBuy.find(match).populate("productId").sort({ _id: -1 }).limit(300).lean(),
        databases.cartsRenew.find(match).populate("applicationId").sort({ _id: -1 }).limit(300).lean(),
    ]);

    const entries: OrderEntry[] = [];
    if (filters.type !== "renew") {
        for (const cart of buyCarts as unknown as (Record<string, unknown> & { _id: Types.ObjectId })[]) {
            entries.push({
                id: String(cart._id),
                type: "buy",
                itemName: (cart.productId as unknown as { name?: string } | null)?.name || "Produto",
                userId: String(cart.userId || ""),
                guildId: String(cart.guildId || "") || null,
                price: Number(cart.price || 0),
                finalPrice: Number(cart.finalPrice || 0),
                days: cart.days ? Number(cart.days) : null,
                lifetime: Boolean(cart.lifetime),
                step: String(cart.step || ""),
                status: String(cart.status || ""),
                paymentId: cart.paymentId ? String(cart.paymentId) : null,
                createdAt: toISO(cart._id.getTimestamp()) || "",
                expiresAt: toISO(cart.expiresAt),
            });
        }
    }
    if (filters.type !== "buy") {
        for (const cart of renewCarts as unknown as (Record<string, unknown> & { _id: Types.ObjectId })[]) {
            entries.push({
                id: String(cart._id),
                type: "renew",
                itemName: (cart.applicationId as unknown as { name?: string } | null)?.name || "Aplicação",
                userId: String(cart.userId || ""),
                guildId: null,
                price: Number(cart.price || 0),
                finalPrice: Number(cart.finalPrice || 0),
                days: cart.days ? Number(cart.days) : null,
                lifetime: Boolean(cart.lifetime),
                step: String(cart.step || ""),
                status: String(cart.status || ""),
                paymentId: cart.paymentId ? String(cart.paymentId) : null,
                createdAt: toISO(cart._id.getTimestamp()) || "",
                expiresAt: toISO(cart.expiresAt),
            });
        }
    }

    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
}

export async function getOpenCarts(appId: string): Promise<OpenCartEntry[]> {
    const ctx = await resolveAppContext(appId);
    const document = await getBotDocument(ctx.botId, "loja_data");
    const carts = document?.carts && typeof document.carts === "object" && !Array.isArray(document.carts) ? document.carts as Record<string, unknown> : {};
    return Object.entries(carts).flatMap(([id, raw]) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
        const cart = raw as Record<string, unknown>;
        const status = String(cart.status || "cart");
        if (["completed", "cancelled", "expired"].includes(status)) return [];
        const items = Array.isArray(cart.items) ? cart.items as Array<Record<string, unknown>> : [];
        const created = Number(cart.created_at || 0);
        return [{
            id, type: "buy" as const, userId: String(cart.user_id || ""),
            channelId: String(cart.thread_id || cart.channel_id || "") || null,
            itemName: items.length === 1 ? String(items[0]?.product_name || items[0]?.product_id || "Produto") : `${items.length} itens`,
            step: status, price: Number(cart.total_price || 0),
            finalPrice: Math.max(0, Number(cart.total_price || 0) - Number(cart.discount_amount || 0)),
            days: null, lifetime: false, automaticPayment: cart.payment_method !== "pix_manual",
            paymentId: String(nested(cart, "payment_data").payment_id || "") || null,
            expiresAt: null, createdAt: created ? new Date(created * 1000).toISOString() : "",
        }];
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** @deprecated Carrinhos comerciais da plataforma. */
export async function getPlatformOpenCarts(appId: string): Promise<OpenCartEntry[]> {
    const ctx = await resolveAppContext(appId);
    const applicationId = new Types.ObjectId(ctx.appId);

    const [renewCarts, buyCarts] = await Promise.all([
        databases.cartsRenew.find({ applicationId, status: "opened" }).populate("applicationId").sort({ _id: -1 }).lean(),
        databases.cartsBuy.find({ applicationId, status: "opened" }).populate("productId").sort({ _id: -1 }).lean(),
    ]);

    const entries: OpenCartEntry[] = [];
    for (const cart of renewCarts as unknown as (Record<string, unknown> & { _id: Types.ObjectId })[]) {
        entries.push({
            id: String(cart._id),
            type: "renew",
            userId: String(cart.userId || ""),
            channelId: cart.channelId ? String(cart.channelId) : null,
            itemName: (cart.applicationId as unknown as { name?: string } | null)?.name || "Aplicação",
            step: String(cart.step || ""),
            price: Number(cart.price || 0),
            finalPrice: Number(cart.finalPrice || 0),
            days: cart.days ? Number(cart.days) : null,
            lifetime: Boolean(cart.lifetime),
            automaticPayment: null,
            paymentId: cart.paymentId ? String(cart.paymentId) : null,
            expiresAt: toISO(cart.expiresAt),
            createdAt: toISO(cart._id.getTimestamp()) || "",
        });
    }
    for (const cart of buyCarts as unknown as (Record<string, unknown> & { _id: Types.ObjectId })[]) {
        entries.push({
            id: String(cart._id),
            type: "buy",
            userId: String(cart.userId || ""),
            channelId: cart.channelId ? String(cart.channelId) : null,
            itemName: (cart.productId as unknown as { name?: string } | null)?.name || "Produto",
            step: String(cart.step || ""),
            price: Number(cart.price || 0),
            finalPrice: Number(cart.finalPrice || 0),
            days: cart.days ? Number(cart.days) : null,
            lifetime: Boolean(cart.lifetime),
            automaticPayment: Boolean(cart.automaticPayment),
            paymentId: cart.paymentId ? String(cart.paymentId) : null,
            expiresAt: toISO(cart.expiresAt),
            createdAt: toISO(cart._id.getTimestamp()) || "",
        });
    }

    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCustomers(appId: string): Promise<CustomerEntry[]> {
    const ctx = await resolveAppContext(appId);
    const purchases = await getDroxPurchases(ctx);
    const customers = new Map<string, CustomerEntry>();
    for (const purchase of purchases) {
        const timestamp = Number(purchase.timestamp || 0);
        const createdAt = timestamp ? new Date(timestamp * 1000).toISOString() : null;
        const current = customers.get(purchase.userId) || { userId: purchase.userId, guildId: null, orders: 0, totalSpent: 0, lastPurchaseAt: null };
        current.orders += 1;
        current.totalSpent += Number(nested(purchase, "pricing").final_price || 0);
        if (createdAt && (!current.lastPurchaseAt || createdAt > current.lastPurchaseAt)) current.lastPurchaseAt = createdAt;
        customers.set(purchase.userId, current);
    }
    return Array.from(customers.values()).sort((a, b) => b.totalSpent - a.totalSpent);
}

/** @deprecated Clientes dos carrinhos comerciais da plataforma. */
export async function getPlatformCustomers(appId: string): Promise<CustomerEntry[]> {
    const ctx = await resolveAppContext(appId);
    const applicationId = new Types.ObjectId(ctx.appId);

    const groupPipeline: PipelineStage[] = [
        { $match: { applicationId, step: "payment-confirmed" } },
        {
            $group: {
                _id: "$userId",
                orders: { $sum: 1 },
                totalSpent: { $sum: "$finalPrice" },
                lastId: { $max: "$_id" },
                guildId: { $max: "$guildId" },
            },
        },
    ];

    const [buyRows, renewRows] = await Promise.all([
        databases.cartsBuy.aggregate<{ _id: string; orders: number; totalSpent: number; lastId: Types.ObjectId; guildId?: string }>(groupPipeline),
        databases.cartsRenew.aggregate<{ _id: string; orders: number; totalSpent: number; lastId: Types.ObjectId; guildId?: string }>(groupPipeline),
    ]);

    const byUser = new Map<string, CustomerEntry>();
    const merge = (row: { _id: string; orders: number; totalSpent: number; lastId: Types.ObjectId; guildId?: string }) => {
        const existing = byUser.get(row._id);
        const lastPurchaseAt = row.lastId ? new Date(row.lastId.getTimestamp()).toISOString() : null;
        if (existing) {
            existing.orders += row.orders;
            existing.totalSpent += row.totalSpent || 0;
            if (lastPurchaseAt && (!existing.lastPurchaseAt || lastPurchaseAt > existing.lastPurchaseAt)) existing.lastPurchaseAt = lastPurchaseAt;
        } else {
            byUser.set(row._id, {
                userId: row._id,
                guildId: row.guildId || null,
                orders: row.orders,
                totalSpent: row.totalSpent || 0,
                lastPurchaseAt,
            });
        }
    };
    for (const row of buyRows) merge(row);
    for (const row of renewRows) merge(row);

    return Array.from(byUser.values()).sort((a, b) => b.totalSpent - a.totalSpent);
}

export interface StoreProductEntry {
    id: string;
    name: string;
    campos: number;
    stock: number;
    sales: number;
    minPrice: number | null;
    totalPaid: number;
    deliveryType: string;
    hexColor: string;
    description: string | null;
}

function productStockCount(stock: unknown): number {
    if (Array.isArray(stock)) return stock.length;
    if (stock && typeof stock === "object") return Object.keys(stock).length;
    return 0;
}

async function getLojaProductsDoc(ctx: VendasContext): Promise<Record<string, unknown>> {
    if (!ctx.botId) throw new ActionError("Esta aplicação ainda não possui um bot vinculado.");
    startBotConfigSyncWatcher();
    const doc = await getBotDocument(ctx.botId, LOJA_PRODUCTS_DOC);
    if (!doc) return {};
    // O doc loja_products do DROX tem os produtos como chaves de topo
    // (ex.: { "15cb6c4493": { name, campos, ... } }). _id/_updatedAt já são
    // removidos pelo getBotDocument.
    return doc;
}

export async function getStoreProducts(appId: string): Promise<StoreProductEntry[]> {
    const ctx = await resolveAppContext(appId);
    const products = await getLojaProductsDoc(ctx);

    const entries: StoreProductEntry[] = [];
    for (const [id, raw] of Object.entries(products)) {
        const product = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
        const info = product.info && typeof product.info === "object" && !Array.isArray(product.info) ? (product.info as Record<string, unknown>) : {};
        const campos = product.campos && typeof product.campos === "object" && !Array.isArray(product.campos) ? (product.campos as Record<string, unknown>) : {};
        const prices: number[] = [];
        let stock = 0;
        for (const rawCampo of Object.values(campos)) {
            const campo = rawCampo && typeof rawCampo === "object" && !Array.isArray(rawCampo) ? (rawCampo as Record<string, unknown>) : {};
            const price = Number(campo.price);
            if (Number.isFinite(price)) prices.push(price);
            stock += productStockCount(campo.stock);
        }
        const purchasesIds = info.purchasesIds;
        const sales = Array.isArray(purchasesIds) ? purchasesIds.length : Number(info.total_paid || 0) > 0 ? 1 : 0;
        const totalPaid = Number(info.total_paid || 0);
        entries.push({
            id,
            name: typeof product.name === "string" ? product.name : "Produto sem nome",
            campos: Object.keys(campos).length,
            stock,
            sales,
            minPrice: prices.length ? Math.min(...prices) : null,
            totalPaid,
            deliveryType: typeof info.delivery_type === "string" ? info.delivery_type : "automatic",
            hexColor: typeof info.hex_color === "string" ? info.hex_color : "",
            description: typeof info.description === "string" ? info.description : null,
        });
    }
    return entries.sort((a, b) => b.sales - a.sales || b.totalPaid - a.totalPaid || a.name.localeCompare(b.name));
}

function nowTs(): number {
    return Math.floor(Date.now() / 1000);
}

function generateProductId(): string {
    const values = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 10; i += 1) result += values[Math.floor(Math.random() * values.length)];
    return result;
}

export async function saveStoreProduct(appId: string, id: string, data: Record<string, unknown>): Promise<{ ok: true }> {
    const ctx = await resolveAppContext(appId);
    if (!ctx.botId) throw new ActionError("Esta aplicação ainda não possui um bot vinculado.");
    if (!id || !id.trim()) throw new ActionError("ID do produto inválido.");
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (!name) throw new ActionError("Nome do produto é obrigatório.");

    const products = await getLojaProductsDoc(ctx);
    const existing = products[id];
    const raw = existing && typeof existing === "object" && !Array.isArray(existing) ? (existing as Record<string, unknown>) : {};
    const info = raw.info && typeof raw.info === "object" && !Array.isArray(raw.info) ? (raw.info as Record<string, unknown>) : {};

    const next: Record<string, unknown> = {
        ...raw,
        id,
        name,
        info: {
            ...info,
            description: data.description ?? info.description ?? null,
            hex_color: data.hexColor ?? info.hex_color ?? null,
            delivery_type: data.deliveryType ?? info.delivery_type ?? "automatic",
            updated_at: nowTs(),
        },
    };
    products[id] = next;
    startBotConfigSyncWatcher();
    await saveBotDocument(ctx.botId, LOJA_PRODUCTS_DOC, { ...products });
    return { ok: true };
}

export async function createStoreProduct(appId: string): Promise<{ id: string }> {
    const ctx = await resolveAppContext(appId);
    if (!ctx.botId) throw new ActionError("Esta aplicação ainda não possui um bot vinculado.");
    const products = await getLojaProductsDoc(ctx);
    const id = generateProductId();
    products[id] = {
        id,
        name: "Novo produto",
        info: {
            description: null,
            banner: null,
            hex_color: null,
            delivery_type: "automatic",
            created_at: nowTs(),
            updated_at: nowTs(),
            purchasesIds: [],
            total_paid: 0,
            display_preferences: { show_sales: true, show_options: true, show_stock: true, cart_duration_minutes: 30, store_hours: "", transcript_enabled: false },
            buy_button: { label: "Comprar", emoji: "🛒" },
        },
        campos: {},
        categorias: {},
        messages: [],
        cupons: {},
    };
    startBotConfigSyncWatcher();
    await saveBotDocument(ctx.botId, LOJA_PRODUCTS_DOC, { ...products });
    return { id };
}

export async function deleteStoreProduct(appId: string, id: string): Promise<{ ok: true }> {
    const ctx = await resolveAppContext(appId);
    if (!ctx.botId) throw new ActionError("Esta aplicação ainda não possui um bot vinculado.");
    const products = await getLojaProductsDoc(ctx);
    if (!(id in products)) throw new ActionError("Produto não encontrado.");
    delete products[id];
    startBotConfigSyncWatcher();
    await saveBotDocument(ctx.botId, LOJA_PRODUCTS_DOC, { ...products });
    return { ok: true };
}

async function getStoreOwnerSettings(ctx: VendasContext): Promise<SettingsView> {
    const store = await databases.stores.findById(ctx.storeId, { ownerId_campos: 1 });
    if (!store?.ownerId_campos) {
        throw new ActionError("Loja não encontrada.");
    }
    const settings = await databases.userSettings.findOne({ userId_campos: store.ownerId_campos });
    const token = settings?.settings?.["token_campos"] as string | undefined;

    let efiValid = false;
    if (settings?.efi_credentials?.client_id && settings.efi_credentials?.cert) {
        const efiInstance = await efiWrapper.getInstance(settings.userId_discord).catch(() => null);
        efiValid = !!efiInstance?.isValid;
    }
    let promisseValid = false;
    if (settings?.promissepay_credentials?.api_key) {
        const promisseInstance = await promisseWrapper.getInstance(settings.userId_discord).catch(() => null);
        promisseValid = !!promisseInstance?.isValid;
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
        stores: [],
    };
}

export async function getStorePaymentSettings(appId: string): Promise<SettingsView> {
    const ctx = await resolveAppContext(appId);
    return getStoreOwnerSettings(ctx);
}

export interface DroxPaymentProvider { id: string; name: string; enabled: boolean; configured: boolean }
const DROX_PAYMENT_NAMES: Record<string, string> = {
    mercado_pago: "Mercado Pago", efibank: "Efí Bank", pagbank: "PagBank", picpay: "PicPay",
    pushinpay: "PushinPay", stripe: "Stripe", paypal: "PayPal", asaas: "Asaas",
    coinbase: "Coinbase", nowpayments: "NOWPayments", pix_manual: "PIX manual", nubank_imap: "Nubank IMAP",
};
export async function getDroxPaymentProviders(appId: string): Promise<DroxPaymentProvider[]> {
    const ctx = await resolveAppContext(appId);
    const document = await getBotDocument(ctx.botId, "payment_configs") || {};
    return Object.entries(DROX_PAYMENT_NAMES).map(([id, name]) => {
        const raw = document[id];
        const config = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
        const configured = Object.entries(config).some(([key, value]) => key !== "enabled" && value !== null && value !== "" && value !== false);
        return { id, name, enabled: Boolean(config.enabled), configured };
    });
}

export async function saveStorePaymentConfig(
    appId: string,
    gateway: PaymentGateway,
    credentials: {
        efi?: { client_id?: string; client_secret?: string; pix_key?: string; cert?: string };
        manual?: { pix_key?: string; key_type?: string };
        promisse?: { api_key?: string };
    }
): Promise<{ ok: true }> {
    const ctx = await resolveAppContext(appId);
    const store = await databases.stores.findById(ctx.storeId, { ownerId_campos: 1 });
    if (!store?.ownerId_campos) throw new ActionError("Loja não encontrada.");
    const settings = await databases.userSettings.findOne({ userId_campos: store.ownerId_campos });
    if (!settings?.userId_discord) throw new ActionError("O dono da loja não está vinculado ao painel.");

    if (!["efi", "manual", "promisse"].includes(gateway)) {
        throw new ActionError("Gateway de pagamento inválido.");
    }

    const update: Record<string, unknown> = { payment_gateway: gateway };
    if (gateway === "efi") {
        if (!credentials.efi?.client_id || !credentials.efi?.client_secret || !credentials.efi?.pix_key) {
            throw new ActionError("Preencha client_id, client_secret e pix_key para o EFI.");
        }
        update.efi_credentials = {
            client_id: credentials.efi.client_id.trim(),
            client_secret: credentials.efi.client_secret.trim(),
            pix_key: credentials.efi.pix_key.trim(),
            cert: credentials.efi.cert?.trim() || settings.efi_credentials?.cert || "",
        };
        efiWrapper.clearInstance(settings.userId_discord);
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
        update.promissepay_credentials = { api_key: credentials.promisse.api_key.trim() };
        promisseWrapper.clearInstance(settings.userId_discord);
    }

    await databases.userSettings.updateOne({ userId_campos: store.ownerId_campos }, { $set: update }, { upsert: true });
    return { ok: true };
}
