import { Badge, Button, Card, Empty, PageHeader } from "@/components/ui";
import { getStoreProducts } from "@/lib/actions/admin.actions";

export const dynamic = "force-dynamic";

export default async function StoreReleasesPage({ params }: { params: Promise<{ storeId: string }> }) { const resolvedParams = await params;
    const products = await getStoreProducts(resolvedParams.storeId);
    const totalBots = products.reduce((total, product) => total + product.applicationsCount, 0);
    const pending = products.reduce((total, product) => total + product.pendingUpdateApplications, 0);
    const errors = products.reduce((total, product) => total + product.errorOnUpdateApplications, 0);

    return (
        <div className="space-y-6">
            <PageHeader title="Central de releases" subtitle="Publique versões e acompanhe a atualização de todos os bots em um só lugar." />

            <section aria-label="Resumo geral" className="grid gap-3 sm:grid-cols-3">
                <Card className="p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Bots vinculados</p><p className="mt-2 text-2xl font-semibold text-white">{totalBots}</p></Card>
                <Card className="p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Atualizações pendentes</p><p className="mt-2 text-2xl font-semibold text-amber-400">{pending}</p></Card>
                <Card className="p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Bots com erro</p><p className={"mt-2 text-2xl font-semibold " + (errors ? "text-red-400" : "text-zinc-300")}>{errors}</p></Card>
            </section>

            {products.length === 0 ? <Empty text="Nenhum produto cadastrado." /> : (
                <div className="grid gap-4 lg:grid-cols-2">
                    {products.map((product) => (
                        <Card key={product.id} className="flex flex-col gap-5 transition hover:border-emerald-500/25 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-500/15 bg-emerald-500/10 text-sm font-bold text-emerald-400">{product.name.charAt(0).toUpperCase()}</span>
                                    <div className="min-w-0"><h2 className="truncate font-semibold text-white">{product.name}</h2><p className="mt-1 text-xs text-zinc-500">Atual: {product.currentReleaseVersion ? "v" + product.currentReleaseVersion : "não definida"}</p></div>
                                </div>
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    <Badge tone="zinc">{product.releases.length} releases</Badge>
                                    <Badge tone="zinc">{product.applicationsCount} bots</Badge>
                                    {product.pendingUpdateApplications > 0 ? <Badge tone="amber">{product.pendingUpdateApplications} pendentes</Badge> : null}
                                    {product.errorOnUpdateApplications > 0 ? <Badge tone="red">{product.errorOnUpdateApplications} com erro</Badge> : null}
                                    {product.currentReleaseVersion && product.pendingUpdateApplications === 0 && product.errorOnUpdateApplications === 0 ? <Badge tone="green">Atualizado</Badge> : null}
                                </div>
                            </div>
                            <Button href={"/admin/" + resolvedParams.storeId + "/products/" + product.id + "/releases"}>Gerenciar</Button>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}