"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ProductCatalogDTO, PurchasePlan, StoreCatalogDTO } from "@root/src/integration";import { startPurchase } from "@/lib/actions/purchases.actions";
import { useToast } from "./Toast";
import { Icon } from "./Icon";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const fallbackFeatures = ["Infraestrutura e gerenciamento integrados", "Atualizações e monitoramento pelo painel", "Suporte para configuração da aplicação"];

function FeatureMark({ plus = false }: { plus?: boolean }) {
    return (
        <span className={`plans-feature-mark${plus ? " plus" : ""}`}>
            {plus ? <b aria-hidden="true">+</b> : <Icon name="check" className="h-3 w-3" />}
        </span>
    );
}

function normalizeName(value: string) {
    return value.trim().toLocaleLowerCase("pt-BR");
}

function isZurosBot(product: ProductCatalogDTO) {
    return normalizeName(product.name).includes("zuros bot") || product.productType === "bot";
}

function isZurosVerification(product: ProductCatalogDTO) {
    const name = normalizeName(product.name);
    return name.includes("verifica") || product.productType === "auth";
}

const planFallbackOrder: PurchasePlan[] = ["monthly", "lifetime", "weekly", "biweekly"];

function defaultPrice(product: ProductCatalogDTO) {
    return planFallbackOrder.map((plan) => product.prices.find((price) => price.plan === plan)).find(Boolean) ?? product.prices[0];
}

function planLabel(plan: PurchasePlan): string {
    return plan === "lifetime" ? "acesso vitalício" : "por mês";
}

function ProductCard({ product, isFeatured, canPurchase, pending, onBuy }: {
    product: ProductCatalogDTO;
    isFeatured: boolean;
    canPurchase: boolean;
    pending: boolean;
    onBuy: (plan: PurchasePlan) => void;
}) {
    const current = defaultPrice(product);
    const productIsZurosBot = isZurosBot(product);
    const productIsVerification = isZurosVerification(product);
    const isComingSoon = !!product.comingSoon;
    const isPreparing = !isComingSoon && !product.available;
    const disabled = isComingSoon || isPreparing;
    const title = productIsZurosBot ? "Prime" : productIsVerification ? "Verificação" : product.name;
    const features = product.description?.split(/\r?\n|[•;]/).map((item) => item.trim()).filter(Boolean).slice(0, 5);
    const list = features && features.length ? features : fallbackFeatures.slice(0, 5);

    return (
        <article className={`plans-product-card${isFeatured ? " is-featured" : ""}${isComingSoon ? " is-coming-soon" : ""}`}>
            {isFeatured && <span className="plans-card-badge-float">Popular</span>}
            <h2 className="plans-card-title">{title}</h2>
            <p className="plans-card-desc">{product.description?.split(/\r?\n|[•;]/)[0] || "Aplicação profissional integrada à plataforma ZUROS."}</p>
            <div className="plans-card-price">
                {current && !isComingSoon ? (
                    <>
                        <strong>{money.format(current.price).replace("R$", "").trim()}</strong>
                        <small>/ {planLabel(current.plan)}</small>
                    </>
                ) : isComingSoon ? (
                    <strong className="plans-price-soon">Em breve</strong>
                ) : (
                    <strong>—</strong>
                )}
            </div>
            <div className="plans-card-rule" />
            <ul>
                {list.map((feature, i) => (
                    <li key={feature}>
                        <FeatureMark plus={isFeatured && i === list.length - 1} />
                        {feature}
                    </li>
                ))}
            </ul>
            {disabled ? <button type="button" disabled className="plans-product-action is-disabled">{isComingSoon ? "Em breve" : "Em preparação"}</button> : canPurchase && current ? (
                <button
                    type="button"
                    disabled={pending}
                    onClick={() => onBuy(current.plan)}
                    className="plans-product-action"
                >
                    {pending ? "Abrindo pagamento..." : `Adquirir ${title}`}
                </button>
            ) : (
                <Link href="/login?callbackUrl=/planos" className="plans-product-action">Entrar para comprar</Link>
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

    const featuredEntry = ordered.find(({ product }) => product.featured)
        || (ordered.length > 1 ? ordered.find(({ product }) => isZurosBot(product)) : undefined)
        || (ordered.length > 1 ? ordered.find(({ product }) => isZurosVerification(product)) : undefined);
    const featuredIndex = Math.floor(ordered.length / 2);
    const finalEntries = featuredEntry
        ? [...ordered.filter((entry) => entry !== featuredEntry).slice(0, featuredIndex), featuredEntry, ...ordered.filter((entry) => entry !== featuredEntry).slice(featuredIndex)]
        : ordered;

    return (
        <div className="plans-catalog-grid" aria-busy={pending}>
            {finalEntries.map((entry) => (
                <ProductCard
                    key={entry.product.id}
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