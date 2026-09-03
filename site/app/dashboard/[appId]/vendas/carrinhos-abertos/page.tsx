import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, Empty, StatusBadge, TechnicalId, UserChip } from "@/components/ui";
import { ActionError } from "@/lib/actions/context";
import { getOpenCarts, getVendasContext } from "@/lib/actions/vendas.actions";
import { requireUser } from "@/lib/require-admin";
import { formatDate, formatMoney } from "@/lib/status";
import { STEP_LABELS } from "@/lib/vendas";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ appId: string }> }): Promise<Metadata> {
    const resolvedParams = await params;
    try {
        const ctx = await getVendasContext(resolvedParams.appId);
        return { title: `Carrinhos · ${ctx.botName} · ZUROS APP`, description: `Carrinhos abertos do bot ${ctx.botName}.` };
    } catch {
        return { title: "Carrinhos · ZUROS APP" };
    }
}

export default async function CarrinhosPage({ params }: { params: Promise<{ appId: string }> }) { const resolvedParams = await params;
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

    const carts = await getOpenCarts(resolvedParams.appId);

    return (
        <main className="mx-auto max-w-6xl px-5 py-8">
            <div className="mb-6">
                <div className="flex items-center gap-2.5">
                    <span className="h-6 w-1 rounded-full bg-[var(--accent)]" />
                    <h1 className="text-2xl font-bold tracking-tight text-white">Carrinhos abertos</h1>
                </div>
                <p className="mt-1.5 text-sm text-zinc-500">
                    Bot {ctx.botName} · {carts.length} {carts.length === 1 ? "carrinho em andamento" : "carrinhos em andamento"}.
                </p>
            </div>

            {carts.length === 0 ? (
                <Empty text="Nenhum carrinho aberto no momento." />
            ) : (
                <Card className="overflow-hidden p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1000px] text-left text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-xs uppercase tracking-wide text-zinc-500">
                                    <th className="p-4">Criado</th>
                                    <th className="p-4">Tipo / item</th>
                                    <th className="p-4">Usuário</th>
                                    <th className="p-4">Etapa</th>
                                    <th className="p-4">Plano</th>
                                    <th className="p-4">Valor</th>
                                    <th className="p-4">Expira</th>
                                    <th className="p-4">Referências</th>
                                </tr>
                            </thead>
                            <tbody>
                                {carts.map((cart) => (
                                    <tr key={`${cart.type}-${cart.id}`} className="border-b border-zinc-900 text-zinc-300 transition last:border-0 hover:bg-zinc-900/40">
                                        <td className="p-4 whitespace-nowrap">{formatDate(cart.createdAt)}</td>
                                        <td className="p-4">
                                            <span className="block font-medium text-white">{cart.itemName}</span>
                                            <span className="text-xs text-zinc-500">{cart.type === "renew" ? "Renovação" : "Compra"}</span>
                                        </td>
                                        <td className="p-4"><UserChip userId={cart.userId} /></td>
                                        <td className="p-4">
                                            <StatusBadge status={cart.step} label={STEP_LABELS[cart.step]} />
                                        </td>
                                        <td className="p-4">{cart.lifetime ? "Vitalício" : cart.days ? `${cart.days} dias` : "Ainda não escolhido"}</td>
                                        <td className="p-4 text-right font-semibold tabular-nums text-emerald-300">{formatMoney(cart.finalPrice || cart.price)}</td>
                                        <td className="p-4 whitespace-nowrap">{cart.expiresAt ? formatDate(cart.expiresAt) : "—"}</td>
                                        <td className="p-4 text-xs text-zinc-500">
                                            <span className="block"><TechnicalId value={cart.channelId} label="Canal" /></span>
                                            <span className="block"><TechnicalId value={cart.paymentId} label="PIX" /></span>
                                            <span className="block"><TechnicalId value={cart.id} label="Carrinho" /></span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </main>
    );
}
