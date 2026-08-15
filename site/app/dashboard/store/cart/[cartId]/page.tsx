import { notFound } from "next/navigation";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { getMyPurchaseCart } from "@/lib/actions/purchases.actions";
import { requireUser } from "@/lib/require-admin";
import { PurchasePaymentPanel } from "@/components/PurchasePaymentPanel";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function PurchaseCartPage({ params }: { params: { cartId: string } }) {
    await requireUser();
    const cart = await getMyPurchaseCart(params.cartId);
    if (!cart) notFound();
    const expired = cart.step !== "payment-confirmed" && new Date(cart.expiresAt).getTime() <= Date.now();
    const completed = cart.status === "closed";
    const unavailable = !completed && cart.status !== "opened";

    if (expired || completed || unavailable) {
        const title = completed ? "Compra concluída" : expired ? "Carrinho expirado" : "Carrinho indisponível";
        const message = completed
            ? "Este pagamento já foi confirmado e a aplicação foi entregue. Você pode acessar o bot pelo dashboard."
            : expired
                ? "O prazo deste carrinho terminou. Crie um novo carrinho para gerar outro pagamento."
                : "Este carrinho não está mais disponível para pagamento.";
        return <main className="mx-auto max-w-3xl px-5 py-8">
            <PageHeader title={title} subtitle={cart.productName} />
            <Card className="mt-6 space-y-5 text-center">
                <div className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${completed ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-300"}`}><Icon name={completed ? "check" : "alert"} className="h-6 w-6" /></div>
                <div><h2 className="font-semibold text-white">{title}</h2><p className="mx-auto mt-2 max-w-lg text-sm text-zinc-400">{message}</p></div>
                <div className="flex flex-wrap justify-center gap-3"><Button href="/dashboard">Ir para o dashboard</Button>{!completed && <Button href="/planos" variant="secondary">Criar novo carrinho</Button>}</div>
            </Card>
        </main>;
    }
    return <main className="mx-auto max-w-3xl px-5 py-8">
        <PageHeader title="Seu carrinho" subtitle="Revise os dados da nova aplicação" />
        <Card className="mt-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/15 to-transparent font-bold text-emerald-400">Z</span><div><h2 className="font-semibold text-white">{cart.productName}</h2><p className="text-sm text-zinc-400">{cart.lifetime ? "Vitalício" : `${cart.days} dias`}</p></div></div>
                <Badge tone="amber">Aguardando pagamento</Badge>
            </div>
            <div className="flex items-center gap-3 border-t border-zinc-800 pt-4">
                <span className="text-sm font-normal text-zinc-500">Total</span>
                <span className="text-2xl font-bold bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">{money.format(cart.price)}</span>
                <span className="ml-auto"><Badge tone="amber">Aguardando pagamento</Badge></span>
            </div>
            <PurchasePaymentPanel cartId={cart.id} initialStep={cart.step} />
            <Button href="/planos" variant="secondary">Ver produtos</Button>
        </Card>
    </main>;
}
