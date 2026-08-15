import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotModuleEditor } from "@/components/BotModuleEditor";
import { ActionError } from "@/lib/actions/context";
import { getVendasContext } from "@/lib/actions/vendas.actions";
import { requireUser } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { appId: string } }): Promise<Metadata> {
    try {
        const ctx = await getVendasContext(params.appId);
        return { title: `Produtos · ${ctx.botName} · ZUROS APP`, description: `Produtos do bot ${ctx.botName}.` };
    } catch {
        return { title: "Produtos · ZUROS APP" };
    }
}

export default async function ProdutosPage({ params }: { params: { appId: string } }) {
    await requireUser();

    let ctx;
    try {
        ctx = await getVendasContext(params.appId);
    } catch (error) {
        if (error instanceof ActionError) {
            notFound();
        }
        throw error;
    }

    return (
        <main className="mx-auto max-w-6xl px-5 py-8">
            <div className="mb-6">
                <div className="flex items-center gap-2.5">
                    <span className="h-6 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                    <h1 className="text-2xl font-bold tracking-tight text-white">Produtos do bot</h1>
                </div>
                <p className="mt-1.5 text-sm text-zinc-500">Bot {ctx.botName} · Vitrine DROX</p>
            </div>

            <BotModuleEditor storeId={params.appId} modulo="loja" productsOnly />
        </main>
    );
}
