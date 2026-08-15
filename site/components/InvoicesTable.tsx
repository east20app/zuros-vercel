"use client";

import { useEffect, useMemo, useState } from "react";
import type { UserInvoiceDTO } from "@/lib/actions/apps.actions";
import { Empty, StatusBadge, TechnicalId } from "./ui";
import { Icon } from "./Icon";

const PAGE_SIZE = 10;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function InvoicesTable({ invoices }: { invoices: UserInvoiceDTO[] }) {
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const filtered = useMemo(() => invoices.filter((invoice) => `${invoice.id} ${invoice.item} ${invoice.plan} ${invoice.type}`.toLowerCase().includes(query.toLowerCase())), [invoices, query]);
    const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
    const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    useEffect(() => setPage(1), [query]);
    return <>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <label className="flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-4 py-3 text-zinc-600 transition focus-within:border-emerald-500/50"><Icon name="dashboard" className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por aplicação, plano ou ID..." className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder-zinc-600" /></label>
            <div className="flex items-center gap-3 text-xs text-zinc-600"><button aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-800 transition hover:text-white disabled:opacity-30"><Icon name="arrow-left" className="h-4 w-4" /></button><span>{pageCount ? page : 0} / {pageCount}</span><button aria-label="Próxima página" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-800 transition hover:text-white disabled:opacity-30"><Icon name="arrow-right" className="h-4 w-4" /></button></div>
        </div>
        {visible.length === 0 ? <Empty icon={<Icon name="invoice" />} title="Você ainda não possui faturas." /> : <div className="overflow-x-auto rounded-2xl border border-zinc-800/80"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-zinc-500"><tr><th className="p-4">Aplicação / produto</th><th className="p-4">Plano contratado</th><th className="p-4 text-right">Valor contratado</th><th className="p-4">Tipo</th><th className="p-4">Status</th></tr></thead><tbody>{visible.map((invoice) => <tr key={`${invoice.type}-${invoice.id}`} className="border-t border-zinc-900 text-zinc-400 hover:bg-white/[.02]"><td className="p-4"><b className="mb-1 block font-medium text-zinc-200">{invoice.item}</b><TechnicalId value={invoice.id} /></td><td className="p-4 font-medium text-white">{invoice.plan}</td><td className="p-4 text-right font-semibold tabular-nums text-emerald-300">{money.format(invoice.amount)}</td><td className="p-4"><span className="inline-flex items-center gap-2"><Icon name={invoice.type === "purchase" ? "cart" : "invoice"} className="h-4 w-4 text-[#7983f5]" />{invoice.type === "purchase" ? "Compra" : "Renovação"}</span></td><td className="p-4"><StatusBadge status={invoice.status} /></td></tr>)}</tbody></table></div>}
        <p className="mt-3 text-xs text-zinc-700">Mostrando {visible.length} de {filtered.length} faturas.</p>
    </>;
}
