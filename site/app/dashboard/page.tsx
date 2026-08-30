import type { Metadata } from "next";
import { DashboardAppsGrid } from "@/components/DashboardAppsGrid";
import { Icon, type IconName } from "@/components/Icon";
import { Button } from "@/components/ui";
import { listMyApps } from "@/lib/actions/apps.actions";
import { requireUser } from "@/lib/require-admin";
import { getRemainingLabel, isExpiring } from "@/lib/status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Meus Bots · ZUROS APP",
    description: "Gerencie seus bots e renove sua assinatura.",
};

export default async function DashboardPage() {
    const [user, apps] = await Promise.all([requireUser(), listMyApps()]);
    const activeCount = apps.filter((app) => app.status === "active" && !app.errorOnUpdate).length;
    const attentionCount = apps.filter((app) => app.status !== "active" || app.errorOnUpdate || isExpiring(app.expiresAt, app.lifetime)).length;
    const nextExpiration = apps
        .filter((app) => !app.lifetime && app.expiresAt)
        .sort((a, b) => new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime())[0];
    const summary: Array<{ label: string; value: string | number; hint: string; icon: IconName; tone: string }> = [
        { label: "Total de bots", value: apps.length, hint: "Aplicações vinculadas", icon: "apps", tone: "lime" },
        { label: "Online agora", value: activeCount, hint: "Funcionando normalmente", icon: "check", tone: "green" },
        { label: "Próx. vencimento", value: nextExpiration ? getRemainingLabel(nextExpiration.expiresAt, false) : "—", hint: attentionCount ? "Confira os avisos" : "Tudo em ordem", icon: "alert", tone: "coral" },
    ];

    const sorted = [...apps].sort((a, b) => {
        const rank = (app: (typeof apps)[number]) => {
            let value = 0;
            if (app.errorOnUpdate) value += 1000;
            if (isExpiring(app.expiresAt, app.lifetime)) value += 500;
            if (app.status !== "active") value += 200;
            return value;
        };
        const difference = rank(b) - rank(a);
        if (difference !== 0) return difference;
        const aTime = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
        const bTime = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
        return aTime - bTime;
    });

    return <main className="dashboard-home mx-auto min-w-0 max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        <section className="dashboard-welcome">
            <div><p className="home-kicker"><span className="home-kicker-mark" />DASHBOARD / OVERVIEW</p><h1>Olá, {user.name || "usuário"}.</h1><p>Acompanhe o pulso dos seus bots, abra configurações e resolva o que pede atenção.</p></div>
            <div className="dashboard-welcome-state"><span>ESTADO DA OPERAÇÃO</span><strong>{activeCount > 0 ? "Estável" : apps.length ? "Revisar" : "Pronta"}</strong><small>{activeCount} de {apps.length} apps online</small></div>
            <div className="dashboard-welcome-actions"><Button href="/dashboard/invoices" variant="secondary">Ver faturas</Button><Button href="/planos">Comprar app</Button></div>
        </section>

        <section aria-label="Resumo das aplicações" className="dashboard-summary">{summary.map((item) => <article key={item.label} className={`dashboard-stat dashboard-stat-${item.tone}`}><span className="dashboard-stat-icon"><Icon name={item.icon} /></span><span className="min-w-0"><span className="dashboard-stat-value">{item.value}</span><b>{item.label}</b><small>{item.hint}</small></span></article>)}</section>

        <div className="dashboard-list-heading"><div><p className="home-section-index">01 / SUAS APLICAÇÕES</p><h2>O que está sob seu controle.</h2></div><span>{apps.length} {apps.length === 1 ? "aplicação" : "aplicações"}</span></div>
        <div className="mt-6">{sorted.length === 0 ? <div className="dashboard-empty"><div className="dashboard-empty-mark">+</div><h2>Você ainda não possui aplicações</h2><p>Escolha um app no catálogo, selecione o plano e faça a configuração do seu bot.</p><Button href="/planos" className="mt-5">Comprar meu primeiro app</Button></div> : <DashboardAppsGrid apps={sorted} />}</div>
    </main>;
}
