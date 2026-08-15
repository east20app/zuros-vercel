"use client";

import { useState } from "react";
import type { ProductView } from "@/lib/types";
import { formatMoney } from "@/lib/status";
import { Badge, Button, Card, Empty } from "./ui";
import { ProductFormModal } from "./ProductFormModal";
import { DeleteProductButton } from "./CouponFormModal";
import { PublishProductButton } from "./PublishProductButton";
import { ProductUpdateActions } from "./ProductUpdateActions";

export function ProductManager({ storeId, products }: { storeId: string; products: ProductView[] }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<ProductView | null>(null);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className="h-6 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                        <h1 className="text-2xl font-bold tracking-tight text-white">Produtos</h1>
                    </div>
                    <p className="mt-1.5 text-sm text-zinc-500">{products.length} produto(s)</p>
                </div>
                <Button
                    onClick={() => {
                        setEditing(null);
                        setModalOpen(true);
                    }}
                >
                    Novo produto
                </Button>
            </div>

            {products.length === 0 ? (
                <Empty text="Nenhum produto cadastrado." />
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    {products.map((product) => (
                        <Card key={product.id} className="flex flex-col gap-3 transition hover:border-emerald-500/25">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-3">
                                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/15 to-transparent text-sm font-bold text-emerald-400">{product.name.charAt(0).toUpperCase()}</span>
                                    <div>
                                        <h2 className="font-semibold text-white">{product.name}</h2>
                                        <p className="text-xs text-zinc-500">
                                            {product.runtimeEnvironment} · {product.runCommand}
                                        </p>
                                    </div>
                                </div>
                                {product.needToUpdateApplications ? (
                                    <Badge tone="amber">Atualizar apps</Badge>
                                ) : (
                                    <Badge tone="green">Release v{product.currentReleaseVersion || "0.0.0"}</Badge>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/[.04] bg-black/30 p-3 text-xs text-zinc-400 sm:grid-cols-4">
                                {product.prices.weekly !== undefined && (
                                    <span>Semanal: {formatMoney(product.prices.weekly)}</span>
                                )}
                                {product.prices.biweekly !== undefined && (
                                    <span>Quinzenal: {formatMoney(product.prices.biweekly)}</span>
                                )}
                                {product.prices.monthly !== undefined && (
                                    <span>Mensal: {formatMoney(product.prices.monthly)}</span>
                                )}
                                {product.prices.lifetime !== undefined && (
                                    <span>Vitalício: {formatMoney(product.prices.lifetime)}</span>
                                )}
                                {!Object.values(product.prices).some((v) => typeof v === "number" && v > 0) && (
                                    <span className="text-zinc-600">Sem preços definidos</span>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                <span>{product.applicationsCount} aplicação(ões)</span>
                                {product.pendingUpdateApplications > 0 && (
                                    <span className="text-amber-400">{product.pendingUpdateApplications} aguardando update</span>
                                )}
                                {product.errorOnUpdateApplications > 0 && (
                                    <span className="text-red-400">{product.errorOnUpdateApplications} com erro</span>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" href={`/admin/${storeId}/products/${product.id}/releases`}>
                                    Releases
                                </Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                        setEditing(product);
                                        setModalOpen(true);
                                    }}
                                >
                                    Editar
                                </Button>
                                <DeleteProductButton productId={product.id} />
                                <PublishProductButton productId={product.id} />
                                <ProductUpdateActions productId={product.id} productName={product.name} pendingCount={product.pendingUpdateApplications} errorCount={product.errorOnUpdateApplications} />
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {modalOpen && (
                <ProductFormModal
                    storeId={storeId}
                    product={editing}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </div>
    );
}
