"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteStoreApplication } from "@/lib/actions/admin.actions";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "./Toast";
import { Button, ConfirmDialog } from "./ui";

export function DeleteApplicationButton({ appId, appName }: { appId: string; appName: string }) {
    const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
    const router = useRouter(); const { push } = useToast();
    async function remove() { setBusy(true); try { await deleteStoreApplication(appId); push(`Aplicação ${appName} excluída.`); setOpen(false); router.refresh(); } catch (error) { push(getErrorMessage(error, "Não foi possível excluir a aplicação."), "error"); } finally { setBusy(false); } }
    return <><Button size="sm" variant="danger" onClick={() => setOpen(true)}>Excluir</Button><ConfirmDialog open={open} title="Excluir aplicação" message={`A aplicação “${appName}” será removida da hospedagem e do banco de dados. Esta ação não pode ser desfeita.`} confirmLabel="Excluir definitivamente" danger busy={busy} onConfirm={remove} onCancel={() => !busy && setOpen(false)} /></>;
}
