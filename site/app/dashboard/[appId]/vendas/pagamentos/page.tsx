import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DroxPaymentsEditor } from "@/components/BotModuleEditor";
import { Icon } from "@/components/Icon";
import { Card, PageHeader } from "@/components/ui";
import { ActionError } from "@/lib/actions/context";
import { getVendasContext } from "@/lib/actions/vendas.actions";
import { requireUser } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pagamentos · ZUROS APP" };

export default async function PagamentosPage({ params }: { params: { appId: string } }) {
    await requireUser();
    let ctx;
    try { ctx = await getVendasContext(params.appId); }
    catch (error) { if (error instanceof ActionError) notFound(); throw error; }
    return (
        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
            <PageHeader title="Formas de pagamento" subtitle={`Configure os recebimentos da loja do bot ${ctx.botName}.`} />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Card className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-300"><Icon name="payment" /></span><div><b className="text-sm text-white">Pix</b><p className="text-xs text-zinc-500">Recebimento instantâneo</p></div></Card>
                <Card className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[#5865f2]/15 text-[#949cf7]"><Icon name="invoice" /></span><div><b className="text-sm text-white">Cartão</b><p className="text-xs text-zinc-500">Provedores compatíveis</p></div></Card>
                <Card className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-amber-500/10 text-amber-300"><Icon name="coupon" /></span><div><b className="text-sm text-white">Cripto</b><p className="text-xs text-zinc-500">Moedas digitais</p></div></Card>
            </div>
            <Card className="mt-5 border-[#5865f2]/20 bg-[#5865f2]/[.05] text-sm text-zinc-400">As credenciais ficam ocultas na tela e são enviadas somente para a configuração do seu bot.</Card>
            <div className="mt-5"><DroxPaymentsEditor storeId={params.appId} /></div>
        </main>
    );
}
