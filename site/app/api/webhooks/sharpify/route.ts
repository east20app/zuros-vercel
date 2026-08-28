import crypto from "crypto";
import { NextResponse } from "next/server";
import databases from "@root/src/databases";
import { confirmPaymentByExternalId } from "@root/src/integration/payment-confirmation";
import { readLimitedJson, safeEqual, webhookErrorStatus } from "@/lib/webhook-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const requestId = crypto.randomUUID();
    const integration = new URL(request.url).searchParams.get("integration") || "";
    if (!/^[a-f0-9]{64}$/i.test(integration)) return NextResponse.json({ error: "unauthorized", requestId }, { status: 401 });
    const owner = await databases.userSettings.findOne({ "sharpify_credentials.webhook_id": integration }).select("userId_discord sharpify_credentials").lean();
    const secret = owner?.sharpify_credentials?.client_secret;
    const signature = request.headers.get("x-zuros-sharpify-signature");
    const expected = secret ? crypto.createHash("sha256").update(secret).digest("hex") : "";
    if (!safeEqual(signature, expected)) return NextResponse.json({ error: "unauthorized", requestId }, { status: 401 });
    try {
        const { payload } = await readLimitedJson(request);
        const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
        const event = root?.event && typeof root.event === "object" ? root.event as Record<string, unknown> : null;
        if (root?.schemaVersion !== 1 || !event?.webhookId || !event?.id || !event?.name || !event?.contextId) return NextResponse.json({ error: "invalid_payload", requestId }, { status: 400 });
        const sanitized = { schemaVersion: 1, event: { webhookId: String(event.webhookId), id: String(event.id), name: String(event.name), context: String(event.context || "UNKNOWN"), contextId: String(event.contextId), occurredAt: String(event.occurredAt || "") } };
        await databases.sharpifyEvents.updateOne({ webhookId: sanitized.event.webhookId }, { $setOnInsert: { webhookId: sanitized.event.webhookId, ownerDiscordId: owner!.userId_discord, eventId: sanitized.event.id, name: sanitized.event.name, context: sanitized.event.context, contextId: sanitized.event.contextId, occurredAt: new Date(sanitized.event.occurredAt || Date.now()), payload: sanitized } }, { upsert: true });
        const result = await confirmPaymentByExternalId({ externalPaymentId: sanitized.event.contextId, provider: "sharpify", source: "webhook", requestId });
        return NextResponse.json({ accepted: true, status: result.status, requestId });
    } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) return NextResponse.json({ accepted: true, duplicate: true, requestId });
        const response = webhookErrorStatus(error);
        return NextResponse.json({ error: response.code, requestId }, { status: response.status });
    }
}
