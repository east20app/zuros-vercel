import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotPageHero } from "@/components/BotPageHero";
import { OrdersList } from "@/components/OrdersList";
import { ActionError } from "@/lib/actions/context";
import { getVendasContext, listOrders } from "@/lib/actions/vendas.actions";
import { requireUser } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ appId: string }> }): Promise<Metadata> {
    const resolvedParams = await params;
    try {
        const ctx = await getVendasContext(resolvedParams.appId);
        return { title: `Pedidos · ${ctx.botName} · ZUROS APP`, description: `Pedidos do bot ${ctx.botName}.` };
    } catch {
        return { title: "Pedidos · ZUROS APP" };
    }
}

export default async function PedidosPage({ params }: { params: Promise<{ appId: string }> }) { const resolvedParams = await params;
    await requireUser();

    let ctx;
    try {
        ctx = await getVendasContext(resolvedParams.appId);
    } catch (error) {
        if (error instanceof ActionError) {
            notFound();
        }
        throw error;
    }

    const orders = await listOrders(resolvedParams.appId);

    return (
        <main className="mx-auto max-w-6xl px-5 py-8">
            <BotPageHero
                eyebrow="VENDAS / OPERAÇÃO"
                title="Pedidos"
                description={`Bot ${ctx.botName} · ${orders.length} ${orders.length === 1 ? "pedido listado" : "pedidos listados"}.`}
                meta={<span className="bot-page-hero-meta"><span>Registros</span><strong>{orders.length}</strong><small>Atualizado agora</small></span>}
            />

            <div className="mt-6"><OrdersList appId={resolvedParams.appId} initial={orders} /></div>
        </main>
    );
}
