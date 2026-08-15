"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCurrentProductRelease } from "@/lib/actions/admin.actions";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "./Toast";
import { Button, ConfirmDialog } from "./ui";

export function SetCurrentReleaseButton({ productId, version }: { productId: string; version: string }) {
    const router = useRouter();
    const { push } = useToast();
    const [open, setOpen] = useState(false);
    const [pending, startTransition] = useTransition();

    function confirm() {
        startTransition(async () => {
            try {
                await setCurrentProductRelease(productId, version);
                push(`Release v${version} definida como atual.`);
                setOpen(false);
                router.refresh();
            } catch (error) {
                push(getErrorMessage(error, "Não foi possível definir a release atual."), "error");
            }
        });
    }

    return <>
        <Button size="sm" variant="success" onClick={() => setOpen(true)}>Definir como atual</Button>
        <ConfirmDialog
            open={open}
            title="Definir release atual"
            message={`Deseja usar a versão v${version} nas próximas compras e atualizar as aplicações existentes?`}
            confirmLabel="Definir como atual"
            busy={pending}
            onConfirm={confirm}
            onCancel={() => !pending && setOpen(false)}
        />
    </>;
}
