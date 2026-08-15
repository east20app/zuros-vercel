"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeStoreBalance } from "@/lib/actions/admin.actions";
import { getErrorMessage } from "@/lib/errors";
import { Button, Field, inputClass, Spinner } from "./ui";
import { useToast } from "./Toast";

export function BalanceForm({ storeId }: { storeId: string }) {
    const router = useRouter();
    const { push } = useToast();
    const [action, setAction] = useState<"add" | "remove">("add");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [busy, setBusy] = useState(false);

    async function handleSubmit() {
        setBusy(true);
        try {
            await changeStoreBalance(storeId, { action, amount: Number(amount), description });
            push(action === "add" ? "Saldo adicionado." : "Saldo removido.");
            setAmount("");
            setDescription("");
            router.refresh();
        } catch (e) {
            push(getErrorMessage(e, "Erro ao alterar saldo."), "error");
        } finally {
            setBusy(false);
        }
    }

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
            }}
        >
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setAction("add")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium shadow-[inset_0_1px_0_rgba(255,255,255,.03)] transition ${
                        action === "add"
                            ? "border-emerald-500/50 bg-gradient-to-b from-emerald-500/20 to-emerald-500/10 text-emerald-300 shadow-[0_8px_20px_-10px_rgba(16,185,129,.5)]"
                            : "border-zinc-700 text-zinc-400 hover:bg-zinc-900"
                    }`}
                >
                    Adicionar
                </button>
                <button
                    type="button"
                    onClick={() => setAction("remove")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium shadow-[inset_0_1px_0_rgba(255,255,255,.03)] transition ${
                        action === "remove"
                            ? "border-red-500/50 bg-gradient-to-b from-red-500/20 to-red-500/10 text-red-300 shadow-[0_8px_20px_-10px_rgba(239,68,68,.5)]"
                            : "border-zinc-700 text-zinc-400 hover:bg-zinc-900"
                    }`}
                >
                    Remover
                </button>
            </div>
            <Field label="Valor (R$)">
                <input
                    className={inputClass}
                    type="number"
                    step="0.01"
                    min={0.01}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                />
            </Field>
            <Field label="Descrição">
                <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Motivo do ajuste" />
            </Field>
            <div className="flex justify-end">
                <Button type="submit" disabled={busy}>
                    {busy ? <Spinner /> : null}
                    Aplicar
                </Button>
            </div>
        </form>
    );
}
