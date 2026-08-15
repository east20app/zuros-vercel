"use client";
import { useEffect, useState } from "react";
import type { ActivityEntry } from "@root/src/integration/activity-log";

const tones = { info: "bg-sky-400", success: "bg-emerald-400", warning: "bg-amber-400", error: "bg-red-400" };

export function ActivityFeed({ storeId }: { storeId: string }) {
    const [entries, setEntries] = useState<ActivityEntry[]>([]);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const response = await fetch(`/api/activity?storeId=${encodeURIComponent(storeId)}`, { cache: "no-store" });
                if (!response.ok) throw new Error("Falha ao carregar atividades");
                const data = await response.json() as { entries?: ActivityEntry[] };
                if (active) { setEntries(data.entries || []); setConnected(true); }
            } catch { if (active) setConnected(false); }
        };
        void load();
        const timer = setInterval(() => void load(), 5_000);
        return () => { active = false; clearInterval(timer); };
    }, [storeId]);

    return <section className="overflow-hidden rounded-2xl border border-white/[.07] bg-zinc-950/70" aria-labelledby="activity-title">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><h2 id="activity-title" className="font-semibold text-white">Atividade</h2><p className="text-xs text-zinc-400">Eventos das aplicações e do painel</p></div><span role="status" className="flex items-center gap-2 rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300"><i aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-zinc-500"}`} />{connected ? "Atualizado" : "Reconectando"}</span></header>
        <div className="max-h-80 divide-y divide-white/5 overflow-y-auto" aria-live="polite">
            {!entries.length && !connected && <div className="space-y-3 p-5" aria-label="Carregando atividades">{[1, 2, 3].map((item) => <div key={item} className="skeleton h-11 rounded-lg" />)}</div>}
            {!entries.length && connected && <div className="flex flex-col items-center p-8 text-center"><span aria-hidden="true" className="mb-3 text-2xl text-emerald-400">◎</span><p className="text-sm font-medium text-zinc-200">Tudo tranquilo por aqui</p><p className="mt-1 text-xs text-zinc-400">Os novos eventos aparecerão automaticamente.</p></div>}
            {entries.map((entry) => <article key={entry.id} className="flex gap-3 px-5 py-3 text-sm transition hover:bg-white/[.02]"><span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tones[entry.level]}`} /><div className="min-w-0 flex-1"><p className="truncate text-zinc-200">{entry.message}</p><p className="mt-0.5 text-xs text-zinc-500">{entry.source} · {new Date(entry.timestamp).toLocaleTimeString("pt-BR")}</p></div></article>)}
        </div>
    </section>;
}
