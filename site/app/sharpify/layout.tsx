import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/require-admin";
import { Sidebar } from "@/components/Sidebar";
import { canAccessAdmin, getStoresForUser } from "@/lib/actions/context";
import { getUserPendingCount } from "@root/src/integration/public-dashboard";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Sharpify · ZUROS", robots: { index: false, follow: false, nocache: true } };
export default async function Layout({children}:{children:React.ReactNode}){const user=await getSessionUser();if(!user)redirect("/login?callbackUrl=/sharpify");if(!await canAccessAdmin(user.discordId))redirect("/dashboard");const [stores,pendingCount]=await Promise.all([getStoresForUser(user.discordId),getUserPendingCount(user.discordId)]);const balance=stores.reduce((sum,s)=>sum+(s.balance||0),0);return <div className="relative min-h-screen"><div className="zuros-backdrop"/><div className="zuros-grid"/><Sidebar user={user} balance={balance} pendingCount={pendingCount} canAdmin defaultAdminStoreId={stores[0]?String(stores[0]._id):undefined}/><main className="min-h-screen px-5 pb-8 pt-24 sm:px-8 lg:ml-64 lg:px-10 lg:pt-20">{children}</main></div>}