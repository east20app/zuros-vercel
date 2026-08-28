import { NextResponse } from "next/server";
import { confirmCartPayment } from "@root/src/integration/purchases";
import { findPaymentId } from "@/lib/webhooks";
import { readLimitedJson, safeEqual, webhookErrorStatus } from "@/lib/webhook-request";

export const runtime = "nodejs";
export async function POST(request: Request) {
    const requestId = crypto.randomUUID();
    const secret = new URL(request.url).searchParams.get("hmac");
    if (!safeEqual(secret, process.env.EFI_WEBHOOK_URL_SECRET)) return NextResponse.json({ error: "unauthorized", requestId }, { status: 401 });
    try {
        const { payload } = await readLimitedJson(request);
        const paymentId = findPaymentId(payload);
        if (!paymentId) return NextResponse.json({ error: "invalid_payload", requestId }, { status: 400 });
        const result = await confirmCartPayment({ paymentId, provider: "efi", source: "webhook" });
        return NextResponse.json({ accepted: true, status: result.status, requestId });
    } catch (error) {
        const response = webhookErrorStatus(error);
        return NextResponse.json({ error: response.code, requestId }, { status: response.status });
    }
}
