import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
            <div className="mb-6">
                <div className="flex items-center gap-2.5">
                    <span className="h-6 w-1 rounded-full bg-[var(--accent)]" />
                    <h1 className="text-2xl font-bold tracking-tight text-white">Pedidos</h1>
                </div>
                <p className="mt-1.5 text-sm text-zinc-500">
                    Bot {ctx.botName} · {orders.length} {orders.length === 1 ? "pedido" : "pedidos"} listados.
                </p>
            </div>

            <OrdersList appId={resolvedParams.appId} initial={orders} />
        </main>
    );
}
