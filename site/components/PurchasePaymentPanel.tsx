"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { applyPurchaseCoupon, deliverAuthPurchase, deliverPurchaseApplication, generatePurchasePayment, pollPurchaseCart } from "@/lib/actions/purchases.actions";
import { useCopyPixCode, usePixPolling, type PixPollState } from "@/hooks/usePixPayment";
import { Button, Field, Spinner, inputClass } from "./ui";
import { useToast } from "./Toast";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const includedFeatures = ["Infraestrutura e atualizações do bot", "Configurações, proteção e automações", "Loja, pagamentos e sistema de tickets", "Painel conectado ao Discord"];

function CheckoutSteps({ current }: { current: number }) {
    const labels = ["Plano", "Adicionais", "Pagamento"];
    return <div className="relative grid grid-cols-3 rounded-2xl border border-white/[.08] bg-[#0b0b0f] px-3 py-5 sm:px-8">
        <span className="absolute left-[17%] right-[17%] top-10 h-px bg-zinc-800" />
        {labels.map((label, index) => { const number = index + 1; const done = current > number; const active = current === number; return <div key={label} className="relative z-10 flex flex-col items-center gap-2 text-center"><span className={`grid h-10 w-10 place-items-center rounded-full border text-sm font-bold transition ${done ? "border-emerald-400 bg-emerald-500 text-black" : active ? "border-[var(--accent)] bg-[var(--accent)] text-[#091116]" : "border-zinc-700 bg-zinc-900 text-zinc-500"}`}>{done ? "✓" : number}</span><span className={active ? "text-xs font-medium text-[var(--accent)]" : "text-xs text-zinc-500"}>{label}</span></div>; })}
    </div>;
}

function CheckoutHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
    return <div className="mb-7 text-center"><span className="inline-flex rounded-full border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-4 py-2 text-sm font-medium text-[var(--accent)]">▣ {eyebrow}</span><h1 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-5xl">{title}</h1><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">{subtitle}</p></div>;
}

export function PurchasePaymentPanel({ cartId, initialStep, productName, productType, initialPrice, planLabel }: { cartId: string; initialStep: string; productName: string; productType: "bot" | "auth" | "complete"; initialPrice: number; planLabel: string }) {
    const router = useRouter();
    const { push } = useToast();
    const [pending, startTransition] = useTransition();
    const [step, setStep] = useState(initialStep);
    const [checkoutStep, setCheckoutStep] = useState(initialStep === "select-coupons" ? 1 : 3);
    const [qr, setQr] = useState("");
    const [code, setCode] = useState("");
    const [price, setPrice] = useState<number | null>(null);
    const [coupon, setCoupon] = useState("");
    const [discount, setDiscount] = useState<number | null>(null);
    const [botName, setBotName] = useState("");
    const [botToken, setBotToken] = useState("");
    const [serverId, setServerId] = useState("");
    const { copied, copy } = useCopyPixCode();
    const total = price ?? Math.max(0, initialPrice * (1 - (discount || 0) / 100));

    function resetToPayment() { setQr(""); setCode(""); setPrice(null); setStep("select-coupons"); setCheckoutStep(3); }

    usePixPolling({
        active: step === "waiting-payment",
        poll: () => pollPurchaseCart(cartId),
        isConfirmed: (cart: PixPollState) => cart.step === "payment-confirmed",
        isTerminal: (cart: PixPollState) => cart.status === "cancelled" || cart.status === "expired",
        onConfirmed: () => { setStep("payment-confirmed"); setCheckoutStep(3); push("Pagamento confirmado! Agora envie os dados do seu bot.", "success"); },
        onTerminal: () => { push("Pagamento expirado ou cancelado. Gere um novo código PIX.", "error"); resetToPayment(); },
        onTimeout: () => { push("A confirmação demorou mais que o esperado. Gere ou exiba o PIX novamente.", "error"); resetToPayment(); },
    });

    function generate() { startTransition(async () => { try { const payment = await generatePurchasePayment(cartId); setQr(payment.qrcodeDataUrl); setCode(payment.copyPaste); setPrice(payment.finalPrice); setStep("waiting-payment"); } catch (error) { push(error instanceof Error ? error.message : "Não foi possível gerar o pagamento.", "error"); } }); }

    if (step === "payment-confirmed" && productType === "auth") return <div><CheckoutHeading eyebrow="Ativação" title="Ative seu ZUROS Auth" subtitle="Pagamento confirmado. Sua licença será vinculada automaticamente à sua conta Discord." /><CheckoutSteps current={3} /><section className="mx-auto mt-7 max-w-2xl space-y-5 rounded-2xl border border-emerald-500/20 bg-[#08090b] p-5 text-center sm:p-7"><div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-left"><p className="font-semibold text-emerald-300">✓ Pagamento confirmado</p><p className="mt-1 text-sm text-emerald-100/70">Você não precisa informar token de bot. O acesso será criado no ZUROS Auth.</p></div><Button disabled={pending} className="w-full" onClick={() => startTransition(async () => { try { const result = await deliverAuthPurchase(cartId); if (!result.ok) return push(result.error, "error"); push("ZUROS Auth ativado com sucesso!", "success"); window.location.href = result.data.dashboardUrl; } catch (err) { push(err instanceof Error ? err.message : "Falha ao ativar ZUROS Auth.", "error"); } })}>{pending ? <><Spinner /> Ativando licença...</> : "Ativar ZUROS Auth"}</Button></section></div>;
    if (step === "payment-confirmed") return <div><CheckoutHeading eyebrow="Ativação" title="Configure seu novo bot" subtitle="Pagamento confirmado. Informe os dados do Discord para preparar sua aplicação." /><CheckoutSteps current={3} /><form className="mx-auto mt-7 max-w-2xl space-y-5 rounded-2xl border border-emerald-500/20 bg-[#08090b] p-5 sm:p-7" onSubmit={(event) => { event.preventDefault(); startTransition(async () => { const result = await deliverPurchaseApplication({ cartId, botName, botToken, serverId }); if (!result.ok) return push(result.error, "error"); sessionStorage.setItem("zuros-new-purchase-tour", "pending"); push("Aplicação criada e entregue com sucesso!", "success"); router.push(`/dashboard/${result.data.applicationId}`); router.refresh(); }); }}>
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4"><p className="font-semibold text-emerald-300">✓ Pagamento confirmado</p><p className="mt-1 text-xs text-emerald-100/70">Finalize a entrega com os mesmos dados usados no bot.</p></div>
        <Field label="Nome do bot"><input className={inputClass} value={botName} onChange={(e) => setBotName(e.target.value)} maxLength={25} required /></Field>
        <Field label="Token do bot" hint="O token é protegido e usado somente para instalar e iniciar a aplicação."><input className={inputClass} type="password" value={botToken} onChange={(e) => setBotToken(e.target.value)} required autoComplete="off" /></Field>
        <Field label="ID do servidor Discord (opcional)"><input className={inputClass} value={serverId} onChange={(e) => setServerId(e.target.value.replace(/\D/g, ""))} placeholder="123456789012345678" inputMode="numeric" /></Field>
        <Button type="submit" disabled={pending} className="w-full">{pending ? <><Spinner /> Preparando aplicação...</> : "Enviar bot e concluir"}</Button>
    </form></div>;

    return <div>
        {checkoutStep === 1 && <><CheckoutHeading eyebrow="Checkout" title="Personalize seu plano" subtitle="Revise os recursos incluídos na sua aplicação ZUROS." /><CheckoutSteps current={1} /><div className="mt-7 grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><section className="rounded-2xl border border-[var(--accent)]/25 bg-[#08090b] p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--accent)]">Plano selecionado</p><h2 className="mt-3 text-3xl font-bold text-white">{productName}</h2><p className="mt-2 text-zinc-400">Bot completo com infraestrutura gerenciada e painel integrado.</p><div className="my-6 border-y border-white/[.07] py-5"><strong className="text-4xl text-white">{money.format(initialPrice)}</strong><span className="ml-2 text-sm text-zinc-500">/{planLabel}</span></div><ul className="space-y-3">{includedFeatures.map((feature) => <li key={feature} className="flex gap-3 text-sm text-zinc-300"><span className="text-[var(--accent)]">✓</span>{feature}</li>)}</ul></section><aside className="h-fit rounded-2xl border border-white/[.08] bg-[#08090b] p-6"><h3 className="text-lg font-semibold text-white">Resumo</h3><div className="mt-5 flex justify-between text-sm text-zinc-400"><span>Duração</span><span className="text-white">{planLabel}</span></div><div className="mt-3 flex justify-between border-t border-white/[.07] pt-4"><b>Total</b><b className="text-xl text-[var(--accent)]">{money.format(initialPrice)}</b></div><Button className="mt-6 w-full" onClick={() => setCheckoutStep(2)}>Continuar →</Button></aside></div></>}

        {checkoutStep === 2 && <><CheckoutHeading eyebrow="Checkout" title="Recursos incluídos" subtitle="Tudo já está incluído no seu produto. Nenhum adicional será cobrado nesta etapa." /><CheckoutSteps current={2} /><div className="mt-7 grid gap-4 sm:grid-cols-3">{[["Infraestrutura gerenciada", "Atualizações e monitoramento da aplicação"], ["Proteção e automações", "Recursos conectados ao seu servidor Discord"], ["Loja e tickets", "Vendas, entregas e atendimento integrado"]].map(([title, description]) => <article key={title} className="rounded-2xl border border-[var(--accent)]/25 bg-[#08090b] p-6"><span className="inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">✓ Incluído</span><h2 className="mt-5 text-xl font-semibold text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p></article>)}</div><div className="mt-6 grid gap-3 sm:grid-cols-2"><Button variant="secondary" onClick={() => setCheckoutStep(1)}>← Voltar</Button><Button onClick={() => setCheckoutStep(3)}>Continuar para pagamento →</Button></div></>}

        {checkoutStep === 3 && <><CheckoutHeading eyebrow="Pagamento" title="Finalizar compra" subtitle="Revise seu pedido e conclua o pagamento com PIX." /><CheckoutSteps current={3} /><div className="mt-7 grid items-start gap-6 lg:grid-cols-[1fr_.8fr]"><section className="rounded-2xl border border-white/[.08] bg-[#08090b] p-5 sm:p-7"><h2 className="text-xl font-semibold text-white">Pagamento via PIX</h2>{step === "select-coupons" && <Field label="Cupom de desconto (opcional)"><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input className={inputClass} value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Digite o código" disabled={discount !== null} /><Button variant="secondary" disabled={pending || !coupon.trim() || discount !== null} onClick={() => startTransition(async () => { const result = await applyPurchaseCoupon(cartId, coupon); if (!result.ok) return push(result.error, "error"); setDiscount(result.data.discount); push(`Cupom aplicado: ${result.data.discount}% de desconto.`, "success"); })}>{discount !== null ? "Aplicado" : "Aplicar"}</Button></div></Field>}{!qr ? <div className="mt-6"><p className="mb-4 text-sm leading-6 text-zinc-400">O código PIX é gerado com segurança e expira em 30 minutos.</p><Button onClick={generate} disabled={pending} className="w-full">{pending ? <><Spinner /> Gerando PIX...</> : step === "waiting-payment" ? "Exibir pagamento PIX" : "Gerar pagamento PIX"}</Button></div> : <div className="mt-6 flex flex-col items-center gap-5"><div className="w-full max-w-sm rounded-2xl bg-white p-3"><Image unoptimized src={qr} width={420} height={420} alt="QR Code para pagamento PIX" className="h-auto w-full rounded-lg" /></div><p className="w-full break-all rounded-xl border border-white/[.08] bg-black p-4 font-mono text-xs leading-5 text-zinc-400">{code}</p><Button className="w-full" onClick={() => copy(code).catch(() => push("Não foi possível copiar.", "error"))}>{copied ? "Código copiado!" : "Copiar código PIX"}</Button><div className="w-full rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-300">Após o pagamento, seu pedido será confirmado automaticamente.</div><span className="flex items-center gap-2 text-xs text-[var(--accent)]"><i className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />Aguardando confirmação do pagamento...</span></div>}</section><aside className="rounded-2xl border border-[var(--accent)]/25 bg-[#08090b] p-5 sm:p-7"><h2 className="text-xl font-semibold text-white">Resumo do pedido</h2><dl className="mt-5 space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-zinc-500">Produto</dt><dd className="text-right text-white">{productName}</dd></div><div className="flex justify-between"><dt className="text-zinc-500">Período</dt><dd>{planLabel}</dd></div><div className="flex justify-between"><dt className="text-zinc-500">Subtotal</dt><dd>{money.format(initialPrice)}</dd></div>{discount !== null && <div className="flex justify-between text-emerald-300"><dt>Desconto</dt><dd>- {discount}%</dd></div>}<div className="flex justify-between border-t border-white/[.08] pt-5 text-lg font-bold"><dt>Total</dt><dd className="text-2xl text-[var(--accent)]">{money.format(total)}</dd></div></dl><div className="mt-6 space-y-3 border-t border-white/[.08] pt-5 text-sm text-zinc-400"><p>🔒 Pagamento seguro</p><p>⚡ Ativação após confirmação</p></div>{!qr && <Button variant="secondary" className="mt-6 w-full" onClick={() => setCheckoutStep(2)}>← Voltar</Button>}</aside></div></>}
    </div>;
}