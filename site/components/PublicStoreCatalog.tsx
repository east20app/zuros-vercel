"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { StoreCatalogDTO } from "@root/src/integration";
import { startPurchase } from "@/lib/actions/purchases.actions";
import { useToast } from "./Toast";
import { Icon } from "./Icon";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const fallbackFeatures = ["Infraestrutura e gerenciamento integrados", "Atualizações e monitoramento pelo painel", "Suporte para configuração da aplicação"];

function normalizeName(value: string) {
    return value.trim().toLocaleLowerCase("pt-BR");
}

function isZurosBot(product: StoreCatalogDTO["products"][number]) {
    return normalizeName(product.name).includes("zuros bot") || product.productType === "bot";
}

export function PublicStoreCatalog({ stores, canPurchase = false }: { stores: StoreCatalogDTO[]; canPurchase?: boolean }) {
    const router = useRouter();
    const { push } = useToast();
    const [pending, startTransition] = useTransition();
    const entries = stores.flatMap((store) => store.products.flatMap((product) => {
        const monthly = product.prices.find((price) => price.plan === "monthly");
        return monthly ? [{ store, product, monthly }] : [];
    }));
    const botEntry = entries.find(({ product }) => isZurosBot(product));
    const otherEntries = entries.filter(({ product }) => !isZurosBot(product));
    const featuredIndex = botEntry && entries.length > 1 ? Math.floor(entries.length / 2) : -1;
    const orderedEntries = botEntry && featuredIndex >= 0
        ? [...otherEntries.slice(0, featuredIndex), botEntry, ...otherEntries.slice(featuredIndex)]
        : entries;
    if (!entries.length) {
        return <div role="status" className="zuros-card flex min-h-64 flex-col items-center justify-center px-6 text-center"><span aria-hidden="true" className="mb-4 grid h-14 w-14 place-items-center rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent)]"><Icon name="package" className="h-6 w-6" /></span><h2 className="font-semibold text-white">Nenhum produto disponível</h2><p className="mt-2 max-w-md text-sm text-zinc-400">O catálogo está sendo preparado. Volte em breve para conferir os novos planos.</p></div>;
    }

    return <div className="plans-catalog-grid" aria-busy={pending}>{orderedEntries.map(({ store, product, monthly }, index) => {
        const features = product.description?.split(/\r?\n|[•;]/).map((item) => item.trim()).filter(Boolean).slice(0, 5) || fallbackFeatures.slice(0, 5);
        const productIsZurosBot = isZurosBot(product);
        const isFeatured = productIsZurosBot && index === featuredIndex;
        return <article key={product.id} className={`plans-product-card${isFeatured ? " is-featured" : ""}`}>
            <div className="plans-product-topline"><span>{store.name}</span>{isFeatured ? <b>Mais escolhido</b> : null}</div>
            <div className="plans-product-heading"><div><p className="plans-product-overline">{productIsZurosBot ? "O começo mais completo" : product.productType === "auth" ? "Camada de proteção" : "Para sua operação"}</p><h2>{productIsZurosBot ? "Zuros Bot" : product.name}</h2><p>{product.description?.split(/\r?\n|[•;]/)[0] || "Aplicação profissional integrada à plataforma ZUROS."}</p></div><span className="plans-product-symbol" aria-hidden="true">↗</span></div>
            <div className="plans-product-price"><span>R$</span><strong>{money.format(monthly.price).replace("R$", "").trim()}</strong><small>/ mês</small></div>
            <div className="plans-product-includes"><span>Inclui na operação</span><span className="plans-product-rule" /></div>
            <ul>{features.map((feature) => <li key={feature}><span><Icon name="check" className="h-3 w-3" /></span>{feature}</li>)}</ul>
            {!product.available ? <button type="button" disabled className="plans-product-action is-disabled">Em preparação</button> : canPurchase ? <button type="button" disabled={pending} onClick={() => startTransition(async () => { const result = await startPurchase({ storeId: store.id, productId: product.id, plan: "monthly" }); if (!result.ok) { push(result.error, "error"); return; } router.push(`/dashboard/store/cart/${result.data.cartId}`); })} className="plans-product-action">{pending ? "Abrindo pagamento..." : `Comprar ${productIsZurosBot ? "Zuros Bot" : product.name}`}<span aria-hidden>↗</span></button> : <Link href="/login?callbackUrl=/planos" className="plans-product-action">Entrar para comprar<span aria-hidden>↗</span></Link>}
        </article>;
    })}</div>;
}
