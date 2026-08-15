import type { AppSummary } from "@/lib/types";
import type { RenewPrices } from "@/lib/types";
import { formatDate, getRemainingLabel, getRemainingTone } from "@/lib/status";
import { RenewPanel } from "./RenewPanel";

export function RenewalAlerts({ entries }: { entries: Array<{ app: AppSummary; prices: RenewPrices }> }) {
    if (entries.length === 0) return null;
    const sorted = [...entries].sort((a, b) => {
        const aTime = a.app.expiresAt ? new Date(a.app.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.app.expiresAt ? new Date(b.app.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
    });
    return <section className="zuros-card zuros-card-lit mb-8 p-5 sm:p-6">
        <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300">!</span><div><h2 className="font-semibold text-white">Aplicações próximas do vencimento</h2><p className="mt-1 text-sm text-zinc-500">Renove antes do vencimento para evitar a interrupção do bot.</p></div></div>
        <div className="mt-5 grid gap-3">
            {sorted.map(({ app, prices }) => { const tone = getRemainingTone(app.expiresAt, app.lifetime); return <article key={app.id} className="rounded-xl border border-zinc-800/80 bg-black/25 p-4"><div className="mb-4"><h3 className="truncate text-sm font-medium text-white">{app.name}</h3><p className="mt-1 text-xs text-zinc-500">{app.productName} · vence em {formatDate(app.expiresAt)}</p><p className={`mt-1 text-xs font-medium ${tone === "red" ? "text-red-400" : "text-amber-400"}`}>{getRemainingLabel(app.expiresAt, app.lifetime)}</p></div><RenewPanel appId={app.id} prices={prices} hasLifetime={app.lifetime} /></article>; })}
        </div>
    </section>;
}
