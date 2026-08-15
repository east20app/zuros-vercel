"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCoupon, deleteCoupon, deleteProduct } from "@/lib/actions/admin.actions";
import type { CouponView, ProductView } from "@/lib/types";
import { getErrorMessage } from "@/lib/errors";
import { Button, ConfirmDialog, Field, inputClass, Modal, Spinner } from "./ui";
import { useToast } from "./Toast";

export function CouponFormModal({
    storeId,
    products,
    onClose,
}: {
    storeId: string;
    products: ProductView[];
    onClose: () => void;
}) {
    const router = useRouter();
    const { push } = useToast();
    const [busy, setBusy] = useState(false);
    const [code, setCode] = useState("");
    const [discount, setDiscount] = useState("10");
    const [remainingUses, setRemainingUses] = useState("1");
    const [expiresAt, setExpiresAt] = useState("");
    const [productIds, setProductIds] = useState<string[]>([]);

    async function handleSubmit() {
        setBusy(true);
        try {
            await createCoupon(storeId, {
                code,
                discount: Number(discount),
                remainingUses: Number(remainingUses),
                expiresAt: new Date(expiresAt).toISOString(),
                products: productIds.length ? productIds : ["all"],
            });
            push("Cupom criado.");
            router.refresh();
            onClose();
        } catch (e) {
            push(getErrorMessage(e, "Erro ao criar cupom."), "error");
        } finally {
            setBusy(false);
        }
    }

    function toggleProduct(id: string) {
        setProductIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
    }

    return (
        <Modal open onClose={onClose} title="Novo cupom">
            <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit();
                }}
            >
                <Field label="Código">
                    <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} required />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Desconto (%)">
                        <input className={inputClass} type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(e.target.value)} required />
                    </Field>
                    <Field label="Usos restantes">
                        <input className={inputClass} type="number" min={0} value={remainingUses} onChange={(e) => setRemainingUses(e.target.value)} required />
                    </Field>
                </div>
                <Field label="Expira em">
                    <input className={inputClass} type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} required />
                </Field>
                <Field label="Produtos" hint="Nenhum selecionado = vale para todos.">
                    <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg border border-zinc-700/80 bg-zinc-900/80 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.02)]">
                        {products.map((p) => (
                            <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800/60">
                                <input
                                    type="checkbox"
                                    checked={productIds.includes(p.id)}
                                    onChange={() => toggleProduct(p.id)}
                                    className="h-4 w-4 rounded accent-emerald-500"
                                />
                                {p.name}
                            </label>
                        ))}
                    </div>
                </Field>
                <div className="mt-2 flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={busy}>
                        {busy ? <Spinner /> : null}
                        Criar
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

export function DeleteCouponButton({ coupon }: { coupon: CouponView }) {
    const router = useRouter();
    const { push } = useToast();
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(false);

    async function handleDelete() {
        setBusy(true);
        try {
            await deleteCoupon(coupon.id);
            push("Cupom excluído.");
            router.refresh();
            setConfirming(false);
        } catch (e) {
            push(getErrorMessage(e, "Erro ao excluir cupom."), "error");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => setConfirming(true)}>
                {busy ? <Spinner /> : null}
                Excluir
            </Button>
            <ConfirmDialog
                open={confirming}
                title="Excluir cupom"
                message={`Tem certeza que deseja excluir o cupom "${coupon.code}"? Esta ação não pode ser desfeita.`}
                confirmLabel="Excluir"
                danger
                busy={busy}
                onCancel={() => setConfirming(false)}
                onConfirm={handleDelete}
            />
        </>
    );
}

export function DeleteProductButton({ productId }: { productId: string }) {
    const router = useRouter();
    const { push } = useToast();
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(false);

    async function handleDelete() {
        setBusy(true);
        try {
            await deleteProduct(productId);
            push("Produto excluído.");
            router.refresh();
            setConfirming(false);
        } catch (e) {
            push(getErrorMessage(e, "Erro ao excluir produto."), "error");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => setConfirming(true)}>
                {busy ? <Spinner /> : null}
                Excluir
            </Button>
            <ConfirmDialog
                open={confirming}
                title="Excluir produto"
                message="Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita."
                confirmLabel="Excluir"
                danger
                busy={busy}
                onCancel={() => setConfirming(false)}
                onConfirm={handleDelete}
            />
        </>
    );
}
