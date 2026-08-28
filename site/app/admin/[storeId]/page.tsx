import Link from "next/link";
import { Card, Empty, Stat } from "@/components/ui";
import { getStoreStats, getStoreExtracts } from "@/lib/actions/admin.actions";
import { formatDate, formatMoney } from "@/lib/status";
import { StatsCharts } from "@/components/StatsCharts";
import { getStoreProducts } from "@/lib/actions/admin.actions";
import { ActivityFeed } from "@/components/ActivityFeed";
import { TelemetryDashboard } from "@/components/TelemetryDashboard";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function StoreOverviewPage({ params }: { params: Promise<{ storeId: string }> }) { const resolvedParams = await params;
    const [stats, extracts, products] = await Promise.all([
        getStoreStats(resolvedParams.storeId),
        getStoreExtracts(resolvedParams.storeId, 10),
        getStoreProducts(resolvedParams.storeId),
    ]);

    return (
        <div className="flex flex-col gap-6">
            <div>
                <div className="flex items-center gap-2.5">
                    <span className="h-6 w-1 rounded-full bg-gradient-to-b from-violet-400 to-purple-600" />
                    <h1 className="text-2xl font-bold tracking-tight text-white">{stats.store.name}</h1>
                </div>
                <p className="mt-1.5 text-sm text-zinc-500">Painel da loja.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Saldo" value={formatMoney(stats.store.balance)} />
                <Stat label="Aplicações" value={stats.store.applicationsCount} />
                <Stat label="Produtos" value={stats.store.productsCount} />
                <Stat label="Cupons" value={stats.store.couponsCount} />
                <Stat label="Renovações pendentes" value={stats.pendingRenew} />
                <Stat label="Compras pendentes" value={stats.pendingBuy} />
                <Stat label="Em carência" value={stats.appsGracePeriod} />
                <Stat label="Com erro de update" value={stats.appsWithError} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <Card className="flex flex-col gap-3 lg:col-span-2">
                    <h2 className="text-sm font-semibold text-white">Atalhos</h2>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {[["payment", "Pagamentos pendentes", "payments", `(${stats.pendingRenew + stats.pendingBuy})`], ["apps", "Aplicações da loja", "apps", ""], ["product", "Gerenciar produtos", "products", ""], ["coupon", "Gerenciar cupons", "coupons", ""]].map(([icon, label, route, detail]) => <Link key={route} href={`/admin/${resolvedParams.storeId}/${route}`} className="group flex items-center justify-between rounded-lg border border-zinc-800/80 bg-black/30 p-4 text-sm text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,.02)] transition hover:border-emerald-500/30 hover:text-white"><span className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400"><Icon name={icon as "payment" | "apps" | "product" | "coupon"} className="h-4 w-4" /></span>{label}</span><span className="flex items-center gap-1 text-xs text-zinc-600 transition group-hover:text-emerald-400">{detail}<Icon name="arrow-right" className="h-3.5 w-3.5" /></span></Link>)}
                    </div>
                </Card>

                <Card className="flex flex-col gap-3">
                    <h2 className="text-sm font-semibold text-white">Últimas movimentações</h2>
                    {extracts.length === 0 ? (
                        <Empty text="Nenhuma movimentação." />
                    ) : (
                        <div className="flex flex-col gap-1">
                            {extracts.map((e) => (
                                <div key={e.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition hover:bg-zinc-900/40">
                                    <div className="flex flex-col">
                                        <span className="text-zinc-300">{e.description || e.origin}</span>
                                        <span className="text-xs text-zinc-600">{formatDate(e.createdAt)}</span>
                                    </div>
                                    <span className={`font-medium ${e.action === "add" ? "text-emerald-400" : "text-red-400"}`}>
                                        {e.action === "add" ? "+" : "−"}
                                        {formatMoney(e.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
            <ActivityFeed storeId={resolvedParams.storeId} />
            <TelemetryDashboard />
            <StatsCharts extracts={extracts} applications={stats.store.applicationsCount} releases={products.reduce((total, product) => total + product.releases.length, 0)} />
        </div>
    );
}
