import crypto from "crypto";

export const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

export function safeEqual(left: string | null | undefined, right: string | null | undefined) {
    if (!left || !right) return false;
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function readLimitedJson(request: Request, maxBytes = MAX_WEBHOOK_BODY_BYTES): Promise<{ raw: string; payload: unknown }> {
    const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (contentType !== "application/json") throw new Error("unsupported_media_type");
    const declared = Number(request.headers.get("content-length") || 0);
    if (declared > maxBytes) throw new Error("payload_too_large");
    if (!request.body) throw new Error("empty_body");
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { await reader.cancel(); throw new Error("payload_too_large"); }
        chunks.push(value);
    }
    const raw = new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
    try { return { raw, payload: JSON.parse(raw) }; }
    catch { throw new Error("invalid_json"); }
}

export function webhookErrorStatus(error: unknown) {
    const code = error instanceof Error ? error.message : "invalid_request";
    if (code === "payload_too_large") return { code, status: 413 };
    if (code === "unsupported_media_type") return { code, status: 415 };
    return { code: ["invalid_json", "empty_body"].includes(code) ? code : "invalid_request", status: 400 };
}
