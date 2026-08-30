"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { StoreCatalogDTO } from "@root/src/integration";
import { startPurchase } from "@/lib/actions/purchases.actions";
import { useToast } from "./Toast";
import { Icon } from "./Icon";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const fallbackFeatures = ["Infraestrutura e gerenciamento integrados", "Atualizações e monitoramento pelo painel", "Suporte para configuração da aplicação"];

export function PublicStoreCatalog({ stores, canPurchase = false }: { stores: StoreCatalogDTO[]; canPurchase?: boolean }) {
    const router = useRouter();
    const { push } = useToast();
    const [pending, startTransition] = useTransition();
    const entries = stores.flatMap((store) => store.products.flatMap((product) => {
        const monthly = product.prices.find((price) => price.plan === "monthly");
        return monthly ? [{ store, product, monthly }] : [];
    }));

    if (!entries.length) {
        return <div role="status" className="zuros-card flex min-h-64 flex-col items-center justify-center px-6 text-center"><span aria-hidden="true" className="mb-4 grid h-14 w-14 place-items-center rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent)]"><Icon name="package" className="h-6 w-6" /></span><h2 className="font-semibold text-white">Nenhum produto disponível</h2><p className="mt-2 max-w-md text-sm text-zinc-400">O catálogo está sendo preparado. Volte em breve para conferir os novos planos.</p></div>;
    }

    return <div className="store-catalog-grid" aria-busy={pending}>{entries.map(({ store, product, monthly }, index) => {
        const features = product.description?.split(/\r?\n|[•;]/).map((item) => item.trim()).filter(Boolean).slice(0, 6) || fallbackFeatures;
        const popular = index === 1 || (entries.length === 1 && index === 0);
        return <article key={product.id} className={`store-card ${popular ? "is-featured" : ""}`}>
            <div className="store-card-no">0{index + 1}</div>
            <div className="store-card-topline"><span>{store.name}</span>{popular && <b>Mais escolhido</b>}</div>
            <div className="store-card-heading"><div><h2>{product.name}</h2><p>{product.description?.split(/\r?\n|[•;]/)[0] || "Aplicação profissional integrada à plataforma ZUROS."}</p></div><span className="store-card-symbol" aria-hidden="true">↗</span></div>
            {product.bannerUrl && <div className="store-card-banner"><Image unoptimized fill sizes="(max-width: 768px) 100vw, 33vw" src={product.bannerUrl} alt={`Banner de ${product.name}`} className="object-cover" /></div>}
            <div className="store-card-price"><span>R$</span><strong>{money.format(monthly.price).replace("R$", "").trim()}</strong><small>/ mês</small></div>
            <div className="store-card-includes"><span>Inclui na operação</span><span className="store-card-rule" /></div>
            <ul>{features.map((feature) => <li key={feature}><span><Icon name="check" className="h-3 w-3" /></span>{feature}</li>)}</ul>
            {!product.available ? <button type="button" disabled className="store-card-action is-disabled">Em preparação</button> : canPurchase ? <button type="button" disabled={pending} onClick={() => startTransition(async () => { const result = await startPurchase({ storeId: store.id, productId: product.id, plan: "monthly" }); if (!result.ok) { push(result.error, "error"); return; } router.push(`/dashboard/store/cart/${result.data.cartId}`); })} className="store-card-action">{pending ? "Abrindo pagamento..." : `Comprar ${product.name}`}<span aria-hidden>↗</span></button> : <Link href="/login?callbackUrl=/planos" className="store-card-action">Entrar para comprar<span aria-hidden>↗</span></Link>}
        </article>;
    })}</div>;
}
