/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";
import { Types } from "mongoose";
import databases from "@root/src/databases";
import { changeApplicationMainServer, changeApplicationName, changeApplicationToken, listBotGuilds, restartApplication, startApplication, stopApplication } from "@root/src/integration/apps";
import { listStoreCatalogs } from "@root/src/integration/purchases";
import { releaseCouponReservation } from "@root/src/integration/coupon-reservations";
import { applyPurchaseCoupon, generatePurchasePayment, getMyPurchaseCart, startPurchase } from "@/lib/actions/purchases.actions";
import { applyRenewCoupon, generateRenewPayment, pollRenewCart, startRenew } from "@/lib/actions/apps.actions";
import { fail, readJson, requestId, text } from "@/lib/integration-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const nonces = new Map<string, number>();

function respond(data: Record<string, unknown>, id: string, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Request-ID": id } }); }
function safe(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); }

async function authenticate(request: Request, route: string, id: string) {
    const secret = process.env.ZUROS_BRIDGE_CREDENTIAL?.trim();
    if (!secret) return fail("CONFIGURATION_REQUIRED", "API do bot não configurada.", id, 503);
    const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const timestamp = request.headers.get("x-zuros-timestamp") || "";
    const nonce = request.headers.get("x-zuros-nonce") || "";
    const signature = request.headers.get("x-zuros-signature") || "";
    if (!safe(bearer, secret) || !/^\d{10}$/.test(timestamp) || !nonce || !signature) return fail("INVALID_CREDENTIAL", "Assinatura inválida.", id, 401);
    const now = Math.floor(Date.now() / 1000), ts = Number(timestamp);
    if (Math.abs(now - ts) > 300) return fail("INVALID_CREDENTIAL", "Assinatura expirada.", id, 401);
    for (const [key, expires] of nonces) if (expires < now) nonces.delete(key);
    if (nonces.has(nonce)) return fail("INVALID_CREDENTIAL", "Requisição repetida.", id, 409);
    const raw = await request.clone().text();
    const url = new URL(request.url);
    const relative = `/${route}${url.search}`;
    const bodyHash = crypto.createHash("sha256").update(raw).digest("hex");
    const payload = [request.method.toUpperCase(), relative, timestamp, nonce, bodyHash].join("\n");
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    if (!safe(signature, expected)) return fail("INVALID_CREDENTIAL", "Assinatura inválida.", id, 401);
    nonces.set(nonce, now + 300);
    return null;
}

function appView(value: unknown) { const app = value as Record<string, unknown>; return { id: String(app._id), application_id: String(app._id), name: app.name, botId: app.botId, bot_id: app.botId, serverId: app.serverId || null, status: app.status, version: app.version, lifetime: !!app.lifetime, expiresAt: app.expiresAt || null, online: false, forceUpdate: !!app.forceUpdate }; }
function catalogView(value: any) { return { id: String(value.id), name: String(value.name || "Loja"), products: Array.isArray(value.products) ? value.products.map((product: any) => ({ id: String(product.id), storeId: String(product.storeId || value.id), name: String(product.name), description: product.description || undefined, plans: (product.prices || []).filter((price: any) => price?.price > 0).map((price: any) => ({ id: String(price.plan), label: String(price.label), days: price.days ?? undefined, lifetime: price.plan === "lifetime", price: Number(price.price), currency: "BRL" })) })) : [] }; }
function cartView(value: any) { return { id: String(value.id || value._id), status: value.status, step: value.step, product: value.product ? { id: String(value.product.id), name: String(value.product.name), plans: value.product.plans || [] } : undefined, plan: value.plan, finalPrice: value.finalPrice ?? value.price ?? undefined, pixQrCode: value.qrcodeDataUrl?.split(",")[1] || value.pixQrCode || undefined, pixCopyPaste: value.copyPaste || value.pixCopyPaste || undefined, expiresAt: value.expiresAt || undefined }; }
async function owned(id: string, userId: string) { if (!Types.ObjectId.isValid(id)) return null; return databases.applications.findOne({ _id: id, ownerId: userId }).select("-token").lean(); }
function apiError(error: unknown, id: string) { console.error(`[client-bot:${id}]`, error instanceof Error ? `${error.name}: ${error.message}` : "unknown"); return fail("INTERNAL_ERROR", error instanceof Error ? error.message : "Falha ao processar operação.", id, 500); }

export async function GET(request: Request, context: Context) {
    const id = requestId(request), route = (await context.params).path.join("/");
    const blocked = await authenticate(request, route, id); if (blocked) return blocked;
    try {
        const url = new URL(request.url), userId = url.searchParams.get("discord_user_id")?.trim() || "";
        if (route === "status") return respond({ service: "zuros-client-bot", status: "operational", version: "v1" }, id);
        if (route === "catalog") {
            const stores = await listStoreCatalogs();
            return respond({ stores: stores.map(catalogView), products: stores.flatMap((store: any) => catalogView(store).products) }, id);
        }
        if (route === "stats") { const filter = userId ? { ownerId: userId } : {}; const [applications, active] = await Promise.all([databases.applications.countDocuments(filter), databases.applications.countDocuments({ ...filter, status: "active" })]); return respond({ applications, active }, id); }
        if (route === "applications") { if (!userId) return fail("INVALID_REQUEST", "discord_user_id obrigatório.", id, 400); const apps = await databases.applications.find({ ownerId: userId }).select("-token").sort({ _id: -1 }).lean(); return respond({ applications: apps.map(appView) }, id); }
        const appMatch = route.match(/^applications\/([^/]+)$/); if (appMatch) { if (!userId) return fail("INVALID_REQUEST", "discord_user_id obrigatório.", id, 400); const app = await owned(appMatch[1], userId); return app ? respond(appView(app), id) : fail("NOT_FOUND", "Aplicação não encontrada.", id, 404); }
        const guildMatch = route.match(/^applications\/([^/]+)\/guilds$/); if (guildMatch) { if (!userId) return fail("INVALID_REQUEST", "discord_user_id obrigatório.", id, 400); return respond({ guilds: await listBotGuilds(guildMatch[1], userId) }, id); }
        const cartMatch = route.match(/^carts\/([^/]+)$/); if (cartMatch) { if (!userId) return fail("INVALID_REQUEST", "discord_user_id obrigatório.", id, 400); const value = await getMyPurchaseCart(cartMatch[1], userId); if (value) return respond(cartView(value), id); return respond(cartView(await pollRenewCart(cartMatch[1], userId)), id); }
        const renewMatch = route.match(/^renewal-carts\/([^/]+)$/); if (renewMatch) { if (!userId) return fail("INVALID_REQUEST", "discord_user_id obrigatório.", id, 400); return respond(cartView(await pollRenewCart(renewMatch[1], userId)), id); }
        return fail("NOT_FOUND", "Rota não encontrada.", id, 404);
    } catch (error) { return apiError(error, id); }
}

export async function POST(request: Request, context: Context) {
    const id = requestId(request), route = (await context.params).path.join("/");
    const blocked = await authenticate(request, route, id); if (blocked) return blocked;
    try {
        const body = await readJson(request), userId = text(body.discord_user_id, 32); if (!userId) return fail("INVALID_REQUEST", "discord_user_id obrigatório.", id, 400);
        if (route === "carts") {
            const storeId = text(body.store_id, 64), productId = text(body.product_id, 64), plan = text(body.plan_id, 20);
            if (!storeId || !productId || !["weekly", "biweekly", "monthly", "lifetime"].includes(plan || "")) return fail("INVALID_REQUEST", "store_id, product_id e plan_id são obrigatórios.", id, 400);
            const result = await startPurchase({ storeId, productId, plan: plan as "weekly" | "biweekly" | "monthly" | "lifetime" }, userId);
            if (!result.ok) return fail("UPSTREAM_ERROR", result.error, id, 400);
            const cart = await getMyPurchaseCart(result.data.cartId, userId); return cart ? respond(cartView(cart), id, 201) : fail("INTERNAL_ERROR", "Carrinho criado, mas não pôde ser lido.", id, 500);
        }
        const planMatch = route.match(/^carts\/([^/]+)\/plan$/); if (planMatch) return fail("INVALID_REQUEST", "O plano deve ser escolhido na criação do carrinho.", id, 409);
        const couponMatch = route.match(/^carts\/([^/]+)\/coupon$/); if (couponMatch) { const cartId = couponMatch[1]!; const code = text(body.code, 40) || ""; const result = await applyPurchaseCoupon(cartId, code, userId); if (result.ok) { const cart = await getMyPurchaseCart(cartId, userId); return cart ? respond(cartView(cart), id) : fail("NOT_FOUND", "Carrinho não encontrado.", id, 404); } const renewResult = await applyRenewCoupon(cartId, code, userId); return respond({ discount: renewResult.discount }, id); }
        const paymentMatch = route.match(/^carts\/([^/]+)\/payment$/); if (paymentMatch) { try { const payment = await generatePurchasePayment(paymentMatch[1], userId); const cart = await getMyPurchaseCart(paymentMatch[1], userId); return respond({ ...(cart ? cartView(cart) : {}), status: "waiting-payment", qrcodeDataUrl: payment.qrcodeDataUrl, pixQrCode: payment.qrcodeDataUrl.split(",")[1], pixCopyPaste: payment.copyPaste, finalPrice: payment.finalPrice }, id); } catch { const payment = await generateRenewPayment(paymentMatch[1], userId); return respond({ status: "waiting-payment", qrcodeDataUrl: payment.qrcodeDataUrl, pixQrCode: payment.qrcodeDataUrl.split(",")[1], pixCopyPaste: payment.copyPaste, finalPrice: payment.finalPrice }, id); } }
        const cancelMatch = route.match(/^carts\/([^/]+)\/cancel$/); if (cancelMatch) { const cart = await databases.cartsBuy.findOne({ _id: cancelMatch[1], userId, status: "opened" }); if (cart) { await releaseCouponReservation({ cartType: "buy", cartId: String(cart._id) }).catch(() => undefined); await databases.cartsBuy.updateOne({ _id: cart._id }, { $set: { status: "cancelled", deliveryState: "cancelled" } }); return respond({ success: true }, id); } const renew = await databases.cartsRenew.findOne({ _id: cancelMatch[1], userId, status: "opened" }); if (!renew) return fail("NOT_FOUND", "Carrinho não encontrado.", id, 404); await releaseCouponReservation({ cartType: "renew", cartId: String(renew._id) }).catch(() => undefined); await databases.cartsRenew.updateOne({ _id: renew._id }, { $set: { status: "cancelled", deliveryState: "cancelled" } }); return respond({ success: true }, id); }
        const renewal = route.match(/^applications\/([^/]+)\/renewal-cart$/); if (renewal) { const applicationId = renewal[1]!; const plan = text(body.plan_id, 20) || ""; if (!["weekly", "biweekly", "monthly", "lifetime"].includes(plan)) return fail("INVALID_REQUEST", "plan_id é obrigatório.", id, 400); if (!(await owned(applicationId, userId))) return fail("NOT_FOUND", "Aplicação não encontrada.", id, 404); const result = await startRenew(applicationId, plan as "weekly" | "biweekly" | "monthly" | "lifetime", userId); return respond(cartView(await pollRenewCart(result.cartId, userId)), id, 201); }
        const renewCoupon = route.match(/^renewal-carts\/([^/]+)\/coupon$/); if (renewCoupon) { const result = await applyRenewCoupon(renewCoupon[1]!, text(body.code, 40) || "", userId); return respond({ discount: result.discount }, id); }
        const renewPayment = route.match(/^renewal-carts\/([^/]+)\/payment$/); if (renewPayment) { const payment = await generateRenewPayment(renewPayment[1], userId); return respond({ status: "waiting-payment", qrcodeDataUrl: payment.qrcodeDataUrl, pixQrCode: payment.qrcodeDataUrl.split(",")[1], pixCopyPaste: payment.copyPaste, finalPrice: payment.finalPrice }, id); }
        const renewCancel = route.match(/^renewal-carts\/([^/]+)\/cancel$/); if (renewCancel) { const cart = await databases.cartsRenew.findOne({ _id: renewCancel[1], userId, status: "opened" }); if (!cart) return fail("NOT_FOUND", "Carrinho de renovação não encontrado.", id, 404); await releaseCouponReservation({ cartType: "renew", cartId: String(cart._id) }).catch(() => undefined); await databases.cartsRenew.updateOne({ _id: cart._id }, { $set: { status: "cancelled", deliveryState: "cancelled" } }); return respond({ success: true }, id); }
        const appMatch = route.match(/^applications\/([^/]+)\/(start|stop|restart|update)$/); if (appMatch) { if (!(await owned(appMatch[1], userId))) return fail("NOT_FOUND", "Aplicação não encontrada.", id, 404); if (appMatch[2] === "start") await startApplication(appMatch[1], userId); else if (appMatch[2] === "stop") await stopApplication(appMatch[1], userId); else if (appMatch[2] === "restart") await restartApplication(appMatch[1], userId); else await databases.applications.updateOne({ _id: appMatch[1], ownerId: userId }, { $set: { forceUpdate: true, errorOnUpdate: false }, $unset: { errorOnUpdateMessage: 1 } }); return respond({ success: true, action: appMatch[2] }, id); }
        return fail("NOT_FOUND", "Rota não encontrada.", id, 404);
    } catch (error) { return apiError(error, id); }
}

export async function PATCH(request: Request, context: Context) {
    const id = requestId(request), route = (await context.params).path.join("/");
    const blocked = await authenticate(request, route, id); if (blocked) return blocked;
    try { const body = await readJson(request), userId = text(body.discord_user_id, 32); if (!userId) return fail("INVALID_REQUEST", "discord_user_id obrigatório.", id, 400); const token = route.match(/^applications\/([^/]+)\/token$/); if (token) { const value = text(body.token, 256); if (!value) return fail("INVALID_REQUEST", "token obrigatório.", id, 400); await changeApplicationToken(token[1], userId, value); return respond({ success: true }, id); } const server = route.match(/^applications\/([^/]+)\/main-server$/); if (server) { const guild = text(body.guild_id, 32); if (!guild) return fail("INVALID_REQUEST", "guild_id obrigatório.", id, 400); await changeApplicationMainServer(server[1], userId, guild); return respond({ success: true }, id); } const app = route.match(/^applications\/([^/]+)$/); if (app) { const name = text(body.name, 40); if (!name) return fail("INVALID_REQUEST", "name obrigatório.", id, 400); await changeApplicationName(app[1], userId, name); return respond({ success: true }, id); } return fail("NOT_FOUND", "Rota não encontrada.", id, 404); } catch (error) { return apiError(error, id); }
}
