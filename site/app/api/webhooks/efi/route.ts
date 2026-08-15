import { NextResponse } from "next/server";
import { confirmCartPayment } from "@root/src/integration/purchases";
import { findPaymentId, verifyWebhookSignature } from "@/lib/webhooks";

export const runtime = "nodejs";
export async function POST(request: Request) {
    const raw = await request.text();
    if (!verifyWebhookSignature(raw, request.headers.get("x-webhook-signature") || request.headers.get("x-hub-signature-256"), process.env.EFI_WEBHOOK_SECRET)) {
        return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    }
    let payload: unknown;
    try { payload = JSON.parse(raw); }
    catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
    const paymentId = findPaymentId(payload);
    if (!paymentId) return NextResponse.json({ error: "Pagamento não identificado." }, { status: 400 });
    return NextResponse.json(await confirmCartPayment({ paymentId }));
}
