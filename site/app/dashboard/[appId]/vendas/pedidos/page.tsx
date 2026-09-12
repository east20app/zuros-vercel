import { BotPageHero } from "@/components/BotPageHero";
import { OrdersList } from "@/components/OrdersList";
import { Stat } from "@/components/ui";
import { listOrders } from "@/lib/actions/vendas.actions";
import { requireVendasContext, vendasMetadata } from "@/lib/dashboard-vendas";
import { formatMoney } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ appId: string }> }): Promise<import("next").Metadata> { const { appId } = await params; return vendasMetadata(appId, "Pedidos", (botName) => `Pedidos do bot ${botName}.`); }

export default async function PedidosPage({ params }: { params: Promise<{ appId: string }> }) { const resolvedParams = await params;
    const ctx = await requireVendasContext(resolvedParams.appId);

    const orders = await listOrders(resolvedParams.appId);

    const totalRevenue = orders.reduce<number>((sum, order) => sum + (order.finalPrice || order.price), 0);
    const renewCount = orders.filter((order) => order.type === "renew").length;
    const pendingCount = orders.filter((order) => order.step === "waiting-payment").length;
    const averageTicket = orders.length ? totalRevenue / orders.length : 0;

    return (
        <main className="mx-auto max-w-6xl px-5 py-8">
            <BotPageHero
                eyebrow="VENDAS / OPERAÇÃO"
                title="Pedidos"
                description={`Bot ${ctx.botName} · ${orders.length} ${orders.length === 1 ? "pedido listado" : "pedidos listados"}.`}
                meta={<span className="bot-page-hero-meta"><span>Registros</span><strong>{orders.length}</strong><small>Atualizado agora</small></span>}
            />

            <section aria-label="Resumo de pedidos" className="sales-summary">
                <Stat label="Receita acumulada" value={formatMoney(totalRevenue)} hint={`${orders.length} ${orders.length === 1 ? "pedido" : "pedidos"} registrados`} />
                <Stat label="Ticket médio" value={formatMoney(averageTicket)} hint="Valor médio por pedido" />
                <Stat label="Renovações" value={renewCount} hint={orders.length ? `${Math.round((renewCount / orders.length) * 100)}% do total` : "Nenhuma renovação ainda"} />
                <article className="sales-pending-stat">
                    <span>AGUARDANDO PAGAMENTO</span>
                    <strong>{pendingCount}</strong>
                    <small>Pedidos em aberto</small>
                </article>
            </section>

            <div className="mt-6"><OrdersList appId={resolvedParams.appId} initial={orders} /></div>
        </main>
    );
}
