import { notFound } from "next/navigation";
import { Button, Card, PageHeader } from "@/components/ui";
import { getMyPurchaseCart } from "@/lib/actions/purchases.actions";
import { requireUser } from "@/lib/require-admin";
import { PurchasePaymentPanel } from "@/components/PurchasePaymentPanel";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function PurchaseCartPage({ params }: { params: Promise<{ cartId: string }> }) { const resolvedParams = await params;
    await requireUser();
    let cart;
    try {
        cart = await getMyPurchaseCart(resolvedParams.cartId);
    } catch (error) {
        console.error("Falha ao carregar carrinho de pagamento", error);
        return <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 py-16 text-center"><h1 className="text-2xl font-semibold text-white">Pagamento indisponível</h1><p className="mt-3 text-sm leading-6 text-zinc-400">Não foi possível carregar este carrinho. Volte aos planos e tente iniciar o pagamento novamente.</p><div className="mt-7"><Button href="/planos">Voltar aos planos</Button></div></main>;
    }
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
    return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <PurchasePaymentPanel
            cartId={cart.id}
            initialStep={cart.step}
            productName={cart.productName}
            productType={cart.productType}
            initialPrice={cart.price}
            planLabel={cart.lifetime ? "Vitalício" : `${cart.days} dias`}
        />
    </main>;
}