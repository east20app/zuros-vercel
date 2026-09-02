import Link from "next/link";
import { getRemainingLabel, getRemainingTone } from "@/lib/status";
import type { AppSummary } from "@/lib/types";

export function DashboardAppCard({ app, index = 0 }: { app: AppSummary; index?: number }) {
    const tone = getRemainingTone(app.expiresAt, app.lifetime);
    const expiring = app.status === "active" && tone !== "green";
    const routeId = app.botId || app.id;
    const href = app.kind === "auth" ? `/dashboard/auth/${app.id}` : `/dashboard/${routeId}`;
    const statusLabel = app.errorOnUpdate ? "Atenção" : app.status !== "active" ? "Em pausa" : expiring ? "Renovar" : "Ativo";
    const remainingTone = tone === "red" ? "is-danger" : tone === "amber" ? "is-warning" : "is-good";
    const applicationId = (app.botId || app.id).slice(0, 10);

    return (
        <Link href={href} aria-label={`Abrir ${app.name}`} className="dashboard-app-card-v2 group animate-fade-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" style={{ animationDelay: `${index * 45}ms` }}>
            <div className="dashboard-app-card-v2-topline"><span>{app.kind === "auth" ? "ZUROS Auth" : "ZUROS Bot"}</span><span className={`dashboard-app-status dashboard-app-status-${remainingTone}`}><i />{statusLabel}</span></div>
            <div className="dashboard-app-card-v2-title"><span className="dashboard-app-avatar-v2">{app.name.charAt(0).toUpperCase()}</span><div className="min-w-0"><h3 className="truncate">{app.name}</h3><p className="truncate">ID: {applicationId}</p></div><span aria-hidden="true" className="dashboard-app-card-v2-arrow">↗</span></div>
            <div className="dashboard-app-card-v2-details"><div><span>Validade</span><strong className={remainingTone}>{getRemainingLabel(app.expiresAt, app.lifetime)}</strong></div><div><span>Plano</span><strong>{app.productName || app.storeName || "Aplicação"}</strong></div></div>
            <div className="dashboard-app-card-v2-footer"><span>Gerenciar aplicação</span><span className="dashboard-app-card-v2-cta">Abrir <b>→</b></span></div>
        </Link>
    );
}
