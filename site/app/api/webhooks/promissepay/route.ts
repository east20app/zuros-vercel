import { NextResponse } from "next/server";
import { confirmCartPayment } from "@root/src/integration/purchases";
import { findPaymentId, verifyWebhookSignature } from "@/lib/webhooks";

export const runtime = "nodejs";
export async function POST(request: Request) {
    const raw = await request.text();
    if (!verifyWebhookSignature(raw, request.headers.get("x-webhook-signature") || request.headers.get("x-signature"), process.env.PROMISSEPAY_WEBHOOK_SECRET)) {
        return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    }
    let payload: unknown;
    try { payload = JSON.parse(raw); }
    catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
    const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const nested = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : {};
    const status = String(root.status || nested.status || "").toUpperCase();
    if (status && !["PAID", "APPROVED", "COMPLETED"].includes(status)) return NextResponse.json({ accepted: true });
    const paymentId = findPaymentId(payload);
    if (!paymentId) return NextResponse.json({ error: "Pagamento não identificado." }, { status: 400 });
    return NextResponse.json(await confirmCartPayment({ paymentId }));
}
