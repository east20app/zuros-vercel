import crypto from "crypto";
import type { Model } from "mongoose";
import databases from "../databases";
import efiWrapper from "../functions/efi_wrapper";
import promisseWrapper from "../functions/promisse_wrapper";
import sharpifyWrapper from "../functions/sharpify_wrapper";
import { calculateCheckoutCents, fromCents, toCents } from "./money";

type CartType = "buy" | "renew";
type Provider = "efi" | "promisse" | "sharpify" | "manual";
type Source = "webhook" | "polling" | "manual";
export type PaymentConfirmationStatus = "already_confirmed" | "confirmed" | "pending" | "rejected" | "failed";

export interface ConfirmPaymentInput {
    cartType: CartType;
    cartId: string;
    provider: Provider;
    externalPaymentId: string;
    source: Source;
    requestId?: string;
    manualApproval?: { adminDiscordId: string; reason: string };
}

export interface ConfirmPaymentResult {
    status: PaymentConfirmationStatus;
    cartId: string;
    operationKey?: string;
    reason?: string;
}

type ProviderResult = {
    final: boolean;
    paid: boolean;
    status: string;
    amountCents?: number;
    currency: string;
    sanitized: Record<string, unknown>;
};

function normalizeProviderAmount(value: unknown, expectedCents: number): number | undefined {
    if (typeof value === "string" && value.trim()) return toCents(value);
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    if (Number.isInteger(value) && value === expectedCents) return value;
    return toCents(value);
}

function eventHash(value: Record<string, unknown>) {
    return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function queryProvider(provider: Provider, ownerDiscordId: string, externalPaymentId: string, expectedCents: number, manualApproval?: ConfirmPaymentInput["manualApproval"]): Promise<ProviderResult> {
    if (provider === "manual") {
        if (!manualApproval?.adminDiscordId || manualApproval.reason.trim().length < 8) {
            return { final: true, paid: false, status: "MANUAL_APPROVAL_REQUIRED", currency: "BRL", sanitized: { status: "MANUAL_APPROVAL_REQUIRED" } };
        }
        return { final: true, paid: true, status: "MANUALLY_APPROVED", amountCents: expectedCents, currency: "BRL", sanitized: { status: "MANUALLY_APPROVED", approvedBy: manualApproval.adminDiscordId, reason: manualApproval.reason.slice(0, 300) } };
    }
    if (provider === "efi") {
        const gateway = await efiWrapper.getInstance(ownerDiscordId);
        if (!gateway?.isValid) throw new Error("gateway_unavailable");
        const charge = await gateway.instance.pixDetailCharge({ txid: externalPaymentId });
        const status = String(charge?.status || "UNKNOWN").toUpperCase();
        const amountCents = normalizeProviderAmount(charge?.valor?.original, expectedCents);
        return { final: ["CONCLUIDA", "REMOVIDA_PELO_USUARIO_RECEBEDOR", "REMOVIDA_PELO_PSP"].includes(status), paid: status === "CONCLUIDA", status, amountCents, currency: "BRL", sanitized: { status, txid: charge?.txid || externalPaymentId, amountCents } };
    }
    const settings = await databases.userSettings.findOne({ userId_discord: ownerDiscordId }).select("+promissepay_credentials +sharpify_credentials").lean();
    if (!settings) throw new Error("gateway_configuration_missing");
    if (provider === "promisse") {
        const apiKey = settings.promissepay_credentials?.api_key;
        if (!apiKey) throw new Error("gateway_configuration_missing");
        const payment = await promisseWrapper.getTransactionStatus(apiKey, externalPaymentId);
        if (!payment) throw new Error("gateway_unavailable");
        const status = String(payment.status || "UNKNOWN").toUpperCase();
        const amountCents = normalizeProviderAmount(payment.amount, expectedCents);
        return { final: ["PAID", "APPROVED", "COMPLETED", "CANCELLED", "CANCELED", "FAILED", "REFUSED"].includes(status), paid: ["PAID", "APPROVED", "COMPLETED"].includes(status), status, amountCents, currency: "BRL", sanitized: { status, id: externalPaymentId, amountCents } };
    }
    const credentials = settings.sharpify_credentials;
    if (!credentials?.client_id || !credentials.client_secret) throw new Error("gateway_configuration_missing");
    const payment = await sharpifyWrapper.getPayment({ client_id: credentials.client_id, client_secret: credentials.client_secret }, externalPaymentId);
    if (!payment) throw new Error("gateway_unavailable");
    const status = String(payment.status || "UNKNOWN").toUpperCase();
    const rawAmount = (payment as Record<string, unknown>).amount ?? (payment as Record<string, unknown>).value ?? (payment as Record<string, unknown>).price;
    const amountCents = normalizeProviderAmount(rawAmount, expectedCents);
    return { final: ["APPROVED", "PAID", "COMPLETED", "CANCELLED", "CANCELED", "FAILED", "REFUSED"].includes(status), paid: ["APPROVED", "PAID", "COMPLETED"].includes(status), status, amountCents, currency: "BRL", sanitized: { status, id: externalPaymentId, amountCents } };
}

export async function confirmPayment(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult> {
    const model = (input.cartType === "buy" ? databases.cartsBuy : databases.cartsRenew) as Model<any>;
    const cart = await model.findById(input.cartId).populate("coupon").lean() as Record<string, any> | null;
    if (!cart) return { status: "rejected", cartId: input.cartId, reason: "cart_not_found" };
    if (String(cart.paymentId || "") !== input.externalPaymentId) return { status: "rejected", cartId: input.cartId, reason: "payment_id_mismatch" };
    if (cart.step === "payment-confirmed" || cart.confirmedAt) return { status: "already_confirmed", cartId: input.cartId };
    if (cart.step !== "waiting-payment") return { status: "rejected", cartId: input.cartId, reason: "invalid_cart_state" };
    // Um carrinho vencido pelo cron continua com `step: waiting-payment`.
    // Não bloqueamos aqui porque o dinheiro pode ter sido pago dentro da
    // janela do provedor (ex.: cobrança EFI de 60min com carrinho de 30min).
    // A decisão final depende do status real da cobrança validada no provedor.
    const cartExpired = !!cart.expiresAt && new Date(cart.expiresAt).getTime() < Date.now();
    const statusAllowed = ["opened", "processing"].includes(String(cart.status)) || (String(cart.status) === "expired" && cartExpired);
    if (!statusAllowed) return { status: "rejected", cartId: input.cartId, reason: "invalid_cart_state" };

    const store = await databases.stores.findById(cart.storeId).lean();
    if (!store) return { status: "rejected", cartId: input.cartId, reason: "store_not_found" };
    const owner = await databases.userSettings.findOne({ userId_campos: store.ownerId_campos }).lean();
    const configuredProvider = owner?.payment_gateway || "manual";
    if (!owner || configuredProvider !== input.provider) return { status: "rejected", cartId: input.cartId, reason: "gateway_mismatch" };

    const discount = Number(cart.couponDiscountSnapshot ?? cart.coupon?.discount ?? 0);
    const prices = calculateCheckoutCents(Number(cart.price || 0), discount, 1.2);
    const expectedCents = Number.isSafeInteger(cart.finalPriceCents) ? cart.finalPriceCents : Number.isFinite(cart.finalPrice) ? toCents(cart.finalPrice) : prices.chargedCents;
    let providerResult: ProviderResult;
    try {
        providerResult = await queryProvider(input.provider, owner.userId_discord, input.externalPaymentId, expectedCents, input.manualApproval);
    } catch (error) {
        return { status: "failed", cartId: input.cartId, reason: error instanceof Error ? error.message : "gateway_unavailable" };
    }

    const eventKey = `${input.provider}:${input.externalPaymentId}:${providerResult.status}`;
    const eventDocument = { eventKey, cartType: input.cartType, cartId: input.cartId, provider: input.provider, externalPaymentId: input.externalPaymentId, source: input.source, status: providerResult.status, amountCents: providerResult.amountCents, currency: providerResult.currency, payloadHash: eventHash(providerResult.sanitized), sanitizedPayload: providerResult.sanitized, requestId: input.requestId };
    await databases.paymentEvents.updateOne({ eventKey }, { $setOnInsert: eventDocument }, { upsert: true }).catch((error: any) => { if (error?.code !== 11000) throw error; });
    if (!providerResult.final) return { status: "pending", cartId: input.cartId };
    if (!providerResult.paid) {
        // Cobrança final recusada/cancelada; no caso de carrinho vencido isso
        // apenas confirma que não houve pagamento válido.
        return cartExpired ? { status: "rejected", cartId: input.cartId, reason: "cart_expired" } : { status: "rejected", cartId: input.cartId, reason: providerResult.status.toLowerCase() };
    }
    if (providerResult.currency !== "BRL" || providerResult.amountCents !== expectedCents) return { status: "rejected", cartId: input.cartId, reason: "amount_or_currency_mismatch" };

    const operationKey = `sale:${input.cartType}:${input.cartId}:${input.externalPaymentId}`;
    const existingLedger = await databases.ledgerOperations.findOne({ operationKey }).lean();
    if (existingLedger?.state === "applied") return { status: "already_confirmed", cartId: input.cartId, operationKey };
    await databases.ledgerOperations.updateOne({ operationKey }, { $setOnInsert: { operationKey, cartType: input.cartType, cartId: input.cartId, storeId: String(cart.storeId), externalPaymentId: input.externalPaymentId, provider: input.provider, amountCents: prices.netCents, state: "pending" } }, { upsert: true });

    const claimed = await model.updateOne({ _id: cart._id, status: { $in: ["opened", "expired"] }, step: "waiting-payment" }, { $set: { status: "processing", deliveryState: "payment_confirmed", grossPriceCents: prices.grossCents, discountCents: prices.discountCents, finalPriceCents: expectedCents, finalPrice: fromCents(expectedCents), couponCodeSnapshot: cart.couponCodeSnapshot || cart.coupon?.code, couponDiscountSnapshot: discount, paymentProvider: input.provider, paymentSource: input.source } });
    if (!claimed.modifiedCount) {
        const current = await model.findById(cart._id, { step: 1, confirmedAt: 1 }).lean() as any;
        if (current?.step === "payment-confirmed" || current?.confirmedAt) return { status: "already_confirmed", cartId: input.cartId, operationKey };
        return { status: "failed", cartId: input.cartId, operationKey, reason: "confirmation_in_progress" };
    }

    try {
        await databases.stores.updateOne({ _id: cart.storeId, creditedOperationKeys: { $ne: operationKey } }, { $inc: { balance: fromCents(prices.netCents) }, $addToSet: { creditedOperationKeys: operationKey } });
        await databases.extracts.updateOne({ operationKey }, { $setOnInsert: { operationKey, origin: "sales", action: "add", amount: fromCents(prices.netCents), description: `${input.cartType === "buy" ? "Compra" : "Renovação"} paga por ${cart.userId}`, storeId: String(cart.storeId) } }, { upsert: true });
const confirmedAt = new Date();
        let deliveryState = input.cartType === "renew" ? "delivered" : "payment_confirmed";
        let delivered = input.cartType === "renew";
        if (input.cartType === "renew") {
            const renewalSet: Record<string, unknown> = { status: "active" };
            if (cart.lifetime) renewalSet.lifetime = true;
            const pipeline: Record<string, unknown>[] = [
                { $set: { ...renewalSet, renewalOperationKeys: { $setUnion: [{ $ifNull: ["$renewalOperationKeys", []] }, [operationKey]] } } },
            ];
            if (!cart.lifetime && Number(cart.days) > 0) {
                pipeline.unshift({ $set: { expiresAt: { $dateAdd: { startDate: { $cond: [{ $gt: ["$expiresAt", "$$NOW"] }, "$expiresAt", "$$NOW"] }, unit: "day", amount: Number(cart.days) } } } });
            }
            const renewed = await databases.applications.updateOne({ _id: cart.applicationId, renewalOperationKeys: { $ne: operationKey } }, pipeline);
            if (!renewed.matchedCount) {
                const exists = await databases.applications.exists({ _id: cart.applicationId, renewalOperationKeys: operationKey });
                if (!exists) { deliveryState = "partial_delivery"; delivered = false; }
            }
        }
        await model.updateOne({ _id: cart._id, status: "processing" }, { $set: { step: "payment-confirmed", status: input.cartType === "renew" ? "closed" : "opened", confirmedAt, confirmedBy: input.manualApproval?.adminDiscordId || input.source, couponReservationState: cart.coupon ? (cart.couponReservationState === "released" ? "released" : "consumed") : undefined, deliveryState, delivered } });
        await databases.ledgerOperations.updateOne({ operationKey }, { $set: { state: "applied", appliedAt: confirmedAt }, $unset: { failureCode: 1 } });
        return { status: "confirmed", cartId: input.cartId, operationKey };
    } catch (error) {
        await model.updateOne({ _id: cart._id, status: "processing" }, { $set: { status: "opened", deliveryState: "retryable_error" } });
        await databases.ledgerOperations.updateOne({ operationKey }, { $set: { state: "failed", failureCode: "apply_failed" } });
        return { status: "failed", cartId: input.cartId, operationKey, reason: error instanceof Error ? error.message : "apply_failed" };
    }
}

export async function confirmPaymentByExternalId(input: Omit<ConfirmPaymentInput, "cartId" | "cartType"> & { cartType?: CartType }) {
    const targets: CartType[] = input.cartType ? [input.cartType] : ["buy", "renew"];
    for (const cartType of targets) {
        const model = (cartType === "buy" ? databases.cartsBuy : databases.cartsRenew) as Model<any>;
        const cart = await model.findOne({ paymentId: input.externalPaymentId }, { _id: 1 }).lean() as { _id: unknown } | null;
        if (cart) return confirmPayment({ ...input, cartType, cartId: String(cart._id) });
    }
    return { status: "rejected" as const, cartId: "", reason: "cart_not_found" };
}
