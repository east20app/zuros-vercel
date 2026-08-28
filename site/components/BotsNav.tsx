"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listMyApps } from "@/lib/actions/apps.actions";
import { isExpiring } from "@/lib/status";
import type { AppSummary } from "@/lib/types";

const REFRESH_INTERVAL_MS = 60_000; // fallback poll while tab stays visible

type StatusKind = "error" | "grace" | "expiring" | "active";

function getStatusKind(app: AppSummary): StatusKind {
    if (app.errorOnUpdate) return "error";
    if (app.status !== "active") return "grace";
    if (isExpiring(app.expiresAt, app.lifetime)) return "expiring";
    return "active";
}

const STATUS_STYLES: Record<StatusKind, { label: string; className: string }> = {
    error: { label: "Erro na atualização", className: "bg-red-500 shadow-[0_0_8px_rgba(242,63,67,.9)]" },
    grace: { label: "Período de carência", className: "bg-amber-400 shadow-[0_0_8px_rgba(240,178,50,.9)]" },
    expiring: { label: "Expira em breve", className: "bg-amber-400 shadow-[0_0_8px_rgba(240,178,50,.9)]" },
    active: { label: "Ativo", className: "bg-emerald-500 shadow-[0_0_8px_rgba(35,165,89,.9)]" },
};

function StatusDot({ app }: { app: AppSummary }) {
    const kind = getStatusKind(app);
    const { label, className } = STATUS_STYLES[kind];
    return (
        <span
            role="img"
            aria-label={label}
            title={label}
            className={`h-2 w-2 shrink-0 rounded-full ${className}`}
        />
    );
}

type AppRoute = { label: string; href: string };

function getAppRoutes(appId: string): AppRoute[] {
    return [
        { label: "Detalhes", href: `/dashboard/${appId}` },
        { label: "Servidores", href: `/dashboard/${appId}/servidores` },
        { label: "Configurar Bot", href: `/dashboard/${appId}/config` },
        { label: "Rendimentos", href: `/dashboard/${appId}/vendas` },
        { label: "Pedidos", href: `/dashboard/${appId}/vendas/pedidos` },
        { label: "Produtos", href: `/dashboard/${appId}/vendas/produtos` },
        { label: "Clientes", href: `/dashboard/${appId}/vendas/clientes` },
        { label: "Carrinhos abertos", href: `/dashboard/${appId}/vendas/carrinhos-abertos` },
        { label: "Pagamentos", href: `/dashboard/${appId}/vendas/pagamentos` },
    ];
}

const routeIdFor = (app: AppSummary) => app.botId || app.id;

function NavSubLink({ href, label, isActive, onNavigate }: { href: string; label: string; isActive: boolean; onNavigate?: () => void }) {
    return (
        <Link
            href={href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={`block rounded-lg px-3 py-1.5 text-xs transition ${
                isActive ? "bg-zinc-900 text-white" : "text-zinc-400 hover:bg-zinc-900/60 hover:text-white"
            }`}
        >
            {label}
        </Link>
    );
}

export function BotsNav({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname();
    const [apps, setApps] = useState<AppSummary[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    const [query, setQuery] = useState("");
    const [openIds, setOpenIds] = useState<Set<string>>(new Set());

    // Prevents a stale response from a stacked/overlapping refresh() call
    // (visibility flip + poll interval firing close together) from
    // overwriting a newer one.
    const requestIdRef = useRef(0);

    const refresh = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        setError(false);
        try {
            const nextApps = await listMyApps();
            if (requestId !== requestIdRef.current) return; // superseded, ignore

            setApps(nextApps);

            const validIds = new Set(nextApps.map(routeIdFor));
            setOpenIds((old) => {
                let changed = false;
                const next = new Set<string>();
                old.forEach((id) => {
                    if (validIds.has(id)) next.add(id);
                    else changed = true;
                });
                return changed ? next : old;
            });
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            console.error("Falha ao carregar bots:", err);
            setError(true);
        } finally {
            if (requestId === requestIdRef.current) setLoaded(true);
        }
    }, []);

    useEffect(() => {
        void refresh();

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") void refresh();
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        const intervalId = window.setInterval(() => {
            if (document.visibilityState === "visible") void refresh();
        }, REFRESH_INTERVAL_MS);

        return () => {
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.clearInterval(intervalId);
        };
    }, [refresh]);

    const activeAppId = pathname.match(/^\/dashboard\/([^/]+)(?:\/|$)/)?.[1];
    const activeApp = useMemo(() => apps.find((app) => routeIdFor(app) === activeAppId || app.id === activeAppId), [apps, activeAppId]);
    const showSearch = apps.length > 8;

    useEffect(() => {
        if (!showSearch && query) setQuery("");
    }, [showSearch, query]);

    const visibleApps = useMemo(() => {
        if (!showSearch || !query) return apps;
        const q = query.toLocaleLowerCase("pt-BR");
        return apps.filter((app) => app.name.toLocaleLowerCase("pt-BR").includes(q));
    }, [apps, query, showSearch]);

    useEffect(() => {
        if (activeAppId) {
            setOpenIds((old) => {
                if (old.has(activeAppId)) return old;
                const next = new Set(old);
                next.add(activeAppId);
                return next;
            });
        }
    }, [activeAppId]);

    const toggle = (id: string) => {
        setOpenIds((old) => {
            const next = new Set(old);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className="flex min-h-0 flex-col">
            <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[.22em] text-zinc-600">
                Todos os Bots
            </p>

            {activeApp && (
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-magenta-500/25 bg-magenta-500/10 px-3 py-2.5">
                    <i className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-magenta-400 shadow-[0_0_8px_rgba(235,69,158,.9)]" />
                    <div className="min-w-0">
                        <p className="truncate text-[10px] font-medium uppercase tracking-wider text-magenta-300">Bot ativo</p>
                        <p className="truncate text-xs font-semibold text-white">{activeApp.name}</p>
                    </div>
                </div>
            )}

            {showSearch && (
                <label className="relative mb-2 block px-1">
                    <span className="sr-only">Buscar bot</span>
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar bot..."
                        className="w-full rounded-lg border border-zinc-800 bg-background px-3 py-2 text-xs text-white placeholder:text-zinc-500"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery("")}
                            aria-label="Limpar busca"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                        >
                            ×
                        </button>
                    )}
                </label>
            )}

            <nav className="sidebar-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                {!loaded ? (
                    <div className="space-y-2 px-2 pt-1">
                        <div className="skeleton h-9 rounded-xl" />
                        <div className="skeleton h-9 rounded-xl" />
                        <div className="skeleton h-9 rounded-xl" />
                    </div>
                ) : error ? (
                    <div className="px-3 py-3 text-xs text-zinc-400">
                        <p>Não foi possível carregar os bots.</p>
                        <button type="button" onClick={() => void refresh()} className="mt-2 font-medium text-[#a78bfa] hover:text-white">
                            Tentar novamente
                        </button>
                    </div>
                ) : apps.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-zinc-400">Nenhuma aplicação ainda.</p>
                ) : visibleApps.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-zinc-400">Nenhum bot encontrado.</p>
                ) : (
                    visibleApps.map((app) => {
                        const routeId = routeIdFor(app);
                        const open = openIds.has(routeId);
                        const isActive = routeId === activeAppId || app.id === activeAppId;
                        return (
                            <div key={app.id} className="overflow-hidden rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => toggle(routeId)}
                                    aria-expanded={open}
                                    aria-controls={`bot-nav-${routeId}`}
                                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                                        isActive
                                            ? "border border-magenta-500/25 bg-magenta-500/10 text-white"
                                            : "border border-transparent text-zinc-400 hover:bg-zinc-900/60 hover:text-white"
                                    }`}
                                >
                                    <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-3.5 w-3.5 shrink-0 fill-none stroke-current text-zinc-500 transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
                                        <path d="m7 4 6 6-6 6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <StatusDot app={app} />
                                    <span className="min-w-0 flex-1 truncate font-medium">{app.name}</span>
                                </button>
                                {open && (
                                    <div id={`bot-nav-${routeId}`} className="ml-4 mt-1 space-y-0.5 border-l border-zinc-800/80 pl-3 animate-fade-in">
                                        {getAppRoutes(routeId).map(({ label, href }) => (
                                            <NavSubLink
                                                key={href}
                                                href={href}
                                                label={label}
                                                onNavigate={onNavigate}
                                                isActive={pathname === href || pathname.startsWith(`${href}/`)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </nav>
        </div>
    );
}