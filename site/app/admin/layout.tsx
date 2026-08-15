import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/require-admin";
import { Sidebar } from "@/components/Sidebar";
import { canAccessAdmin, getStoresForUser } from "@/lib/actions/context";
import { getUserPendingCount } from "@root/src/integration/public-dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const user = await getSessionUser();
    if (!user) redirect("/login?callbackUrl=/admin");
    if (!(await canAccessAdmin(user.discordId))) redirect("/dashboard");
    const [stores, pendingCount] = await Promise.all([getStoresForUser(user.discordId), getUserPendingCount(user.discordId)]);
    const balance = stores.reduce((sum, store) => sum + (store.balance || 0), 0);
    const defaultAdminStoreId = stores[0]?._id ? String(stores[0]._id) : undefined;

    return (
        <div className="relative min-h-screen"><div className="zuros-backdrop" aria-hidden /><div className="zuros-grid" aria-hidden /><Sidebar user={user} balance={balance} pendingCount={pendingCount} canAdmin defaultAdminStoreId={defaultAdminStoreId} /><main className="min-h-screen px-5 pb-8 pt-24 sm:px-8 lg:ml-64 lg:px-10 lg:pt-20">{children}</main></div>
    );
}
