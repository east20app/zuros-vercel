import { notFound } from "next/navigation";
import Link from "next/link";
import { UserBotWorkspaceBar } from "@/components/UserBotWorkspaceBar";
import { getBotIdentity } from "@/lib/actions/apps.actions";
import { ActionError } from "@/lib/actions/context";

export default async function UserBotLayout({ children, params }: { children: React.ReactNode; params: Promise<{ appId: string }> }) {
    const resolvedParams = await params;
    let bot;
    try {
        bot = await getBotIdentity(resolvedParams.appId);
    } catch (error) {
        if (error instanceof ActionError) notFound();
        console.error("[dashboard-bot-layout] Falha ao carregar aplicação", error instanceof Error ? error.name : "unknown");
        return <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 px-5 text-center"><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-400">Aplicação indisponível</p><h1 className="text-2xl font-semibold text-white">Não foi possível carregar este bot agora.</h1><p className="text-sm text-zinc-400">A conexão com os dados da aplicação falhou. Tente novamente em instantes ou volte para Minhas aplicações.</p><Link href="/dashboard" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--foreground)] hover:border-[var(--accent)]">Voltar ao dashboard</Link></div>;
    }
    const routeId = bot.botId || bot.id;
    return <><UserBotWorkspaceBar routeId={routeId} name={bot.name} productName={bot.productName} active={bot.status === "active"} /><div className="bot-workspace-page">{children}</div></>;
}
