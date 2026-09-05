import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DroxPaymentsEditor } from "@/components/BotModuleEditor";
import { BotPageHero } from "@/components/BotPageHero";
import { Icon } from "@/components/Icon";
import { Card } from "@/components/ui";
import { ActionError } from "@/lib/actions/context";
import { getVendasContext } from "@/lib/actions/vendas.actions";
import { requireUser } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pagamentos · ZUROS APP" };

export default async function PagamentosPage({ params }: { params: Promise<{ appId: string }> }) { const resolvedParams = await params;
    await requireUser();
    let ctx;
    try { ctx = await getVendasContext(resolvedParams.appId); }
    catch (error) { if (error instanceof ActionError) notFound(); throw error; }
    return (
        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
            <BotPageHero
                eyebrow="LOJA / RECEBIMENTOS"
                title="Formas de pagamento"
                description={`Configure os recebimentos da loja do bot ${ctx.botName}.`}
            />
            <div className="mt-5 max-w-md"><Card className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-300"><Icon name="payment" /></span><div><b className="text-sm text-white">PIX</b><p className="text-xs text-zinc-500">Única forma de pagamento ativa, conforme a versão atual do DROX.</p></div></Card></div>
            <Card className="mt-5 border-[#7c3aed]/20 bg-[#7c3aed]/[.05] text-sm text-zinc-400">As credenciais ficam ocultas na tela e são enviadas somente para a configuração do seu bot.</Card>
            <div className="mt-5"><DroxPaymentsEditor storeId={resolvedParams.appId} /></div>
        </main>
    );
}
