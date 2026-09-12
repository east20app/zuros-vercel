import { BotPageHero } from "@/components/BotPageHero";
import { Empty, Stat } from "@/components/ui";
import { OpenCartsTable } from "@/components/OpenCartsTable";
import { getOpenCarts } from "@/lib/actions/vendas.actions";
import { requireVendasContext, vendasMetadata } from "@/lib/dashboard-vendas";
import { formatMoney } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ appId: string }> }): Promise<import("next").Metadata> { const { appId } = await params; return vendasMetadata(appId, "Carrinhos", (botName) => `Carrinhos abertos do bot ${botName}.`); }

export default async function CarrinhosPage({ params }: { params: Promise<{ appId: string }> }) { const resolvedParams = await params;
    const ctx = await requireVendasContext(resolvedParams.appId);

    const carts = await getOpenCarts(resolvedParams.appId);

    const totalValue = carts.reduce((sum, cart) => sum + (cart.finalPrice || cart.price), 0);
    const renewCount = carts.filter((cart) => cart.type === "renew").length;
    const averageTicket = carts.length ? totalValue / carts.length : 0;

    return (
        <main className="mx-auto max-w-6xl px-5 py-8">
            <BotPageHero
                eyebrow="VENDAS / CARRINHOS"
                title="Carrinhos abertos"
                description={`Bot ${ctx.botName} · ${carts.length} ${carts.length === 1 ? "carrinho em andamento" : "carrinhos em andamento"}.`}
                meta={<span className="bot-page-hero-meta"><span>Em andamento</span><strong>{carts.length}</strong><small>Atualizado agora</small></span>}
            />

            <section aria-label="Resumo de carrinhos" className="sales-summary">
                <Stat label="Carrinhos abertos" value={carts.length} hint="Em andamento agora" />
                <Stat label="Valor acumulado" value={formatMoney(totalValue)} hint="Soma dos carrinhos abertos" />
                <Stat label="Ticket médio" value={formatMoney(averageTicket)} hint="Valor médio por carrinho" />
                <article className="sales-pending-stat">
                    <span>RENOVAÇÕES EM ABERTO</span>
                    <strong>{renewCount}</strong>
                    <small>Carrinhos de renovação</small>
                </article>
            </section>

            <div className="mt-6">{carts.length === 0 ? (
                <Empty text="Nenhum carrinho aberto no momento." />
            ) : (
                <OpenCartsTable carts={carts} />
            )}
            </div>
        </main>
    );
}
