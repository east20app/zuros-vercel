import { Card, Empty, TechnicalId, UserChip } from "@/components/ui";
import { PaymentActions } from "@/components/PaymentActions";
import { listPendingPayments } from "@/lib/actions/admin.actions";
import { formatDate, formatMoney } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function StorePaymentsPage({ params }: { params: Promise<{ storeId: string }> }) { const resolvedParams = await params;
    const { renew, buy } = await listPendingPayments(resolvedParams.storeId);

    return (
        <div className="flex flex-col gap-4">
            <div>
                <div className="flex items-center gap-2.5">
                    <span className="h-6 w-1 rounded-full bg-gradient-to-b from-violet-400 to-purple-600" />
                    <h1 className="text-2xl font-bold tracking-tight text-white">Pagamentos pendentes</h1>
                </div>
                <p className="mt-1.5 text-sm text-zinc-500">
                    {renew.length + buy.length} aguardando aprovação.
                </p>
            </div>

            {renew.length === 0 && buy.length === 0 ? (
                <Empty text="Nenhum pagamento pendente." />
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    {renew.map((cart) => (
                        <Card key={cart.id} className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h2 className="font-semibold text-white">Renovação · {cart.appName}</h2>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                        <UserChip userId={cart.userId} /> <span>· {cart.lifetime ? "Vitalício" : `${cart.days} dias`}</span>
                                        {cart.couponCode ? ` · Cupom ${cart.couponCode}` : ""}
                                    </div>
                                </div>
                                <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-sm font-semibold text-emerald-300">
                                    {formatMoney(cart.finalPrice)}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-white/[.04] bg-black/30 px-3 py-2 text-xs text-zinc-500">
                                <span className="flex items-center gap-1.5"><i className="h-1 w-1 rounded-full bg-zinc-600" />Expira: {formatDate(cart.expiresAt)}</span>
                                <TechnicalId value={cart.paymentId} label="PIX" />
                            </div>
                            <PaymentActions type="renew" id={cart.id} />
                        </Card>
                    ))}

                    {buy.map((cart) => (
                        <Card key={cart.id} className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h2 className="font-semibold text-white">Compra · {cart.productName}</h2>
                                    <div className="mt-1"><UserChip userId={cart.userId} /></div>
                                </div>
                                <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-sm font-semibold text-emerald-300">{formatMoney(cart.finalPrice)}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-white/[.04] bg-black/30 px-3 py-2 text-xs text-zinc-500">
                                <span className="flex items-center gap-1.5"><i className="h-1 w-1 rounded-full bg-zinc-600" />Expira: {formatDate(cart.expiresAt)}</span>
                                <TechnicalId value={cart.paymentId} label="PIX" />
                            </div>
                            <PaymentActions type="buy" id={cart.id} />
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
