"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { forceUpdateAllProductApplications } from "@/lib/actions/admin.actions";
import { getErrorMessage } from "@/lib/errors";
import { Button, ConfirmDialog } from "./ui";
import { useToast } from "./Toast";

export function ReleaseDeploymentActions({ productId, applicationsCount, disabled }: { productId: string; applicationsCount: number; disabled: boolean }) {
    const [open, setOpen] = useState(false);
    const [pending, startTransition] = useTransition();
    const router = useRouter();
    const { push } = useToast();

    function confirm() {
        startTransition(async () => {
            try {
                const result = await forceUpdateAllProductApplications(productId);
                const detail = result.failed > 0 ? ` ${result.failed} falharam; consulte os erros abaixo.` : result.pending > 0 ? ` ${result.pending} continuam na fila.` : "";
                push(`${result.updated} de ${result.count} bot(s) atualizado(s).${detail}`, result.failed > 0 ? "error" : "success");
                setOpen(false);
                router.refresh();
            } catch (error) {
                push(getErrorMessage(error, "Não foi possível iniciar a atualização."), "error");
            }
        });
    }

    return <>
        <Button variant="success" disabled={disabled || applicationsCount === 0} onClick={() => setOpen(true)}>Atualizar todos os bots</Button>
        <ConfirmDialog
            open={open}
            title="Atualizar todos os bots"
            message={"Reinstalar a release atual nos " + applicationsCount + " bot(s) deste produto? Arquivos protegidos serão preservados."}
            confirmLabel="Iniciar atualização"
            busy={pending}
            onConfirm={confirm}
            onCancel={() => !pending && setOpen(false)}
        />
    </>;
}