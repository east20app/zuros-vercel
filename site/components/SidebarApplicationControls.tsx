"use client";

import { useEffect, useState } from "react";
import { getAppDetail } from "@/lib/actions/apps.actions";
import type { AppStatus } from "@/lib/types";
import { AppControls } from "./AppControls";
import { BrandLogo } from "./BrandLogo";

type ApplicationSummary = {
    id: string;
    name: string;
    botId: string;
    status: AppStatus;
    online: boolean;
};

export function SidebarApplicationControls({ appId }: { appId: string }) {
    const [app, setApp] = useState<ApplicationSummary | null>(null);

    useEffect(() => {
        let active = true;
        setApp(null);
        getAppDetail(appId)
            .then((detail) => {
                if (active) setApp({ id: detail.id, name: detail.name, botId: detail.botId, status: detail.status, online: detail.online });
            })
            .catch(() => {
                if (active) setApp(null);
            });
        return () => { active = false; };
    }, [appId]);

    if (!app) return <div className="mt-4 space-y-2" aria-label="Carregando controles"><div className="h-20 animate-pulse rounded-2xl bg-white/[.06]" /><div className="h-14 animate-pulse rounded-2xl bg-white/[.06]" /></div>;

    return <>
        <div className="mt-4 lg:hidden">
            <div className="flex items-center gap-4 rounded-2xl border border-white/[.08] bg-[#101014] p-4 shadow-xl shadow-black/20">
                <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-violet-500/20 bg-violet-500/10"><BrandLogo compact className="h-11 w-11" /></span>
                <span className="min-w-0 flex-1"><b className="block truncate text-base text-white">{app.name || "Aplicação ZUROS"}</b><small className="mt-1 flex items-center gap-2 text-xs text-zinc-400"><i className={`h-2.5 w-2.5 rounded-full ${app.online ? "bg-emerald-400" : "bg-zinc-600"}`} />{app.online ? "Aplicação ativa" : "Aplicação offline"}</small></span>
                <span className="text-xl text-zinc-600">⌄</span>
            </div>
            <div className="mt-3"><AppControls appId={app.id} botId={app.botId} status={app.status} online={app.online} variant="quick" /></div>
        </div>
        <div className="mt-4 hidden shrink-0 rounded-xl border border-violet-500/20 bg-violet-500/[.055] p-3 lg:block">
            <div className="sidebar-scrollbar max-h-52 overflow-y-auto pr-1"><AppControls appId={app.id} botId={app.botId} status={app.status} online={app.online} variant="quick" /></div>
        </div>
    </>;
}