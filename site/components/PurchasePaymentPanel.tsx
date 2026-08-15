"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { applyPurchaseCoupon, deliverPurchaseApplication, generatePurchasePayment, pollPurchaseCart } from "@/lib/actions/purchases.actions";
import { useCopyPixCode, usePixPolling, type PixPollState } from "@/hooks/usePixPayment";
import { Button, Field, Spinner, inputClass } from "./ui";
import { useToast } from "./Toast";

export function PurchasePaymentPanel({ cartId, initialStep }: { cartId: string; initialStep: string }) {
    const router = useRouter();
    const { push } = useToast();
    const [pending, startTransition] = useTransition();
    const [step, setStep] = useState(initialStep);
    const [qr, setQr] = useState("");
    const [code, setCode] = useState("");
    const [price, setPrice] = useState<number | null>(null);
    const [coupon, setCoupon] = useState("");
    const [discount, setDiscount] = useState<number | null>(null);
    const [botName, setBotName] = useState("");
    const [botToken, setBotToken] = useState("");
    const [serverId, setServerId] = useState("");
    const { copied, copy } = useCopyPixCode();

    function resetToPayment() {
        setQr("");
        setCode("");
        setPrice(null);
        setStep(initialStep);
    }

    usePixPolling({
        active: step === "waiting-payment",
        poll: () => pollPurchaseCart(cartId),
        isConfirmed: (cart: PixPollState) => cart.step === "payment-confirmed",
        isTerminal: (cart: PixPollState) => cart.status === "cancelled" || cart.status === "expired",
        onConfirmed: () => {
            setStep("payment-confirmed");
            push("Pagamento confirmado! Agora envie os dados do seu bot.", "success");
        },
        onTerminal: () => {
            push("Pagamento expirado ou cancelado, gere um novo código PIX.", "error");
            resetToPayment();
        },
        onTimeout: () => {
            push("Pagamento expirado, gere um novo código PIX.", "error");
            resetToPayment();
        },
    });

    function generate() {
        startTransition(async () => {
            try {
                const payment = await generatePurchasePayment(cartId);
                setQr(payment.qrcodeDataUrl); setCode(payment.copyPaste); setPrice(payment.finalPrice); setStep("waiting-payment");
            } catch (error) { push(error instanceof Error ? error.message : "Não foi possível gerar o pagamento.", "error"); }
        });
    }

    if (step === "payment-confirmed") return <form className="space-y-4 border-t border-zinc-800 pt-5" onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
            const result = await deliverPurchaseApplication({ cartId, botName, botToken, serverId });
            if (!result.ok) return push(result.error, "error");
            push("Aplicação criada e entregue com sucesso!", "success");
            router.push(`/dashboard/${result.data.applicationId}`);
            router.refresh();
        });
    }}>
        <div className="animate-fade-up flex items-center gap-3 rounded-lg border border-[#23a559]/30 bg-[#23a559]/10 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#23a559] text-white shadow-[0_0_18px_-2px_rgba(35,165,89,.8)] animate-pulse-glow">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[3]" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </span>
            <div>
                <p className="font-semibold text-[#2fc06a]">Pagamento confirmado</p>
                <p className="text-xs text-[#949ba4]">O valor foi creditado. Finalize informando os dados do seu bot.</p>
            </div>
        </div>
        <div><h3 className="font-semibold text-white">Enviar bot</h3><p className="mt-1 text-sm text-[#949ba4]">Pagamento confirmado. Informe os mesmos dados solicitados no carrinho do Discord.</p></div>
        <Field label="Nome do bot"><input className={inputClass} value={botName} onChange={(e) => setBotName(e.target.value)} maxLength={25} required /></Field>
        <Field label="Token do bot" hint="O token é usado com segurança para instalar e iniciar sua aplicação."><input className={inputClass} type="password" value={botToken} onChange={(e) => setBotToken(e.target.value)} required autoComplete="off" /></Field>
        <Field label="ID do servidor Discord (opcional)"><input className={inputClass} value={serverId} onChange={(e) => setServerId(e.target.value.replace(/\D/g, ""))} placeholder="123456789012345678" inputMode="numeric" /></Field>
        <Button type="submit" disabled={pending} className="w-full">{pending ? <><Spinner /> Preparando aplicação...</> : "Enviar bot e concluir"}</Button>
    </form>;

    return <div className="space-y-5 border-t border-zinc-800 pt-5">
        {step === "select-coupons" && <div className="space-y-2"><Field label="Cupom de desconto (opcional)"><div className="flex gap-2"><input className={inputClass} value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Digite o código" disabled={discount !== null} /><Button variant="secondary" disabled={pending || !coupon.trim() || discount !== null} onClick={() => startTransition(async () => { const result = await applyPurchaseCoupon(cartId, coupon); if (!result.ok) return push(result.error, "error"); setDiscount(result.data.discount); push(`Cupom aplicado: ${result.data.discount}% de desconto.`, "success"); })}>{discount !== null ? "Aplicado" : "Aplicar"}</Button></div></Field></div>}
        {!qr ? <div><p className="mb-4 text-sm text-[#949ba4]">Gere o PIX para concluir sua compra. O código expira em 30 minutos.</p><Button onClick={generate} disabled={pending} className="w-full">{pending ? <><Spinner /> Gerando PIX...</> : step === "waiting-payment" ? "Exibir pagamento PIX" : "Continuar para o pagamento"}</Button></div> : <div className="flex flex-col items-center gap-4"><div className="rounded-2xl bg-white p-3 shadow-[0_0_40px_-14px_rgba(88,101,242,.6)]"><Image unoptimized src={qr} width={208} height={208} alt="QR Code para pagamento PIX da compra" className="h-52 w-52 rounded-lg" /></div>{price !== null && <p className="text-lg font-semibold text-white">Total: {price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}<Button variant="secondary" className="w-full" onClick={() => copy(code).catch(() => push("Não foi possível copiar.", "error"))}>{copied ? "Código copiado!" : "Copiar código PIX"}</Button><span className="flex items-center gap-2 rounded-full border border-[#5865f2]/30 bg-[#5865f2]/10 px-3 py-1.5 text-xs text-[#7983f5]"><i aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-[#5865f2]" />Aguardando confirmação do pagamento...</span></div>}
    </div>;
}
