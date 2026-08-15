import type { Metadata } from "next";
import { SiteUsersManager } from "@/components/SiteUsersManager";
import { listSiteUsers } from "@/lib/actions/site-users.actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Usuários · ZUROS APP" };

export default async function SiteUsersPage() {
    const data = await listSiteUsers();
    return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-white">Usuários do site</h1><p className="mt-1 text-sm text-zinc-500">Adicione usuários autorizados a qualquer servidor em que um dos seus bots esteja.</p></div><SiteUsersManager {...data} /></div>;
}
