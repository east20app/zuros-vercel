"use client";

import { useEffect, useMemo, useState } from "react";
import type { UserInvoiceDTO } from "@/lib/actions/apps.actions";
import { Button, Empty, Modal, StatusBadge, TechnicalId } from "./ui";
import { Icon } from "./Icon";

const PAGE_SIZE = 10;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" });

export function InvoicesTable({ invoices }: { invoices: UserInvoiceDTO[] }) {
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [receipt, setReceipt] = useState<UserInvoiceDTO | null>(null);
    const filtered = useMemo(() => invoices.filter((invoice) => `${invoice.id} ${invoice.item} ${invoice.plan} ${invoice.type}`.toLowerCase().includes(query.toLowerCase())), [invoices, query]);
    const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
    const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    useEffect(() => setPage(1), [query]);

    function printReceipt(invoice: UserInvoiceDTO) {
        const popup = window.open("", "_blank", "width=760,height=900");
        if (!popup) return;
        const safe = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] || char);
        popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comprovante ZUROS ${safe(invoice.id)}</title><style>body{font-family:Arial,sans-serif;color:#18181b;max-width:720px;margin:48px auto;padding:24px}header{border-bottom:3px solid #7c3aed;padding-bottom:22px;margin-bottom:28px}h1{margin:0}small{color:#71717a}.row{display:flex;justify-content:space-between;gap:24px;padding:13px 0;border-bottom:1px solid #e4e4e7}.total{font-size:22px;font-weight:700;color:#6d28d9}.ok{margin-top:28px;padding:16px;border:1px solid #86efac;background:#f0fdf4;color:#166534;border-radius:10px}footer{margin-top:40px;color:#71717a;font-size:12px}@media print{body{margin:0}}</style></head><body><header><h1>ZUROS</h1><small>Comprovante de pagamento</small></header><div class="row"><span>Fatura</span><b>${safe(invoice.id)}</b></div><div class="row"><span>Transação</span><b>${safe(invoice.paymentId)}</b></div><div class="row"><span>Tipo</span><b>${invoice.type === "purchase" ? "Compra" : "Renovação"}</b></div><div class="row"><span>Produto/aplicação</span><b>${safe(invoice.item)}</b></div><div class="row"><span>Plano</span><b>${safe(invoice.plan)}</b></div><div class="row"><span>Data</span><b>${invoice.createdAt ? safe(date.format(new Date(invoice.createdAt))) : "—"}</b></div><div class="row total"><span>Total pago</span><span>${safe(money.format(invoice.amount))}</span></div><div class="ok">✓ Pagamento confirmado</div><footer>Documento gerado pelo painel ZUROS. Guarde o ID da transação para atendimento.</footer><script>window.onload=()=>window.print()<\/script></body></html>`);
        popup.document.close();
    }

    return <>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <label className="flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-4 py-3 text-zinc-600 transition focus-within:border-violet-500/50"><Icon name="dashboard" className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por aplicação, plano ou ID..." className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder-zinc-600" /></label>
            <div className="flex items-center gap-3 text-xs text-zinc-600"><button aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-800 transition hover:text-white disabled:opacity-30"><Icon name="arrow-left" className="h-4 w-4" /></button><span>{pageCount ? page : 0} / {pageCount}</span><button aria-label="Próxima página" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-800 transition hover:text-white disabled:opacity-30"><Icon name="arrow-right" className="h-4 w-4" /></button></div>
        </div>
        {visible.length === 0 ? <Empty icon={<Icon name="invoice" />} title="Você ainda não possui faturas." /> : <div className="overflow-x-auto rounded-2xl border border-zinc-800/80"><table className="w-full min-w-[820px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-zinc-500"><tr><th className="p-4">Aplicação / produto</th><th className="p-4">Plano</th><th className="p-4 text-right">Valor</th><th className="p-4">Tipo</th><th className="p-4">Status</th><th className="p-4 text-right">Comprovante</th></tr></thead><tbody>{visible.map((invoice) => <tr key={`${invoice.type}-${invoice.id}`} className="border-t border-zinc-900 text-zinc-400 hover:bg-white/[.02]"><td className="p-4"><b className="mb-1 block font-medium text-zinc-200">{invoice.item}</b><TechnicalId value={invoice.id} /></td><td className="p-4 font-medium text-white">{invoice.plan}</td><td className="p-4 text-right font-semibold tabular-nums text-emerald-300">{money.format(invoice.amount)}</td><td className="p-4">{invoice.type === "purchase" ? "Compra" : "Renovação"}</td><td className="p-4"><StatusBadge status={invoice.status} /></td><td className="p-4 text-right">{invoice.paid ? <Button size="sm" variant="secondary" onClick={() => setReceipt(invoice)}>Ver comprovante</Button> : <span className="text-xs text-zinc-600">Aguardando confirmação</span>}</td></tr>)}</tbody></table></div>}
        <p className="mt-3 text-xs text-zinc-700">Mostrando {visible.length} de {filtered.length} faturas.</p>
        <Modal open={Boolean(receipt)} onClose={() => setReceipt(null)} title="Comprovante de pagamento">
            {receipt ? <div className="space-y-4"><div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[.07] p-4 text-sm text-emerald-300">✓ Pagamento confirmado</div><dl className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 px-4">{[["Fatura", receipt.id], ["Transação", receipt.paymentId || "—"], ["Produto", receipt.item], ["Plano", receipt.plan], ["Data", receipt.createdAt ? date.format(new Date(receipt.createdAt)) : "—"], ["Total pago", money.format(receipt.amount)]].map(([label, value]) => <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-3 text-sm"><dt className="text-zinc-500">{label}</dt><dd className="break-all text-right font-medium text-white">{value}</dd></div>)}</dl><Button className="w-full" onClick={() => printReceipt(receipt)}>Imprimir ou salvar em PDF</Button></div> : null}
        </Modal>
    </>;
}