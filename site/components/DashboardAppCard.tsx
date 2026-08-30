import Link from "next/link";
import { getRemainingLabel, getRemainingTone } from "@/lib/status";
import type { AppSummary } from "@/lib/types";
import { Badge } from "./ui";

export function DashboardAppCard({ app, index = 0 }: { app: AppSummary; index?: number }) {
    const tone = getRemainingTone(app.expiresAt, app.lifetime);
    const expiring = app.status === "active" && tone !== "green";
    const routeId = app.botId || app.id;
    const href = app.kind === "auth" ? `/dashboard/auth/${app.id}` : `/dashboard/${routeId}`;
    const statusLabel = app.errorOnUpdate ? "Erro" : app.status !== "active" ? "Carência" : expiring ? "Expira" : "Ativo";

    return <Link href={href} aria-label={`Abrir ${app.name}`} className="dashboard-app-card group animate-fade-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" style={{ animationDelay: `${index * 45}ms` }}>
        <div className="dashboard-app-card-top"><div className="flex min-w-0 items-start gap-3"><span className="dashboard-app-avatar">{app.name.charAt(0).toUpperCase()}</span><div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate font-display font-semibold text-white transition group-hover:text-[var(--accent)]">{app.name}</span><i className={`dashboard-status-dot ${app.errorOnUpdate ? "is-error" : app.status !== "active" ? "is-warning" : "is-online"}`} /></div><p className="truncate text-xs text-zinc-500">{app.productName}</p>{app.storeName ? <p className="truncate text-xs text-zinc-600">{app.storeName}</p> : null}</div></div><Badge tone={app.errorOnUpdate ? "red" : app.status !== "active" ? "amber" : expiring ? "amber" : "green"}>{statusLabel}</Badge></div>
        <div className="dashboard-app-meta"><div><span>Plano</span><strong className={tone === "red" ? "text-red-400" : tone === "amber" ? "text-amber-400" : "text-[var(--accent)]"}>{getRemainingLabel(app.expiresAt, app.lifetime)}</strong></div><div><span>Versão</span><strong>{app.kind === "auth" ? app.version : `v${app.version}`}</strong></div></div>
        <div className="dashboard-app-card-footer"><span>{app.kind === "auth" ? "Abrir ZUROS Auth" : "Abrir painel do bot"}</span><span aria-hidden className="dashboard-app-arrow">↗</span></div>
    </Link>;
}
