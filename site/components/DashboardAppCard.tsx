import Link from "next/link";
import { getRemainingLabel, getRemainingTone } from "@/lib/status";
import type { AppSummary } from "@/lib/types";
import { Badge } from "./ui";

export function DashboardAppCard({ app, index = 0 }: { app: AppSummary; index?: number }) {
    const tone = getRemainingTone(app.expiresAt, app.lifetime);
    const expiring = app.status === "active" && tone !== "green";
    const routeId = app.botId || app.id;
    const href = app.kind === "auth" ? `/dashboard/auth/${app.id}` : `/dashboard/${routeId}`;

    return (
        <Link
            href={href}
            aria-label={`Abrir ${app.name}`}
            className="zuros-card zuros-card-lit zuros-lift group flex h-full flex-col gap-4 p-5 animate-fade-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            style={{ animationDelay: `${index * 45}ms` }}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-base font-bold text-white shadow-[0_0_18px_-8px_rgba(235,69,158,.6)]">
                        {app.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-display font-semibold text-white transition group-hover:text-violet-300">{app.name}</span>
                            <i
                                title={app.errorOnUpdate ? "Erro na atualização" : app.status !== "active" ? "Período de carência" : "Ativo"}
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                    app.errorOnUpdate
                                        ? "bg-red-500 shadow-[0_0_8px_rgba(242,63,67,.9)]"
                                        : app.status !== "active"
                                          ? "bg-amber-400 shadow-[0_0_8px_rgba(240,178,50,.9)]"
                                          : "bg-emerald-500 shadow-[0_0_8px_rgba(35,165,89,.9)]"
                                }`}
                            />
                        </div>
                        <p className="truncate text-xs text-zinc-500">{app.productName}</p>
                        {app.storeName ? <p className="truncate text-xs text-zinc-600">{app.storeName}</p> : null}
                    </div>
                </div>
                {app.errorOnUpdate ? <Badge tone="red">Erro</Badge> : app.status !== "active" ? <Badge tone="amber">Carência</Badge> : expiring ? <Badge tone="amber">Expira</Badge> : <Badge tone="green">Ativo</Badge>}
            </div>

            <div className="flex flex-col gap-1.5 rounded-xl border border-white/[.05] bg-background px-3 py-2.5 text-xs text-zinc-400">
                <div className="flex items-center justify-between">
                    <span>Plano</span>
                    <span className={tone === "red" ? "font-medium text-red-400" : tone === "amber" ? "font-medium text-amber-400" : "font-medium text-white"}>
                        {getRemainingLabel(app.expiresAt, app.lifetime)}
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <span>Versão</span>
                    <span className="font-medium text-zinc-200">{app.kind === "auth" ? app.version : `v${app.version}`}</span>
                </div>
            </div>

            <div className="mt-auto flex items-center justify-between pt-1 text-sm font-medium text-violet-300">
                <span>{app.kind === "auth" ? "Abrir ZUROS Auth" : "Abrir painel do bot"}</span>
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
            </div>
        </Link>
    );
}