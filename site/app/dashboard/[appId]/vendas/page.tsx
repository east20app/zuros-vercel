import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SalesDashboard } from "@/components/SalesDashboard";
import { Card, Stat } from "@/components/ui";
import { ActionError } from "@/lib/actions/context";
import { getSalesOverview, getVendasContext } from "@/lib/actions/vendas.actions";
import { requireUser } from "@/lib/require-admin";
import { formatMoney } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { appId: string } }): Promise<Metadata> {
    try {
        const ctx = await getVendasContext(params.appId);
        return { title: `Vendas · ${ctx.botName} · ZUROS APP`, description: `Dashboard de vendas do bot ${ctx.botName}.` };
    } catch {
        return { title: "Vendas · ZUROS APP" };
    }
}

export default async function VendasPage({ params }: { params: { appId: string } }) {
    await requireUser();

    let ctx;
    try {
        ctx = await getVendasContext(params.appId);
    } catch (error) {
        if (error instanceof ActionError) {
            notFound();
        }
        throw error;
    }

    const overview = await getSalesOverview(params.appId, "7d");

    return (
        <main className="mx-auto max-w-6xl px-5 py-8">
            <div className="mb-6">
                <div className="flex items-center gap-2.5">
                    <span className="h-6 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                    <h1 className="text-2xl font-bold tracking-tight text-white">Vendas</h1>
                </div>
                <p className="mt-1.5 text-sm text-zinc-500">Bot {ctx.botName} · {ctx.productName}</p>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
                <Stat label="Receita no período" value={formatMoney(overview.total)} />
                <Stat label="Pedidos" value={overview.ordersCount} />
                <Stat label="Ticket médio" value={formatMoney(overview.averageTicket)} />
                <Stat label="Hoje" value={formatMoney(overview.today)} hint={overview.todayCount ? `${overview.todayCount} venda(s)` : "Sem vendas hoje"} />
                <Card className="group flex flex-col justify-center gap-1.5">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#949ba4]">
                        <i className="h-1.5 w-1.5 rounded-full bg-[#f0b232]/80" />
                        Aguardando pagamento
                    </span>
                    <span className="text-2xl font-semibold tracking-tight text-white">{overview.pendingCount}</span>
                </Card>
            </div>

            <SalesDashboard appId={params.appId} productName={ctx.productName} initial={overview} />

            {overview.recent.length > 0 && (
                <Card className="mt-4 flex flex-col gap-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                        Últimas vendas
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-white/[.05]">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs uppercase tracking-wide text-zinc-500">
                                    <th className="py-3 pl-4 pr-4">Data</th>
                                    <th className="py-3 pr-4">Tipo</th>
                                    <th className="py-3 pr-4">Item</th>
                                    <th className="py-3 pr-4">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {overview.recent.map((sale) => (
                                    <tr key={`${sale.type}-${sale.id}`} className="border-b border-zinc-900 text-zinc-300 transition last:border-0 hover:bg-zinc-900/40">
                                        <td className="py-3 pl-4 pr-4 whitespace-nowrap">{new Date(sale.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                                        <td className="py-3 pr-4">
                                            <span className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${sale.type === "renew" ? "border-[#5865f2]/40 bg-[#5865f2]/10 text-[#7983f5]" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"}`}>
                                                {sale.type === "renew" ? "Renovação" : "Compra"}
                                            </span>
                                        </td>
                                        <td className="py-3 pr-4">{sale.itemName}</td>
                                        <td className="py-3 pr-4 font-medium text-emerald-300">{formatMoney(sale.finalPrice)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </main>
    );
}
