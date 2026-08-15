import crypto from "crypto";

export function verifyWebhookSignature(rawBody: string, received: string | null, secret: string | undefined) {
    if (!secret || !received) return false;
    const normalized = received.replace(/^sha256=/i, "");
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (normalized.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(normalized), Buffer.from(expected));
}

export function findPaymentId(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null;
    const value = payload as Record<string, unknown>;
    const direct = value.txid || value.paymentId || value.transactionId || value.id;
    if (typeof direct === "string") return direct;
    if (Array.isArray(value.pix)) {
        const pix = value.pix[0] as Record<string, unknown> | undefined;
        if (typeof pix?.txid === "string") return pix.txid;
    }
    return findPaymentId(value.data);
}
