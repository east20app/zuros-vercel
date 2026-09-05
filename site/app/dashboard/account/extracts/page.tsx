import { Card, Empty, Stat } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { listMyAccountExtracts } from "@/lib/actions/apps.actions";
import { formatDate, formatMoney } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function AccountExtractsPage() {
    const extracts = await listMyAccountExtracts();
    const incoming = extracts.filter((entry) => entry.action === "add").reduce((sum, entry) => sum + entry.amount, 0);
    const outgoing = extracts.filter((entry) => entry.action === "remove").reduce((sum, entry) => sum + entry.amount, 0);
    return (
        <main className="account-page mx-auto max-w-6xl px-5 py-8 sm:px-8">
            <section className="account-heading"><div><p className="home-kicker"><span className="home-kicker-mark" />CONTA / EXTRATO</p><h1>Movimentações da sua conta.</h1><p>Entradas e saídas das lojas vinculadas, em ordem cronológica.</p></div><span className="account-heading-code">ACCOUNT / EXT</span></section>

            <div className="sales-status-strip">
                <div className="sales-status-main">
                    <span className="sales-status-dot" />
                    <div>
                        <strong>Extrato consolidado</strong>
                        <small>Resumo financeiro atualizado a cada lançamento confirmado.</small>
                    </div>
                </div>
                <span className="sales-status-chip"><i /> {extracts.length} registro(s)</span>
            </div>

            <section aria-label="Resumo financeiro" className="sales-summary">
                <Stat label="Entradas" value={formatMoney(incoming)} hint="Vendas e créditos" />
                <Stat label="Saídas" value={formatMoney(outgoing)} hint="Ajustes e débitos" />
                <Stat label="Saldo" value={formatMoney(incoming - outgoing)} hint="Entradas − saídas" />
                <article className="sales-pending-stat">
                    <span>MOVIMENTOS</span>
                    <strong>{extracts.length}</strong>
                    <small>Lançamentos no extrato</small>
                </article>
            </section>

            <div className="sales-chart-wrap">
                <div className="sales-section-heading">
                    <div>
                        <p className="home-section-index">01 / LANÇAMENTOS</p>
                        <h2>Histórico completo de movimentações.</h2>
                    </div>
                    <span>Últimos lançamentos</span>
                </div>
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
