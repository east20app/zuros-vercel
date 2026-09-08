import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { DashboardAppsGrid } from "@/components/DashboardAppsGrid";
import { Button } from "@/components/ui";
import { listMyApps } from "@/lib/actions/apps.actions";
import { requireUser } from "@/lib/require-admin";
import { isExpiring } from "@/lib/status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Visão geral · ZUROS APP",
    description: "Acompanhe a operação das suas aplicações ZUROS.",
};

export default async function DashboardPage() {
    await requireUser();
    const apps = await listMyApps();
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

    const active = sorted.filter((app) => app.status === "active").length;
    const expiring = sorted.filter((app) => isExpiring(app.expiresAt, app.lifetime)).length;
    const errors = sorted.filter((app) => app.errorOnUpdate).length;
    const paused = Math.max(0, apps.length - active);
    const percentage = (value: number) => apps.length ? Math.round((value / apps.length) * 100) : 0;
    const attention = errors + expiring;

    return (
        <main className="dashboard-command-center mx-auto min-w-0 max-w-[1440px] px-4 py-5 sm:px-7 lg:px-10">
            <header className="dashboard-command-header">
                <div>
                    <p className="dashboard-command-breadcrumb"><span>Painel</span><b>›</b><strong>Visão geral</strong></p>
                    <h1>Visão geral</h1>
                    <p className="dashboard-command-subtitle">Acompanhe o estado das suas aplicações e a operação da sua conta.</p>
                </div>
                <div className="dashboard-command-actions">
                    <span className="dashboard-period-chip">◷ Últimos 30 dias</span>
                    <Button href="/planos" className="dashboard-violet-button">Comprar aplicação</Button>
                </div>
            </header>

            <section aria-label="Resumo da operação" className="dashboard-kpi-grid">
                <article className="dashboard-kpi-card"><span>▣ Aplicações</span><strong>{apps.length}</strong><small className="is-positive">↗ {active} em operação</small></article>
                <article className="dashboard-kpi-card"><span>◉ Operação estável</span><strong>{percentage(active)}%</strong><small className={errors ? "is-negative" : "is-positive"}>{errors ? `↓ ${errors} com erro` : "↗ Nenhuma falha registrada"}</small></article>
                <article className="dashboard-kpi-card"><span>◌ Renovação próxima</span><strong>{expiring}</strong><small className={expiring ? "is-warning" : "is-positive"}>{expiring ? "Atenção necessária" : "Todos os planos em dia"}</small></article>
            </section>

            <section className="dashboard-command-panel dashboard-health-panel" aria-labelledby="health-heading">
                <div className="dashboard-panel-heading"><div><p className="dashboard-panel-kicker">MONITORAMENTO</p><h2 id="health-heading">Saúde das aplicações</h2><span>Distribuição atual da operação da sua conta</span></div><span className={`dashboard-live-badge${errors ? " is-warning" : ""}`}><i /> {errors ? "Atenção necessária" : "Operações normais"}</span></div>
                <div className="dashboard-health-layout">
                    <div className="dashboard-health-summary"><strong>{percentage(active)}<small>%</small></strong><span>índice de operação</span><div className="dashboard-health-ring" style={{ "--health-progress": `${percentage(active)}%` } as CSSProperties}><div><b>{active}</b><small>ativas</small></div></div></div>
                    <div className="dashboard-health-bars">
                        <div className="dashboard-health-row"><div><span><i className="is-green" />Em operação</span><b>{active}</b></div><div className="dashboard-health-track"><i className="is-green" style={{ width: `${percentage(active)}%` }} /></div></div>
                        <div className="dashboard-health-row"><div><span><i className="is-violet" />Renovação próxima</span><b>{expiring}</b></div><div className="dashboard-health-track"><i className="is-violet" style={{ width: `${percentage(expiring)}%` }} /></div></div>
                        <div className="dashboard-health-row"><div><span><i className="is-amber" />Em pausa</span><b>{paused}</b></div><div className="dashboard-health-track"><i className="is-amber" style={{ width: `${percentage(paused)}%` }} /></div></div>
                        <div className="dashboard-health-row"><div><span><i className="is-red" />Com erro</span><b>{errors}</b></div><div className="dashboard-health-track"><i className="is-red" style={{ width: `${percentage(errors)}%` }} /></div></div>
                    </div>
                </div>
            </section>

            <section className="dashboard-command-columns">
                <div className="dashboard-command-panel dashboard-recent-panel">
                    <div className="dashboard-panel-heading compact"><div><p className="dashboard-panel-kicker">ATIVIDADE</p><h2>Aplicações recentes</h2></div><a href="#applications">Ver todas <b>↗</b></a></div>
                    {sorted.length ? <div className="dashboard-recent-list">{sorted.slice(0, 5).map((app) => <a href={app.kind === "auth" ? `/dashboard/auth/${app.id}` : `/dashboard/${app.botId || app.id}`} key={app.id} className="dashboard-recent-row"><span className="dashboard-recent-avatar">{app.name.charAt(0).toUpperCase()}</span><span className="dashboard-recent-main"><strong>{app.name}</strong><small>{app.productName || "Aplicação"} · v{app.version}</small></span><span className={`dashboard-recent-status ${app.errorOnUpdate ? "is-red" : app.status !== "active" ? "is-amber" : "is-green"}`}><i />{app.errorOnUpdate ? "Erro" : app.status !== "active" ? "Pausada" : "Ativa"}</span><b className="dashboard-recent-arrow">→</b></a>)}</div> : <div className="dashboard-command-empty"><strong>Nenhuma aplicação ainda</strong><span>Compre sua primeira aplicação para começar.</span><Button href="/planos" className="dashboard-violet-button">Comprar aplicação</Button></div>}
                </div>
                <aside className="dashboard-command-panel dashboard-action-panel"><p className="dashboard-panel-kicker">PRÓXIMO PASSO</p><h2>{attention ? "Algumas aplicações precisam de atenção" : "Tudo funcionando normalmente"}</h2><p>{attention ? "Revise os itens destacados para manter sua operação estável." : "Sua conta está em ordem. Acompanhe suas aplicações por aqui."}</p><div className="dashboard-action-count"><strong>{attention}</strong><span>item(ns) para revisar</span></div><a href={attention ? "#applications" : "/dashboard/invoices"} className="dashboard-action-link">{attention ? "Revisar aplicações" : "Ver faturas"} <b>→</b></a></aside>
            </section>

            <section id="applications" className="dashboard-command-panel dashboard-applications-panel" aria-labelledby="applications-heading"><div className="dashboard-panel-heading"><div><p className="dashboard-panel-kicker">BIBLIOTECA</p><h2 id="applications-heading">Minhas aplicações</h2><span>Abra uma aplicação para acessar todas as configurações.</span></div><span className="dashboard-record-count">{apps.length} registro(s)</span></div><div className="mt-6">{sorted.length ? <DashboardAppsGrid apps={sorted} /> : <div className="dashboard-command-empty"><strong>Nenhuma aplicação vinculada</strong><span>Comece comprando uma aplicação no catálogo.</span><Button href="/planos" className="dashboard-violet-button">Comprar aplicação</Button></div>}</div></section>
        </main>
    );
}
