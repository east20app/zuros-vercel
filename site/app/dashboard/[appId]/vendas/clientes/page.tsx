import { BotPageHero } from "@/components/BotPageHero";
import { Empty, Stat } from "@/components/ui";
import { CustomersTable } from "@/components/CustomersTable";
import { getCustomers } from "@/lib/actions/vendas.actions";
import { requireVendasContext, vendasMetadata } from "@/lib/dashboard-vendas";
import { formatMoney } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ appId: string }> }): Promise<import("next").Metadata> { const { appId } = await params; return vendasMetadata(appId, "Clientes", (botName) => `Clientes do bot ${botName}.`); }

export default async function ClientesPage({ params }: { params: Promise<{ appId: string }> }) { const resolvedParams = await params;
    const ctx = await requireVendasContext(resolvedParams.appId);

    const customers = await getCustomers(resolvedParams.appId);
    const totalSpent = customers.reduce((sum, customer) => sum + customer.totalSpent, 0);
    const totalOrders = customers.reduce((sum, customer) => sum + customer.orders, 0);
    const averageTicket = totalOrders ? totalSpent / totalOrders : 0;
    const averagePerCustomer = customers.length ? totalSpent / customers.length : 0;

    return (
        <main className="mx-auto max-w-6xl px-5 py-8">
            <BotPageHero
                eyebrow="VENDAS / CLIENTES"
                title="Clientes"
                description={`Bot ${ctx.botName} · ${customers.length} ${customers.length === 1 ? "cliente" : "clientes"} · ${formatMoney(totalSpent)} no total.`}
                meta={<span className="bot-page-hero-meta"><span>Receita total</span><strong>{formatMoney(totalSpent)}</strong><small>{customers.length} cliente(s)</small></span>}
            />

            <section aria-label="Resumo de clientes" className="sales-summary">
                <Stat label="Receita total" value={formatMoney(totalSpent)} hint={`${customers.length} ${customers.length === 1 ? "cliente" : "clientes"} únicos`} />
                <Stat label="Pedidos" value={totalOrders} hint="Compras confirmadas" />
                <Stat label="Ticket médio" value={formatMoney(averageTicket)} hint="Valor médio por pedido" />
                <Stat label="Cliente médio" value={formatMoney(averagePerCustomer)} hint="Receita média por cliente" />
            </section>

            <div className="mt-6">{customers.length === 0 ? (
                <Empty text="Nenhum cliente com compra confirmada ainda." />
            ) : (
                <CustomersTable customers={customers} />
            )}
            </div>
        </main>
    );
}
