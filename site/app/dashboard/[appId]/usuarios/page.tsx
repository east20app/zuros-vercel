import { listApplicationDiscordMembers } from "@/lib/actions/discord-members.actions";
import { requireUser } from "@/lib/require-admin";
import { ActionError } from "@/lib/actions/context";
import { notFound } from "next/navigation";
import { MembersTable } from "@/components/MembersTable";
export const dynamic = "force-dynamic";
export default async function ApplicationUsersPage({ params }: { params: Promise<{ appId: string }> }) {
    await requireUser(); const { appId } = await params; let data;
    try { data = await listApplicationDiscordMembers(appId); } catch (error) { if (error instanceof ActionError) notFound(); throw error; }
    return <main className="mx-auto max-w-6xl px-5 py-8"><header className="bot-page-hero"><p className="home-section-index">APLICAÇÃO / DISCORD</p><h1>Usuários do servidor</h1><p>{data.applicationName} · {data.members.length} usuário(s) retornado(s) pelo Discord.</p></header><section className="sales-summary"><article className="sales-pending-stat"><span>USUÁRIOS REAIS</span><strong>{data.members.length}</strong><small>Consulta direta ao servidor</small></article><article className="sales-pending-stat"><span>ROBÔS</span><strong>{data.members.filter((member) => member.bot).length}</strong><small>Contas automatizadas</small></article><article className="sales-pending-stat"><span>PESSOAS</span><strong>{data.members.filter((member) => !member.bot).length}</strong><small>Membros humanos</small></article></section>{data.message && <p className="support-notice">{data.message}</p>}{data.members.length > 0 && <section className="card mt-6 overflow-hidden p-4"><MembersTable members={data.members} /></section>}</main>;
}
