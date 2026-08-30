import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SalesDashboard } from "@/components/SalesDashboard";
import { Card, Stat } from "@/components/ui";
import { ActionError } from "@/lib/actions/context";
import { getSalesOverview, getVendasContext } from "@/lib/actions/vendas.actions";
import { requireUser } from "@/lib/require-admin";
import { formatMoney } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ appId: string }> }): Promise<Metadata> {
    const resolvedParams = await params;
    try {
        const ctx = await getVendasContext(resolvedParams.appId);
        return { title: `Vendas · ${ctx.botName} · ZUROS APP`, description: `Dashboard de vendas do bot ${ctx.botName}.` };
    } catch {
        return { title: "Vendas · ZUROS APP" };
    }
}

export default async function VendasPage({ params }: { params: Promise<{ appId: string }> }) {
    const resolvedParams = await params;
    await requireUser();

    let ctx;
    try {
        ctx = await getVendasContext(resolvedParams.appId);
    } catch (error) {
        if (error instanceof ActionError) notFound();
        throw error;
    }

    const overview = await getSalesOverview(resolvedParams.appId, "7d");

    return <main className="sales-page mx-auto max-w-6xl px-5 py-8">
        <section className="sales-hero"><div><p className="home-kicker"><span className="home-kicker-mark" />02 / PERFORMANCE</p><h1>Vendas em movimento.</h1><p>Bot {ctx.botName} <span>·</span> {ctx.productName}</p></div><div className="sales-hero-period"><span>JANELA ATIVA</span><strong>Últimos 7 dias</strong><small>Atualizado agora</small></div></section>
        <section aria-label="Resumo de vendas" className="sales-summary"><Stat label="Receita no período" value={formatMoney(overview.total)} /><Stat label="Pedidos" value={overview.ordersCount} /><Stat label="Ticket médio" value={formatMoney(overview.averageTicket)} /><Stat label="Hoje" value={formatMoney(overview.today)} hint={overview.todayCount ? `${overview.todayCount} venda(s)` : "Sem vendas hoje"} /><article className="sales-pending-stat"><span>AGUARDANDO PAGAMENTO</span><strong>{overview.pendingCount}</strong><small>Pedidos em aberto</small></article></section>
        <div className="sales-chart-wrap"><SalesDashboard appId={resolvedParams.appId} productName={ctx.productName} initial={overview} /></div>
        {overview.recent.length > 0 && <Card className="sales-recent-card mt-4 flex flex-col gap-3"><div className="sales-section-title"><div><p>03 / ATIVIDADE</p><h2>Últimas vendas</h2></div><span>{overview.recent.length} registros</span></div><div className="overflow-x-auto rounded-xl border border-white/[.05]"><table className="w-full text-sm"><thead><tr className="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs uppercase tracking-wide text-zinc-500"><th className="py-3 pl-4 pr-4">Data</th><th className="py-3 pr-4">Tipo</th><th className="py-3 pr-4">Item</th><th className="py-3 pr-4">Valor</th></tr></thead><tbody>{overview.recent.map((sale) => <tr key={`${sale.type}-${sale.id}`} className="border-b border-zinc-900 text-zinc-300 transition last:border-0 hover:bg-zinc-900/40"><td className="whitespace-nowrap py-3 pl-4 pr-4">{new Date(sale.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td className="py-3 pr-4"><span className={`sales-type-badge ${sale.type === "renew" ? "is-renew" : "is-purchase"}`}>{sale.type === "renew" ? "Renovação" : "Compra"}</span></td><td className="py-3 pr-4">{sale.itemName}</td><td className="py-3 pr-4 font-medium text-[var(--accent)]">{formatMoney(sale.finalPrice)}</td></tr>)}</tbody></table></div></Card>}
    </main>;
}
