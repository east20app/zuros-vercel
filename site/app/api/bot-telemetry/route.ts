import crypto from "crypto";
import databases from "@root/src/databases";
import { recordActivity, type ActivityLevel } from "@root/src/integration/activity-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedLevels = new Set<ActivityLevel>(["info", "success", "warning", "error"]);

/** Recebe logs de bots Python hospedados, sempre vinculados a uma aplicação e loja. */
export async function POST(request: Request) {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bot ") ? authorization.slice(4).trim() : "";
    if (!token || token.length > 256) return Response.json({ error: "Não autorizado" }, { status: 401 });

    const body = await request.json().catch(() => null) as { applicationId?: unknown; botId?: unknown; level?: unknown; message?: unknown } | null;
    const applicationId = typeof body?.applicationId === "string" ? body.applicationId : "";
    const botId = typeof body?.botId === "string" ? body.botId : "";
    const message = typeof body?.message === "string" ? body.message.trim().slice(0, 2_000) : "";
    const level = typeof body?.level === "string" && allowedLevels.has(body.level as ActivityLevel) ? body.level as ActivityLevel : "info";
    if (!applicationId || !botId || !message) return Response.json({ error: "Payload inválido" }, { status: 400 });

    const application = await databases.applications.findOne(
        { _id: applicationId, botId },
        { storeId: 1, token: 1 },
    ).lean().catch(() => null);
    if (!application) return Response.json({ error: "Não autorizado" }, { status: 401 });

    const storedToken = String(application.token || "");
    const tokenMatches = !!storedToken && storedToken.length === token.length
        && crypto.timingSafeEqual(Buffer.from(storedToken), Buffer.from(token));
    if (!tokenMatches) return Response.json({ error: "Não autorizado" }, { status: 401 });

    recordActivity({ source: "bot", level, message, storeId: String(application.storeId) });
    return Response.json({ accepted: true }, { status: 202 });
}
