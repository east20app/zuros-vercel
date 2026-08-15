"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PurchasePlan, StoreCatalogDTO } from "@root/src/integration";
import { startPurchase } from "@/lib/actions/purchases.actions";
import { useToast } from "./Toast";
import { Button, Card } from "./ui";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function StoreCatalog({ stores }: { stores: StoreCatalogDTO[] }) {
    const router = useRouter();
    const { push } = useToast();
    const [pending, startTransition] = useTransition();
    const [selected, setSelected] = useState<Record<string, PurchasePlan>>({});

    function buy(storeId: string, productId: string, fallback: PurchasePlan) {
        startTransition(async () => {
            const result = await startPurchase({ storeId, productId, plan: selected[productId] || fallback });
            if (!result.ok) return push(result.error, "error");
            push("Carrinho criado com sucesso.");
            router.push(`/dashboard/store/cart/${result.data.cartId}`);
        });
    }

    return (
        <div className="space-y-8">
            {stores.map((store) => (
                <section key={store.id}>
                    <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white"><i className="h-4 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />{store.name}</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {store.products.filter((product) => product.prices.length > 0).map((product) => {
                            const plan = selected[product.id] || product.prices[0].plan;
                            return (
                                <Card key={product.id} className="flex h-full flex-col gap-4">
                                    <div>
                                        <h3 className="font-semibold text-white">{product.name}</h3>
                                        {product.description && <p className="mt-1 text-sm leading-6 text-zinc-400">{product.description}</p>}
                                    </div>
                                    <label className="mt-auto flex flex-col gap-1.5 text-xs text-zinc-400">
                                        Plano
                                        <select
                                            value={plan}
                                            onChange={(event) => setSelected((old) => ({ ...old, [product.id]: event.target.value as PurchasePlan }))}
                                            className="w-full rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,.02)] outline-none transition focus:border-emerald-500/70 focus:shadow-[0_0_0_3px_rgba(16,185,129,.12)]"
                                        >
                                            {product.prices.map((price) => (
                                                <option key={price.plan} value={price.plan}>{price.label} — {money.format(price.price)}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <Button disabled={pending} onClick={() => buy(store.id, product.id, plan)} className="w-full">
                                        Comprar
                                    </Button>
                                </Card>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}
