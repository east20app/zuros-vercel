import { DashboardShell } from "@/components/DashboardShell";
import { requireUser } from "@/lib/require-admin";
import { canAccessAdmin, getStoresForUser } from "@/lib/actions/context";
import { getUserPendingCount } from "@root/src/integration/public-dashboard";
import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const user = await requireUser();
    const [storesResult, pendingResult, adminResult] = await Promise.allSettled([
        getStoresForUser(user.discordId),
        getUserPendingCount(user.discordId),
        canAccessAdmin(user.discordId),
    ]);
    const stores = storesResult.status === "fulfilled" ? storesResult.value : [];
    const pendingCount = pendingResult.status === "fulfilled" ? pendingResult.value : 0;
    const canAdmin = adminResult.status === "fulfilled" ? adminResult.value : false;
    if (storesResult.status === "rejected") console.error("[dashboard-layout] Falha ao carregar lojas", storesResult.reason);
    if (pendingResult.status === "rejected") console.error("[dashboard-layout] Falha ao carregar pendências", pendingResult.reason);
    if (adminResult.status === "rejected") console.error("[dashboard-layout] Falha ao verificar administração", adminResult.reason);
    const balance = stores.reduce((sum, store) => sum + (Number(store.balance) || 0), 0);
    return <div className="min-h-screen bg-background"><DashboardShell user={user} balance={balance} pendingCount={pendingCount} canAdmin={canAdmin}>{children}</DashboardShell></div>;
}
