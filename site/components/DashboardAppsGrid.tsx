"use client";

import { useMemo, useState } from "react";
import type { AppSummary } from "@/lib/types";
import { DashboardAppCard } from "./DashboardAppCard";

export function DashboardAppsGrid({ apps }: { apps: AppSummary[] }) {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("all");
    const visible = useMemo(() => apps.filter((app) => {
        const matchesName = app.name.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"));
        const matchesStatus = status === "all" || (status === "active" ? app.status === "active" : app.status !== "active");
        return matchesName && matchesStatus;
    }), [apps, query, status]);

    return (
        <>
            {apps.length > 3 ? (
                <div className="dashboard-library-toolbar">
                    <label className="dashboard-library-search">
                        <span className="dashboard-toolbar-icon" aria-hidden="true">⌕</span>
                        <span className="sr-only">Buscar aplicação</span>
                        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Encontre uma aplicação..." />
                        <span className="dashboard-search-hint">{visible.length}/{apps.length}</span>
                    </label>
                    <label className="dashboard-library-filter">
                        <span className="dashboard-filter-label">Mostrar</span>
                        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar aplicações por estado">
                            <option value="all">Todas</option>
                            <option value="active">Em operação</option>
                            <option value="attention">Precisam de atenção</option>
                        </select>
                    </label>
                </div>
            ) : null}
            {visible.length ? (
                <div className="dashboard-app-grid-v2">{visible.map((app, index) => <DashboardAppCard key={app.id} app={app} index={index} />)}</div>
            ) : (
                <div className="dashboard-filter-empty"><span>⌕</span><strong>Nenhuma aplicação encontrada.</strong><small>Tente outro nome ou mude o filtro de estado.</small></div>
            )}
        </>
    );
}
