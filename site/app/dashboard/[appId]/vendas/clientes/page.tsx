import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotPageHero } from "@/components/BotPageHero";
import { Card, Empty, TechnicalId, UserChip } from "@/components/ui";
import { ActionError } from "@/lib/actions/context";
import { getCustomers, getVendasContext } from "@/lib/actions/vendas.actions";
import { requireUser } from "@/lib/require-admin";
import { formatMoney } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ appId: string }> }): Promise<Metadata> {
    const resolvedParams = await params;
    try {
        const ctx = await getVendasContext(resolvedParams.appId);
        return { title: `Clientes · ${ctx.botName} · ZUROS APP`, description: `Clientes do bot ${ctx.botName}.` };
    } catch {
        return { title: "Clientes · ZUROS APP" };
    }
}

export default async function ClientesPage({ params }: { params: Promise<{ appId: string }> }) { const resolvedParams = await params;
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

    const customers = await getCustomers(resolvedParams.appId);
    const totalSpent = customers.reduce((sum, customer) => sum + customer.totalSpent, 0);

    return (
        <main className="mx-auto max-w-6xl px-5 py-8">
            <BotPageHero
                eyebrow="VENDAS / CLIENTES"
                title="Clientes"
                description={`Bot ${ctx.botName} · ${customers.length} ${customers.length === 1 ? "cliente" : "clientes"} · ${formatMoney(totalSpent)} no total.`}
                meta={<span className="bot-page-hero-meta"><span>Receita total</span><strong>{formatMoney(totalSpent)}</strong><small>{customers.length} cliente(s)</small></span>}
            />

            <div className="mt-6">{customers.length === 0 ? (
                <Empty text="Nenhum cliente com compra confirmada ainda." />
            ) : (
                <Card className="overflow-hidden p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px] text-left text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-xs uppercase tracking-wide text-zinc-500">
                                    <th className="p-4">Usuário</th>
                                    <th className="p-4">Servidor</th>
                                    <th className="p-4">Pedidos</th>
                                    <th className="p-4">Total gasto</th>
                                    <th className="p-4">Última compra</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map((customer) => (
                                    <tr key={customer.userId} className="border-b border-zinc-900 text-zinc-300 transition last:border-0 hover:bg-zinc-900/40">
                                        <td className="p-4"><UserChip userId={customer.userId} /></td>
                                        <td className="p-4 text-zinc-400"><TechnicalId value={customer.guildId} label="Servidor" /></td>
                                        <td className="p-4">{customer.orders}</td>
                                        <td className="p-4 text-right font-semibold tabular-nums text-emerald-300">{formatMoney(customer.totalSpent)}</td>
                                        <td className="p-4 whitespace-nowrap">{customer.lastPurchaseAt ? new Date(customer.lastPurchaseAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
            </div>
        </main>
    );
}
