import { Card, Empty } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { listMyAccountExtracts } from "@/lib/actions/apps.actions";
import { formatDate, formatMoney } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function AccountExtractsPage() {
    const extracts = await listMyAccountExtracts();
    return (
        <main className="mx-auto max-w-6xl px-5 py-10">
            <div className="flex items-center gap-2.5"><span className="h-6 w-1 rounded-full bg-gradient-to-b from-violet-400 to-purple-600" /><h1 className="text-3xl font-semibold tracking-tight text-white">Extrato</h1></div>
            <p className="mt-2 text-sm text-zinc-500">Movimentações financeiras das lojas vinculadas à sua conta.</p>
            <div className="mt-8">
                {extracts.length === 0 ? <Empty icon={<Icon name="invoice" />} title="Nenhuma movimentação" text="Suas movimentações aparecerão aqui." /> : (
                    <Card className="overflow-hidden p-0">
                        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm">
                            <thead><tr className="border-b border-zinc-800 bg-zinc-950/60 text-xs uppercase tracking-wide text-zinc-500"><th className="p-4">Data</th><th className="p-4">Loja</th><th className="p-4">Origem</th><th className="p-4">Descrição</th><th className="p-4">Valor</th></tr></thead>
                            <tbody>{extracts.map((entry) => <tr key={entry.id} className="border-b border-zinc-900 text-zinc-300 last:border-0"><td className="p-4 whitespace-nowrap">{formatDate(entry.createdAt)}</td><td className="p-4">{entry.storeName}</td><td className="p-4">{entry.origin === "sales" ? "Venda" : "Ajuste"}</td><td className="p-4 text-zinc-400">{entry.description || "—"}</td><td className={`p-4 font-medium ${entry.action === "add" ? "text-emerald-400" : "text-red-400"}`}>{entry.action === "add" ? "+" : "−"}{formatMoney(entry.amount)}</td></tr>)}</tbody>
                        </table></div>
                    </Card>
                )}
            </div>
        </main>
    );
}
