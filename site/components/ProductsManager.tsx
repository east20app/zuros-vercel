"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createStoreProduct, deleteStoreProduct, saveStoreProduct, type StoreProductEntry } from "@/lib/actions/vendas.actions";
import { getErrorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/status";
import { Badge, Button, Card, ConfirmDialog, Empty, Field, Modal, Spinner, inputClass } from "./ui";
import { useToast } from "./Toast";

export function ProductsManager({ appId, initial }: { appId: string; initial: StoreProductEntry[] }) {
    const router = useRouter();
    const { push } = useToast();
    const products = initial;
    const [busy, setBusy] = useState<string | null>(null);
    const [editing, setEditing] = useState<StoreProductEntry | null>(null);
    const [deleting, setDeleting] = useState<StoreProductEntry | null>(null);
    const [name, setName] = useState("");
    const [hexColor, setHexColor] = useState("");
    const [deliveryType, setDeliveryType] = useState("automatic");
    const [description, setDescription] = useState("");

    function openEdit(product: StoreProductEntry) {
        setEditing(product);
        setName(product.name);
        setHexColor(product.hexColor);
        setDeliveryType(product.deliveryType || "automatic");
        setDescription(product.description || "");
    }

    async function run(action: string, fn: () => Promise<unknown>, success: string) {
        setBusy(action);
        try {
            await fn();
            push(success);
            router.refresh();
        } catch (e) {
            push(getErrorMessage(e, "Erro ao executar operação."), "error");
        } finally {
            setBusy(null);
        }
    }

    async function commitEdit() {
        if (!editing) return;
        const trimmed = name.trim();
        if (!trimmed) {
            push("Nome do produto é obrigatório.", "error");
            return;
        }
        await run("save", () => saveStoreProduct(appId, editing.id, { name: trimmed, hexColor, deliveryType, description: description || null }), "Produto atualizado.");
        setEditing(null);
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-zinc-500">{products.length} {products.length === 1 ? "produto" : "produtos"} na vitrine.</p>
                <Button
                    size="sm"
                    disabled={busy === "create"}
                    onClick={() => void run("create", () => createStoreProduct(appId), "Produto criado.")}
                >
                    {busy === "create" ? <Spinner /> : null}
                    Novo produto
                </Button>
            </div>

            {products.length === 0 ? (
                <Empty text="Nenhum produto cadastrado na vitrine." />
            ) : (
                <Card className="overflow-hidden p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1000px] text-left text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-xs uppercase tracking-wide text-zinc-500">
                                    <th className="p-4">Produto</th>
                                    <th className="p-4">Entrega</th>
                                    <th className="p-4">Campos</th>
                                    <th className="p-4">Preço a partir de</th>
                                    <th className="p-4">Estoque</th>
                                    <th className="p-4">Vendas</th>
                                    <th className="p-4">Receita</th>
                                    <th className="p-4 pr-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((product) => (
                                    <tr key={product.id} className="border-b border-zinc-900 text-zinc-300 transition last:border-0 hover:bg-zinc-900/40">
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <span className="h-6 w-6 shrink-0 rounded-lg border border-zinc-800" style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(product.hexColor) ? product.hexColor : "#18181b" }} />
                                                <div className="min-w-0">
                                                    <span className="block font-medium text-white">{product.name}</span>
                                                    {product.description && <span className="block max-w-[260px] truncate text-xs text-zinc-500">{product.description}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">{product.deliveryType === "manual" ? <Badge tone="amber">Manual</Badge> : <Badge tone="green">Automática</Badge>}</td>
                                        <td className="p-4 text-zinc-400">{product.campos}</td>
                                        <td className="p-4 text-zinc-400">{product.minPrice === null ? "—" : formatMoney(product.minPrice)}</td>
                                        <td className="p-4 text-zinc-400">{product.stock}</td>
                                        <td className="p-4 text-zinc-400">{product.sales}</td>
                                        <td className="p-4 font-medium text-emerald-300">{formatMoney(product.totalPaid)}</td>
                                        <td className="space-x-2 p-4 pr-4 text-right">
                                            <button onClick={() => openEdit(product)} className="rounded-md px-2 py-1 text-emerald-400 transition hover:bg-emerald-500/10">Editar</button>
                                            <button onClick={() => setDeleting(product)} className="rounded-md px-2 py-1 text-red-400 transition hover:bg-red-500/10">Excluir</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? `Editar: ${editing.name}` : "Produto"}>
                <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        commitEdit();
                    }}
                >
                    <Field label="Nome do produto">
                        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
                    </Field>
                    <Field label="Cor da mensagem">
                        <div className="flex gap-2">
                            <input aria-label="Selecionar cor" type="color" value={/^#[0-9a-f]{6}$/i.test(hexColor) ? hexColor : "#000000"} onChange={(e) => setHexColor(e.target.value)} className="h-10 w-12 cursor-pointer rounded border border-zinc-700 bg-zinc-900 p-1" />
                            <input className={inputClass} value={hexColor} placeholder="#RRGGBB" onChange={(e) => setHexColor(e.target.value)} />
                        </div>
                    </Field>
                    <Field label="Tipo de entrega">
                        <select className={inputClass} value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)}>
                            <option value="automatic">Automática</option>
                            <option value="manual">Manual</option>
                        </select>
                    </Field>
                    <Field label="Descrição">
                        <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                    </Field>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                        <Button type="submit" disabled={busy === "save"}>
                            {busy === "save" ? <Spinner /> : null}
                            Salvar
                        </Button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog
                open={Boolean(deleting)}
                title="Excluir produto"
                message={`Tem certeza que deseja excluir "${deleting?.name || ""}" da vitrine? Esta ação não pode ser desfeita.`}
                confirmLabel="Excluir"
                danger
                busy={busy === "delete"}
                onCancel={() => setDeleting(null)}
                onConfirm={() => {
                    const product = deleting;
                    setDeleting(null);
                    if (product) void run("delete", () => deleteStoreProduct(appId, product.id), "Produto excluído.");
                }}
            />
        </div>
    );
}
