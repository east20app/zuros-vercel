import { DashboardShell } from "@/components/DashboardShell";
import { requireUser } from "@/lib/require-admin";
import { canAccessAdmin, getStoresForUser } from "@/lib/actions/context";
import { getUserPendingCount } from "@root/src/integration/public-dashboard";
import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };
export default async function DashboardLayout({ children }: { children: React.ReactNode }) { const user = await requireUser(); const [stores,pendingCount,canAdmin] = await Promise.all([getStoresForUser(user.discordId),getUserPendingCount(user.discordId),canAccessAdmin(user.discordId)]); const balance = stores.reduce((sum, store) => sum + (store.balance || 0), 0); return <div className="min-h-screen bg-background"><DashboardShell user={user} balance={balance} pendingCount={pendingCount} canAdmin={canAdmin}>{children}</DashboardShell></div>; }
