"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approvePayment, rejectPayment } from "@/lib/actions/admin.actions";
import { getErrorMessage } from "@/lib/errors";
import { Button, ConfirmDialog, Spinner } from "./ui";
import { useToast } from "./Toast";

export function PaymentActions({ type, id }: { type: "renew" | "buy"; id: string }) {
    const router = useRouter();
    const { push } = useToast();
    const [busy, setBusy] = useState<string | null>(null);
    const [rejectConfirming, setRejectConfirming] = useState(false);

    async function run(action: string, fn: () => Promise<unknown>, successMsg: string) {
        setBusy(action);
        try {
            await fn();
            push(successMsg);
            router.refresh();
        } catch (e) {
            push(getErrorMessage(e, "Erro na operação."), "error");
        } finally {
            setBusy(null);
        }
    }

    return (
        <div className="flex flex-wrap gap-2">
            <Button
                size="sm"
                variant="success"
                disabled={!!busy}
                onClick={() => run("approve-balance", () => approvePayment({ type, id, addBalance: true }), "Pagamento aprovado e saldo adicionado.")}
            >
                {busy === "approve-balance" ? <Spinner /> : null}
                Aprovar + saldo
            </Button>
            <Button
                size="sm"
                variant="secondary"
                disabled={!!busy}
                onClick={() => run("approve", () => approvePayment({ type, id, addBalance: false }), "Pagamento aprovado.")}
            >
                {busy === "approve" ? <Spinner /> : null}
                Aprovar
            </Button>
            <Button
                size="sm"
                variant="danger"
                disabled={!!busy}
                onClick={() => setRejectConfirming(true)}
            >
                {busy === "reject" ? <Spinner /> : null}
                Recusar
            </Button>

            <ConfirmDialog
                open={rejectConfirming}
                title="Recusar pagamento"
                message="Tem certeza que deseja recusar este pagamento? O valor não será aplicado."
                confirmLabel="Recusar"
                danger
                busy={busy === "reject"}
                onCancel={() => setRejectConfirming(false)}
                onConfirm={() => {
                    setRejectConfirming(false);
                    run("reject", () => rejectPayment({ type, id }), "Pagamento recusado.");
                }}
            />
        </div>
    );
}
