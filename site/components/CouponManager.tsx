"use client";

import { useState } from "react";
import type { CouponView, ProductView } from "@/lib/types";
import { formatDateOnly } from "@/lib/status";
import { Badge, Button, Empty } from "./ui";
import { CouponFormModal, DeleteCouponButton } from "./CouponFormModal";

export function CouponManager({
    storeId,
    coupons,
    products,
}: {
    storeId: string;
    coupons: CouponView[];
    products: ProductView[];
}) {
    const [modalOpen, setModalOpen] = useState(false);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className="h-6 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                        <h1 className="text-2xl font-bold tracking-tight text-white">Cupons</h1>
                    </div>
                    <p className="mt-1.5 text-sm text-zinc-500">{coupons.length} cupom(ns)</p>
                </div>
                <Button onClick={() => setModalOpen(true)}>Novo cupom</Button>
            </div>

            {coupons.length === 0 ? (
                <Empty text="Nenhum cupom cadastrado." />
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-zinc-800/80">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-800 bg-zinc-950/80 text-left text-xs uppercase tracking-wide text-zinc-500">
                                <th className="py-3 pl-4 pr-4">Código</th>
                                <th className="py-3 pr-4">Desconto</th>
                                <th className="py-3 pr-4">Usos</th>
                                <th className="py-3 pr-4">Expira</th>
                                <th className="py-3 pr-4">Produtos</th>
                                <th className="py-3 pr-4">Status</th>
                                <th className="py-3 pr-4">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coupons.map((coupon) => (
                                <tr key={coupon.id} className="border-b border-zinc-900 text-zinc-300 transition last:border-0 hover:bg-zinc-900/40">
                                    <td className="py-3 pl-4 pr-4 font-mono text-emerald-300">{coupon.code}</td>
                                    <td className="py-3 pr-4">{coupon.discount}%</td>
                                    <td className="py-3 pr-4">{coupon.remainingUses}</td>
                                    <td className="py-3 pr-4">{formatDateOnly(coupon.expiresAt)}</td>
                                    <td className="py-3 pr-4 text-xs text-zinc-500">{coupon.applicableProductNames}</td>
                                    <td className="py-3 pr-4">
                                        {coupon.valid ? <Badge tone="green">Válido</Badge> : <Badge tone="red">Inválido</Badge>}
                                    </td>
                                    <td className="py-3 pr-4">
                                        <DeleteCouponButton coupon={coupon} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modalOpen && <CouponFormModal storeId={storeId} products={products} onClose={() => setModalOpen(false)} />}
        </div>
    );
}
