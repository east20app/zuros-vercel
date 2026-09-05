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
            <div className="sales-status-strip">
                <div className="sales-status-main">
                    <span className="sales-status-dot" />
                    <div>
                        <strong>Recebimentos ativos</strong>
                        <small>As credenciais ficam ocultas na tela e vão direto para a configuração do bot.</small>
                    </div>
                </div>
                <span className="sales-status-chip"><i /> PIX</span>
            </div>
            <div className="sales-chart-wrap">
                <div className="sales-section-heading">
                    <div>
                        <p className="home-section-index">01 / RECEBIMENTOS</p>
                        <h2>Forma de pagamento ativa.</h2>
                    </div>
                    <span>PIX · única forma disponível</span>
                </div>
                <div className="grid gap-3">
                    <div className="max-w-md"><Card className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-300"><Icon name="payment" /></span><div><b className="text-sm text-white">PIX</b><p className="text-xs text-zinc-500">Única forma de pagamento ativa, conforme a versão atual do DROX.</p></div></Card></div>
                    <Card className="max-w-md border-[#7c3aed]/20 bg-[#7c3aed]/[.05] text-sm text-zinc-400">As credenciais ficam ocultas na tela e são enviadas somente para a configuração do seu bot.</Card>
                </div>
            </div>
            <div className="sales-chart-wrap">
                <div className="sales-section-heading">
                    <div>
                        <p className="home-section-index">02 / CHAVES PIX</p>
                        <h2>Credenciais de recebimento do bot.</h2>
                    </div>
                    <span>Enviadas apenas para o seu bot</span>
                </div>
                <div className="mt-4"><DroxPaymentsEditor storeId={resolvedParams.appId} /></div>
            </div>
        </main>
    );
}
