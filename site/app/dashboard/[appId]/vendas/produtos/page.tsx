import { BotModuleEditor } from "@/components/BotModuleEditor";
import { BotPageHero } from "@/components/BotPageHero";
import { requireVendasContext, vendasMetadata } from "@/lib/dashboard-vendas";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ appId: string }> }): Promise<import("next").Metadata> { const { appId } = await params; return vendasMetadata(appId, "Produtos", (botName) => `Produtos do bot ${botName}.`); }

export default async function ProdutosPage({ params }: { params: Promise<{ appId: string }> }) { const resolvedParams = await params;
    const ctx = await requireVendasContext(resolvedParams.appId);

    return (
        <main className="mx-auto max-w-6xl px-5 py-8">
            <BotPageHero
                eyebrow="LOJA / VITRINE"
                title="Produtos do bot"
                description={`Bot ${ctx.botName} · Vitrine DROX`}
            />

            <div className="sales-status-strip">
                <div className="sales-status-main">
                    <span className="sales-status-dot" />
                    <div>
                        <strong>Vitrine ativa</strong>
                        <small>Confira os produtos e os preços exibidos na loja do {ctx.botName}.</small>
                    </div>
                </div>
                <span className="sales-status-chip"><i /> Publicado</span>
            </div>

            <div className="sales-chart-wrap">
                <div className="sales-section-heading">
                    <div>
                        <p className="home-section-index">01 / VITRINE</p>
                        <h2>Produtos disponíveis na loja.</h2>
                    </div>
                    <span>Gerencie nomes, preços e duração</span>
                </div>
                <div className="mt-6"><BotModuleEditor storeId={resolvedParams.appId} modulo="loja" productsOnly /></div>
            </div>
        </main>
    );
}
