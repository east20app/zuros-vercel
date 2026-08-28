import { NextResponse } from "next/server";
import { confirmCartPayment } from "@root/src/integration/purchases";
import { findPaymentId } from "@/lib/webhooks";
import { readLimitedJson, safeEqual, webhookErrorStatus } from "@/lib/webhook-request";

export const runtime = "nodejs";
export async function POST(request: Request) {
    const requestId = crypto.randomUUID();
    if (!safeEqual(new URL(request.url).searchParams.get("token"), process.env.PROMISSEPAY_WEBHOOK_SECRET)) return NextResponse.json({ error: "unauthorized", requestId }, { status: 401 });
    try {
        const { payload } = await readLimitedJson(request);
        const paymentId = findPaymentId(payload);
        if (!paymentId) return NextResponse.json({ error: "invalid_payload", requestId }, { status: 400 });
        const result = await confirmCartPayment({ paymentId, provider: "promisse", source: "webhook" });
        return NextResponse.json({ accepted: true, status: result.status, requestId });
    } catch (error) {
        const response = webhookErrorStatus(error);
        return NextResponse.json({ error: response.code, requestId }, { status: response.status });
    }
}
