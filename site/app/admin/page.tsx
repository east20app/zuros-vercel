import Link from "next/link";
import type { Metadata } from "next";
import { Empty, MetricStrip, PageHeader, UserChip } from "@/components/ui";
import { PaymentActions } from "@/components/PaymentActions";
import { getAdminOverview, listAdminStores, listPendingPayments } from "@/lib/actions/admin.actions";
import { formatDate, formatMoney } from "@/lib/status";
import { CreateStoreButton } from "@/components/CreateStoreButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Admin · ZUROS APP",
    description: "Visão geral administrativa do painel.",
};

export default async function AdminOverviewPage() {
    const [overview, { renew, buy }, stores] = await Promise.all([
        getAdminOverview(),
        listPendingPayments(),
        listAdminStores(),
    ]);

    const pendingTotal = renew.length + buy.length;
    const totalApplications = overview.applicationsCount;
    const totalProducts = overview.productsCount;
    const adminMetrics = [
        { label: "Lojas na operação", value: overview.storesCount, detail: "Ambientes conectados", tone: "lime", mark: "01" },
        { label: "Saldo consolidado", value: formatMoney(overview.balance), detail: "Disponível entre lojas", tone: "green", mark: "02" },
        { label: "Aplicações ativas", value: totalApplications, detail: `${totalProducts} ${totalProducts === 1 ? "produto publicado" : "produtos publicados"}`, tone: "coral", mark: "03" },
        { label: "Aguardando decisão", value: pendingTotal, detail: pendingTotal ? "Pagamentos para revisar" : "Nenhuma pendência aberta", tone: pendingTotal ? "coral" : "green", mark: "04" },
    ] as const;

    return (
        <div className="admin-overview-v2">
            <PageHeader title="Administração" subtitle="Lojas, pagamentos e movimentações em um só lugar." actions={<>{stores.length === 0 ? <CreateStoreButton /> : <Link className="admin-primary-action" href={`/admin/${stores[0].id}`}>Abrir loja <span>↗</span></Link>}<Link className="admin-secondary-action" href="/admin/settings">Configurações <span>↗</span></Link></>} />
            <MetricStrip items={adminMetrics.map((metric) => ({ label: metric.label, value: metric.value, detail: metric.detail, tone: metric.tone === "coral" ? "danger" : metric.tone === "lime" ? "neutral" : metric.tone === "green" ? "success" : "warning" }))} />

            <section className="admin-focus-grid">
                <article className="admin-focus-panel admin-payments-panel">
                    <header className="admin-panel-header"><div><p className="admin-section-index">01 / DECISÕES</p><h2>O que precisa<br />de resposta.</h2></div><span className="admin-panel-count">{String(pendingTotal).padStart(2, "0")}</span></header>
                    {pendingTotal === 0 ? <Empty text="Nenhum pagamento pendente." /> : <div className="admin-payment-list">
                        {renew.map((cart) => <div key={`renew-${cart.id}`} className="admin-payment-row"><div className="admin-payment-kind admin-payment-kind-renew">R</div><div className="admin-payment-main"><strong>Renovação · {cart.appName}</strong><span><UserChip userId={cart.userId} /> <em>vence {formatDate(cart.expiresAt)}</em></span></div><strong className="admin-payment-value">{formatMoney(cart.finalPrice)}</strong><PaymentActions type="renew" id={cart.id} /></div>)}
                        {buy.map((cart) => <div key={`buy-${cart.id}`} className="admin-payment-row"><div className="admin-payment-kind">C</div><div className="admin-payment-main"><strong>Compra · {cart.productName}</strong><span><UserChip userId={cart.userId} /> <em>expira {formatDate(cart.expiresAt)}</em></span></div><strong className="admin-payment-value">{formatMoney(cart.finalPrice)}</strong><PaymentActions type="buy" id={cart.id} /></div>)}
                    </div>}
                </article>
                <article className="admin-focus-panel admin-control-panel">
                    <header className="admin-panel-header"><div><p className="admin-section-index">02 / ACESSOS</p><h2>Entre no<br />contexto certo.</h2></div><span className="admin-panel-symbol">↗</span></header>
                    <div className="admin-control-list">
                        <Link href={stores[0] ? `/admin/${stores[0].id}/products` : "/admin"} className="admin-control-link"><span className="admin-control-icon">P</span><span><strong>Catálogo de produtos</strong><small>{totalProducts} {totalProducts === 1 ? "produto organizado" : "produtos organizados"}</small></span><b>→</b></Link>
                        <Link href={stores[0] ? `/admin/${stores[0].id}/extracts` : "/admin"} className="admin-control-link"><span className="admin-control-icon">E</span><span><strong>Extrato consolidado</strong><small>Veja o movimento financeiro</small></span><b>→</b></Link>
                        <Link href="/admin/users" className="admin-control-link"><span className="admin-control-icon">U</span><span><strong>Pessoas e acessos</strong><small>Usuários com relacionamento</small></span><b>→</b></Link>
                    </div>
                </article>
            </section>

            <section className="admin-ledger-panel">
                <header className="admin-panel-header admin-ledger-header"><div><p className="admin-section-index">03 / MOVIMENTO</p><h2>O que mudou recentemente.</h2><p>Uma leitura curta do fluxo financeiro, sem IDs soltos ou excesso de ruído.</p></div>{stores[0] && <Link href={`/admin/${stores[0].id}/extracts`} className="admin-text-action">Abrir extrato completo <span>↗</span></Link>}</header>
                {overview.recentExtracts.length === 0 ? <Empty text="Nenhuma movimentação." /> : <div className="admin-ledger-table-wrap"><table className="admin-ledger-table"><thead><tr><th>Quando</th><th>Contexto</th><th>Movimento</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>{overview.recentExtracts.map((entry) => <tr key={entry.id}><td>{formatDate(entry.createdAt)}</td><td><strong>{entry.storeName}</strong><small>{entry.origin}</small></td><td><span className={`admin-ledger-direction ${entry.action === "add" ? "is-add" : "is-remove"}`}><i />{entry.action === "add" ? "Entrada" : "Saída"}</span></td><td>{entry.description || "Movimentação registrada"}</td><td className={entry.action === "add" ? "is-add" : "is-remove"}>{entry.action === "add" ? "+" : "−"}{formatMoney(entry.amount)}</td></tr>)}</tbody></table></div>}
            </section>

            <section className="admin-stores-panel">
                <header className="admin-panel-header admin-stores-header"><div><p className="admin-section-index">04 / AMBIENTES</p><h2>Suas lojas.</h2></div><span className="admin-panel-count">{String(stores.length).padStart(2, "0")}</span></header>
                {stores.length === 0 ? <Empty text="Nenhuma loja criada. Use o botão Nova loja para começar." /> : <div className="admin-store-grid-v2">{stores.map((store) => <Link key={store.id} href={`/admin/${store.id}`} className="admin-store-card-v2"><div className="admin-store-card-top"><span>{store.name.charAt(0).toUpperCase()}</span><small>Loja / ambiente</small><b>↗</b></div><h3>{store.name}</h3><p>{store.applicationsCount} aplicações · {store.productsCount} produtos</p><div className="admin-store-card-foot"><span>Saldo disponível</span><strong>{formatMoney(store.balance)}</strong></div></Link>)}</div>}
            </section>
        </div>
    );
}
