"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ProductCatalogDTO, PurchasePlan, StoreCatalogDTO } from "@root/src/integration";
import { startPurchase } from "@/lib/actions/purchases.actions";
import { useToast } from "./Toast";
import { Icon } from "./Icon";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const fallbackFeatures = ["Infraestrutura e gerenciamento integrados", "Atualizações e monitoramento pelo painel", "Suporte para configuração da aplicação"];

const planOrder: PurchasePlan[] = ["weekly", "biweekly", "monthly", "lifetime"];
const planTabs: Record<PurchasePlan, { label: string; short: string }> = {
    weekly: { label: "Semanal", short: "7 dias" },
    biweekly: { label: "Quinzenal", short: "15 dias" },
    monthly: { label: "Mensal", short: "30 dias" },
    lifetime: { label: "Vitalício", short: "Acesso total" },
};

function normalizeName(value: string) {
    return value.trim().toLocaleLowerCase("pt-BR");
}

function isZurosBot(product: ProductCatalogDTO) {
    return normalizeName(product.name).includes("zuros bot") || product.productType === "bot";
}

function defaultPlan(prices: ProductCatalogDTO["prices"]): PurchasePlan | null {
    const available = planOrder.filter((plan) => prices.some((price) => price.plan === plan));
    if (available.includes("monthly")) return "monthly";
    return available[0] || null;
}

function ProductCard({ store, product, isFeatured, canPurchase, pending, onBuy }: {
    store: StoreCatalogDTO;
    product: ProductCatalogDTO;
    isFeatured: boolean;
    canPurchase: boolean;
    pending: boolean;
    onBuy: (plan: PurchasePlan) => void;
}) {
    const [selected, setSelected] = useState<PurchasePlan>(defaultPlan(product.prices) || "monthly");
    const current = product.prices.find((price) => price.plan === selected);
    const productIsZurosBot = isZurosBot(product);
    const features = product.description?.split(/\r?\n|[•;]/).map((item) => item.trim()).filter(Boolean).slice(0, 5) || fallbackFeatures.slice(0, 5);
    const isComingSoon = !!product.comingSoon;
    const isPreparing = !isComingSoon && !product.available;
    const disabled = isComingSoon || isPreparing;
    const title = productIsZurosBot ? "Zuros Bot" : product.name;
    const overline = productIsZurosBot ? "O começo mais completo" : product.productType === "auth" ? "Camada de proteção" : "Para sua operação";

    return (
        <article className={`plans-product-card${isFeatured ? " is-featured" : ""}${isComingSoon ? " is-coming-soon" : ""}`}>
            <div className="plans-product-glow" aria-hidden="true" />
            <div className="plans-product-topline">
                <span>{store.name}</span>
                {isFeatured && <b>Mais escolhido</b>}
                {isComingSoon && <b className="is-soon">Em breve</b>}
            </div>
            <div className="plans-product-heading">
                <div>
                    <p className="plans-product-overline">{overline}</p>
                    <h2>{title}</h2>
                    <p>{product.description?.split(/\r?\n|[•;]/)[0] || "Aplicação profissional integrada à plataforma ZUROS."}</p>
                </div>
                <span className="plans-product-symbol" aria-hidden="true">↗</span>
            </div>
            <div className="plans-product-visual">
                {product.bannerUrl ? (
                    <Image unoptimized src={product.bannerUrl} alt={`Banner de ${title}`} width={640} height={160} className="plans-product-banner-image" />
                ) : (
                    <>
                        <span className="plans-product-visual-mark">{title.charAt(0).toUpperCase()}</span>
                        <span className="plans-product-visual-line" />
                        <span className="plans-product-visual-code">ZUROS / {product.productType.toUpperCase()}</span>
                    </>
                )}
            </div>
            <div className="plans-product-price" data-lifetime={selected === "lifetime"}>
                {current ? (
                    <>
                        <span>R$</span>
                        <strong key={selected}>{money.format(current.price).replace("R$", "").trim()}</strong>
                        <small>{selected === "lifetime" ? "/ acesso vitalício" : "/ mês"}</small>
                    </>
                ) : isComingSoon ? (
                    <>
                        <strong className="plans-price-soon">Em breve</strong>
                    </>
                ) : (
                    <strong>—</strong>
                )}
            </div>
            {!isComingSoon && product.prices.length > 1 && (
                <div className="plans-plan-tabs" role="tablist" aria-label="Planos disponíveis">
                    {planOrder.filter((plan) => product.prices.some((price) => price.plan === plan)).map((plan) => (
                        <button
                            key={plan}
                            type="button"
                            role="tab"
                            aria-selected={selected === plan}
                            className={`plans-plan-tab${selected === plan ? " is-active" : ""}`}
                            onClick={() => setSelected(plan)}
                        >
                            <b>{planTabs[plan].label}</b>
                            <span>{planTabs[plan].short}</span>
                        </button>
                    ))}
                </div>
            )}
            <div className="plans-product-includes">
                <span>Inclui na operação</span>
                <span className="plans-product-rule" />
            </div>
            <ul>
                {features.map((feature) => (
                    <li key={feature}>
                        <span><Icon name="check" className="h-3 w-3" /></span>
                        {feature}
                    </li>
                ))}
            </ul>
            {disabled ? <button type="button" disabled className="plans-product-action is-disabled">{isComingSoon ? "Em breve" : "Em preparação"}<span aria-hidden>↗</span></button> : canPurchase && current ? (
                <button
                    type="button"
                    disabled={pending || !current}
                    onClick={() => onBuy(selected)}
                    className="plans-product-action"
                >
                    {pending ? "Abrindo pagamento..." : `Comprar ${productIsZurosBot ? "Zuros Bot" : product.name}`}
                    <span aria-hidden>↗</span>
                </button>
            ) : (
                <Link href="/login?callbackUrl=/planos" className="plans-product-action">Entrar para comprar<span aria-hidden>↗</span></Link>
            )}
        </article>
    );
}

export function PublicStoreCatalog({ stores, canPurchase = false }: { stores: StoreCatalogDTO[]; canPurchase?: boolean }) {
    const router = useRouter();
    const { push } = useToast();
    const [pending, startTransition] = useTransition();

    const entries = stores.flatMap((store) => store.products.map((product) => ({ store, product })));
    if (!entries.length) {
        return <div role="status" className="zuros-card flex min-h-64 flex-col items-center justify-center px-6 text-center"><span aria-hidden="true" className="mb-4 grid h-14 w-14 place-items-center rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent)]"><Icon name="package" className="h-6 w-6" /></span><h2 className="font-semibold text-white">Nenhum produto disponível</h2><p className="mt-2 max-w-md text-sm text-zinc-400">O catálogo está sendo preparado. Volte em breve para conferir os novos planos.</p></div>;
    }

    const ordered = [...entries].sort(
        (a, b) => (a.product.sortOrder || 0) - (b.product.sortOrder || 0) || a.product.name.localeCompare(b.product.name, "pt-BR"),
    );

    const featuredEntry = ordered.find(({ product }) => product.featured) || (ordered.length > 1 ? ordered.find(({ product }) => isZurosBot(product)) : undefined);
    const featuredIndex = Math.floor(ordered.length / 2);
    const finalEntries = featuredEntry
        ? [...ordered.filter((entry) => entry !== featuredEntry).slice(0, featuredIndex), featuredEntry, ...ordered.filter((entry) => entry !== featuredEntry).slice(featuredIndex)]
        : ordered;

    return (
        <div className="plans-catalog-grid" aria-busy={pending}>
            {finalEntries.map((entry) => (
                <ProductCard
                    key={entry.product.id}
                    store={entry.store}
                    product={entry.product}
                    isFeatured={entry === featuredEntry}
                    canPurchase={canPurchase}
                    pending={pending}
                    onBuy={(plan) =>
                        startTransition(async () => {
                            const result = await startPurchase({ storeId: entry.store.id, productId: entry.product.id, plan });
                            if (!result.ok) {
                                push(result.error, "error");
                                return;
                            }
                            router.push(`/dashboard/store/cart/${result.data.cartId}`);
                        })
                    }
                />
            ))}
        </div>
    );
}