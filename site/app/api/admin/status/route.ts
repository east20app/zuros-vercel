import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStoresForUser } from "@/lib/actions/context";
import { getPlatformTelemetry, reportStatus, type TelemetrySeverity } from "@root/src/integration/telemetry";
export const dynamic = "force-dynamic";

const validSeverity = new Set<TelemetrySeverity>(["all", "error", "warn", "info"]);
const validService = new Set(["all", "bot", "web", "system"]);

export async function GET(request: Request) {
    reportStatus("web", "online", "Painel standalone operacional");
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.discordId;
    if (!discordId) return Response.json({ error: "Não autenticado." }, { status: 401 });
    if (!(await getStoresForUser(discordId)).length) return Response.json({ error: "Acesso administrativo necessário." }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const rawSeverity = searchParams.get("severity") || "all";
    const rawService = searchParams.get("service") || "all";
    const rawLimit = Number(searchParams.get("limit") || 50);

    return Response.json(getPlatformTelemetry({
        severity: validSeverity.has(rawSeverity as TelemetrySeverity) ? rawSeverity as TelemetrySeverity : "all",
        service: validService.has(rawService) ? rawService as "all" | "bot" | "web" | "system" : "all",
        limit: Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50,
    }), { headers: { "Cache-Control": "no-store" } });
}
