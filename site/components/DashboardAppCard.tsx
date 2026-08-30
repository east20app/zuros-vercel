import Link from "next/link";
import { getRemainingLabel, getRemainingTone } from "@/lib/status";
import type { AppSummary } from "@/lib/types";

function getAppKindLabel(app: AppSummary) {
    if (app.kind === "auth") return "Segurança e acesso";
    if (app.kind === "complete") return "Operação completa";
    return "Automação para Discord";
}

function getStateCopy(app: AppSummary, expiring: boolean) {
    if (app.errorOnUpdate) return { title: "Atualização pede revisão", detail: "Confira o painel para retomar o fluxo" };
    if (app.status !== "active") return { title: "Em período de carência", detail: "Renove para manter tudo funcionando" };
    if (expiring) return { title: "Renovação se aproximando", detail: "Garanta continuidade para sua comunidade" };
    return { title: "Operando normalmente", detail: "Nenhuma ação necessária agora" };
}

export function DashboardAppCard({ app, index = 0 }: { app: AppSummary; index?: number }) {
    const tone = getRemainingTone(app.expiresAt, app.lifetime);
    const expiring = app.status === "active" && tone !== "green";
    const routeId = app.botId || app.id;
    const href = app.kind === "auth" ? `/dashboard/auth/${app.id}` : `/dashboard/${routeId}`;
    const statusLabel = app.errorOnUpdate ? "Atenção" : app.status !== "active" ? "Em pausa" : expiring ? "Renovar" : "Ativo";
    const stateCopy = getStateCopy(app, expiring);
    const remainingTone = tone === "red" ? "is-danger" : tone === "amber" ? "is-warning" : "is-good";

    return (
        <Link href={href} aria-label={`Abrir ${app.name}`} className="dashboard-app-card-v2 group animate-fade-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" style={{ animationDelay: `${index * 45}ms` }}>
            <div className="dashboard-app-card-v2-topline"><span>{String(index + 1).padStart(2, "0")}</span><span>{getAppKindLabel(app)}</span><span className={`dashboard-app-status dashboard-app-status-${remainingTone}`}><i />{statusLabel}</span></div>
            <div className="dashboard-app-card-v2-title"><span className="dashboard-app-avatar-v2">{app.name.charAt(0).toUpperCase()}</span><div className="min-w-0"><h3 className="truncate">{app.name}</h3><p className="truncate">{app.storeName || app.productName}</p></div><span aria-hidden="true" className="dashboard-app-card-v2-arrow">↗</span></div>
            <div className="dashboard-app-state"><span className={`dashboard-state-pulse ${remainingTone}`} /><div><strong>{stateCopy.title}</strong><small>{stateCopy.detail}</small></div></div>
            <div className="dashboard-app-card-v2-details"><div><span>Plano</span><strong className={remainingTone}>{getRemainingLabel(app.expiresAt, app.lifetime)}</strong></div><div><span>Versão instalada</span><strong>{app.kind === "auth" ? app.version : `v${app.version}`}</strong></div></div>
            <div className="dashboard-app-card-v2-footer"><span>{app.kind === "auth" ? "Abrir área de segurança" : "Abrir espaço de operação"}</span><span className="dashboard-app-card-v2-cta">Continuar <b>→</b></span></div>
        </Link>
    );
}
