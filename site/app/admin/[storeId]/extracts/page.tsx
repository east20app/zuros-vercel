import { Card, Empty, Stat, StatusBadge, UserChip } from "@/components/ui";
import { BalanceForm } from "@/components/BalanceForm";
import { getStoreExtracts, getStoreStats, listSales } from "@/lib/actions/admin.actions";
import { formatDate, formatMoney } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function StoreExtractsPage({ params }: { params: { storeId: string } }) {
    const [stats, extracts, sales] = await Promise.all([
        getStoreStats(params.storeId),
        getStoreExtracts(params.storeId, 100),
        listSales(params.storeId, 30),
    ]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className="h-6 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                        <h1 className="text-2xl font-bold tracking-tight text-white">Extrato</h1>
                    </div>
                    <p className="mt-1.5 text-sm text-zinc-500">Saldo e movimentações da loja.</p>
                </div>
                <Stat label="Saldo atual" value={formatMoney(stats.store.balance)} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <Card className="flex flex-col gap-4 lg:col-span-1">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><span className="h-4 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />Ajustar saldo</h2>
                    <BalanceForm storeId={params.storeId} />
                </Card>

                <Card className="flex flex-col gap-3 lg:col-span-2">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><span className="h-4 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />Movimentações</h2>
                    {extracts.length === 0 ? (
                        <Empty text="Nenhuma movimentação." />
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-white/[.05]">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs uppercase tracking-wide text-zinc-500">
                                        <th className="py-3 pl-4 pr-4">Data</th>
                                        <th className="py-3 pr-4">Origem</th>
                                        <th className="py-3 pr-4">Descrição</th>
                                        <th className="py-3 pr-4">Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {extracts.map((e) => (
                                        <tr key={e.id} className="border-b border-zinc-900 text-zinc-300 transition last:border-0 hover:bg-zinc-900/40">
                                            <td className="py-3 pl-4 pr-4">{formatDate(e.createdAt)}</td>
                                            <td className="py-3 pr-4">{e.origin}</td>
                                            <td className="py-3 pr-4">{e.description || "—"}</td>
                                            <td className={`py-3 pr-4 font-medium ${e.action === "add" ? "text-emerald-400" : "text-red-400"}`}>
                                                {e.action === "add" ? "+" : "−"}
                                                {formatMoney(e.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>

            <Card className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><span className="h-4 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />Vendas recentes</h2>
                {sales.length === 0 ? (
                    <Empty text="Nenhuma venda registrada." />
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-white/[.05]">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs uppercase tracking-wide text-zinc-500">
                                    <th className="py-3 pl-4 pr-4">Data</th>
                                    <th className="py-3 pr-4">Tipo</th>
                                    <th className="py-3 pr-4">Item</th>
                                    <th className="py-3 pr-4">Usuário</th>
                                    <th className="py-3 pr-4">Status</th>
                                    <th className="py-3 pr-4">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sales.map((s) => (
                                    <tr key={s.id} className="border-b border-zinc-900 text-zinc-300 transition last:border-0 hover:bg-zinc-900/40">
                                        <td className="py-3 pl-4 pr-4">{formatDate(s.createdAt)}</td>
                                        <td className="py-3 pr-4">{s.type === "renew" ? "Renovação" : "Compra"}</td>
                                        <td className="py-3 pr-4">{s.productOrAppName}</td>
                                        <td className="py-3 pr-4"><UserChip userId={s.userId} /></td>
                                        <td className="py-3 pr-4"><StatusBadge status={s.status} /></td>
                                        <td className="py-3 pr-4 text-right font-semibold tabular-nums text-zinc-200">{formatMoney(s.finalPrice)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
