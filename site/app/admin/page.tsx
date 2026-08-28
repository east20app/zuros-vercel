import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty, Stat, UserChip } from "@/components/ui";
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

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-end justify-between gap-4">
                <div>
                <div className="flex items-center gap-2.5">
                    <span className="h-6 w-1 rounded-full bg-gradient-to-b from-violet-400 to-purple-600" />
                    <h1 className="text-2xl font-bold tracking-tight text-white">Visão geral</h1>
                </div>
                <p className="mt-1.5 text-sm text-zinc-500">Resumo de todas as suas lojas.</p>
                </div>
                {stores.length === 0 ? <CreateStoreButton /> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Stat label="Lojas" value={overview.storesCount} />
                <Stat label="Saldo total" value={formatMoney(overview.balance)} />
                <Stat label="Aplicações" value={overview.applicationsCount} />
                <Stat label="Produtos" value={overview.productsCount} />
                <Stat label="Cupons" value={overview.couponsCount} />
                <Stat label="Pagamentos pendentes" value={overview.pendingPaymentsCount} hint={overview.pendingPaymentsCount > 0 ? "Aprove ou recuse abaixo." : undefined} />
            </div>

            <Card className="flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-white">Pagamentos pendentes</h2>
                {renew.length === 0 && buy.length === 0 ? (
                    <Empty text="Nenhum pagamento pendente." />
                ) : (
                    <div className="flex flex-col gap-4">
                        {renew.map((cart) => (
                            <div key={`renew-${cart.id}`} className="flex flex-col gap-2 rounded-xl border border-zinc-800/80 bg-black/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.02)] transition hover:border-zinc-700">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                    <div>
                                        <span className="font-medium text-white">Renovação · {cart.appName}</span>
                                        <span className="ml-2 inline-flex align-middle"><UserChip userId={cart.userId} /></span>
                                    </div>
                                    <span className="font-medium text-zinc-200">
                                        {formatMoney(cart.finalPrice)} · expira {formatDate(cart.expiresAt)}
                                    </span>
                                </div>
                                <PaymentActions type="renew" id={cart.id} />
                            </div>
                        ))}
                        {buy.map((cart) => (
                            <div key={`buy-${cart.id}`} className="flex flex-col gap-2 rounded-xl border border-zinc-800/80 bg-black/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.02)] transition hover:border-zinc-700">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                    <div>
                                        <span className="font-medium text-white">Compra · {cart.productName}</span>
                                        <span className="ml-2 inline-flex align-middle"><UserChip userId={cart.userId} /></span>
                                    </div>
                                    <span className="font-medium text-zinc-200">
                                        {formatMoney(cart.finalPrice)} · expira {formatDate(cart.expiresAt)}
                                    </span>
                                </div>
                                <PaymentActions type="buy" id={cart.id} />
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Card className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Movimentações recentes</h2>
                    {stores[0] && (
                        <Link href={`/admin/${stores[0].id}/extracts`} className="text-xs text-zinc-500 transition hover:text-emerald-300">
                            Ver extrato completo →
                        </Link>
                    )}
                </div>
                {overview.recentExtracts.length === 0 ? (
                    <Empty text="Nenhuma movimentação." />
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-white/[.05]">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs uppercase tracking-wide text-zinc-500">
                                    <th className="py-3 pl-4 pr-4">Data</th>
                                    <th className="py-3 pr-4">Loja</th>
                                    <th className="py-3 pr-4">Origem</th>
                                    <th className="py-3 pr-4">Descrição</th>
                                    <th className="py-3 pr-4">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {overview.recentExtracts.map((e) => (
                                    <tr key={e.id} className="border-b border-zinc-900 text-zinc-300 transition last:border-0 hover:bg-zinc-900/40">
                                        <td className="py-3 pl-4 pr-4">{formatDate(e.createdAt)}</td>
                                        <td className="py-3 pr-4">{e.storeName}</td>
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

            <Card className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-white">Suas lojas</h2>
                {stores.length === 0 ? (
                    <Empty text="Nenhuma loja criada. Use o botão Nova loja para começar." />
                ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {stores.map((store) => (
                            <Link
                                key={store.id}
                                href={`/admin/${store.id}`}
                                className="group rounded-xl border border-zinc-800/80 bg-black/30 p-4 text-sm transition hover:border-emerald-500/30 hover:bg-zinc-900/40"
                            >
                                <div className="flex items-center gap-2 font-medium text-white">
                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-emerald-500/15 bg-gradient-to-br from-emerald-500/15 to-transparent text-xs font-bold text-emerald-400">{store.name.charAt(0).toUpperCase()}</span>
                                    <span className="truncate">{store.name}</span>
                                </div>
                                <div className="mt-2 text-xs text-zinc-500">
                                    {store.applicationsCount} apps · {store.productsCount} produtos ·{" "}
                                    saldo {formatMoney(store.balance)}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
