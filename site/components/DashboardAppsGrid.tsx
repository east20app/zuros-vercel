"use client";

import { useMemo, useState } from "react";
import type { AppSummary } from "@/lib/types";
import { DashboardAppCard } from "./DashboardAppCard";

export function DashboardAppsGrid({ apps }: { apps: AppSummary[] }) {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("all");
    const visible = useMemo(() => apps.filter((app) => app.name.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")) && (status === "all" || (status === "active" ? app.status === "active" : app.status !== "active"))), [apps, query, status]);
    return <>
        {apps.length > 6 && <div className="mb-5 grid gap-3 rounded-2xl border border-white/[.07] bg-surface/60 p-4 sm:grid-cols-[1fr_190px]"><label><span className="sr-only">Buscar por nome</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar bot por nome..." className="w-full rounded-lg border border-zinc-700 bg-background px-3 py-2.5 text-sm text-white placeholder:text-zinc-500" /></label><label><span className="sr-only">Filtrar por status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-lg border border-zinc-700 bg-background px-3 py-2.5 text-sm text-white"><option value="all">Todos os status</option><option value="active">Ativos</option><option value="grace">Em carência</option></select></label></div>}
        {visible.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((app, index) => <DashboardAppCard key={app.id} app={app} index={index} />)}</div> : <p className="rounded-xl border border-dashed border-zinc-700 py-10 text-center text-sm text-zinc-400">Nenhuma aplicação corresponde aos filtros.</p>}
    </>;
}
