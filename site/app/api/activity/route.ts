import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStoresForUser } from "@/lib/actions/context";
import { listActivity } from "@root/src/integration/activity-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.discordId;
    if (!discordId) return new Response("Não autenticado", { status: 401 });
    const storeId = new URL(request.url).searchParams.get("storeId") || undefined;
    const stores = await getStoresForUser(discordId);
    const allowedStoreIds = new Set(stores.map((store) => String(store._id)));
    if (storeId && !allowedStoreIds.has(storeId)) return new Response("Acesso negado", { status: 403 });
    const entries = listActivity(storeId)
        .filter((entry) => !!entry.storeId && allowedStoreIds.has(entry.storeId))
        .slice(0, 30);
    return Response.json({ entries }, { headers: { "Cache-Control": "no-store" } });
}
