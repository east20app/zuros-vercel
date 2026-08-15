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
const fallbackFeatures = ["Hospedagem e gerenciamento integrados", "Atualizações e monitoramento pelo painel", "Suporte para configuração da aplicação"];

export function PublicStoreCatalog({ stores, canPurchase = false }: { stores: StoreCatalogDTO[]; canPurchase?: boolean }) {
    const router = useRouter();
    const { push } = useToast();
    const [pending, startTransition] = useTransition();
    const entries = stores.flatMap((store) => store.products.flatMap((product) => {
        const monthly = product.prices.find((price) => price.plan === "monthly");
        return monthly ? [{ store, product, monthly }] : [];
    }));

    if (!entries.length) {
        return <div role="status" className="zuros-card flex min-h-64 flex-col items-center justify-center px-6 text-center"><span aria-hidden="true" className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300"><Icon name="package" className="h-6 w-6" /></span><h2 className="font-semibold text-white">Nenhum produto disponível</h2><p className="mt-2 max-w-md text-sm text-zinc-400">O catálogo está sendo preparado. Volte em breve para conferir os novos planos.</p></div>;
    }

    return <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3" aria-busy={pending}>{entries.map(({ store, product, monthly }, index) => {
        const features = product.description?.split(/\r?\n|[•;]/).map((item) => item.trim()).filter(Boolean).slice(0, 6) || fallbackFeatures;
        const popular = index === 1 || (entries.length === 1 && index === 0);
        return <article key={product.id} className={`relative flex min-h-[450px] flex-col overflow-hidden rounded-lg border border-black/30 bg-[#2B2D31] p-6 pl-7 shadow-[0_8px_30px_-14px_rgba(0,0,0,.8)] transition hover:-translate-y-1 ${popular ? "ring-1 ring-[#00CBA4]/50" : ""}`}><span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[#00CBA4]" />
            {popular && <span className="absolute right-5 top-5 rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black">Popular</span>}
            <div className="pr-16"><p className="text-xs font-medium uppercase tracking-[.18em] text-emerald-400">{store.name}</p><h2 className="mt-3 text-2xl font-semibold text-white">{product.name}</h2></div>
            {product.bannerUrl && <div className="relative mt-4 aspect-[16/7] overflow-hidden rounded-lg bg-[#1e1f22]"><Image unoptimized fill sizes="(max-width: 768px) 100vw, 33vw" src={product.bannerUrl} alt={`Banner de ${product.name}`} className="object-cover" /></div>}
            <p className="mt-4 min-h-16 text-sm leading-6 text-[#b5bac1]">{product.description?.split(/\r?\n|[•;]/)[0] || "Aplicação profissional integrada à plataforma ZUROS."}</p>
            <div className="my-7 border-y border-zinc-800/80 py-6"><span className="text-sm font-medium text-zinc-500">R$</span><strong className="ml-2 text-4xl font-semibold tracking-tight text-white">{money.format(monthly.price).replace("R$", "").trim()}</strong><span className="ml-2 text-sm text-zinc-500">/ por mês</span></div>
            <ul className="flex-1 space-y-3">{features.map((feature) => <li key={feature} className="flex gap-3 text-sm leading-5 text-zinc-300"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-400"><Icon name="check" className="h-3 w-3" /></span>{feature}</li>)}</ul>
            {canPurchase ? <button type="button" disabled={pending} onClick={() => startTransition(async () => { const result = await startPurchase({ storeId: store.id, productId: product.id, plan: "monthly" }); if (!result.ok) { push(result.error, "error"); return; } router.push(`/dashboard/store/cart/${result.data.cartId}`); })} className="mt-7 rounded-md bg-[#00CBA4] px-5 py-3 text-center text-sm font-semibold text-[#111214] transition hover:bg-[#16e0ba] disabled:cursor-wait disabled:opacity-60">{pending ? "Abrindo pagamento..." : `Comprar ${product.name}`}</button> : <Link href="/login?callbackUrl=/planos" className="mt-7 rounded-md bg-[#5865f2] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#4752c4]">Entrar para comprar</Link>}
        </article>;
    })}</div>;
}
