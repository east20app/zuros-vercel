"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import { Button, ConfirmDialog, Modal } from "./ui";

export function ReleaseActions({
    storeId,
    productId,
    version,
    status = "published",
}: {
    storeId: string;
    productId: string;
    version: string;
    status?: "uploading" | "published" | "failed";
}) {
    const [files, setFiles] = useState<string[] | null>(null);
    const [confirm, setConfirm] = useState(false);
    const [pending, startTransition] = useTransition();
    const router = useRouter();
    const { push } = useToast();
    const base = `/api/products/${productId}/releases?storeId=${storeId}&version=${version}`;
    const available = status === "published";

    return <>
        <Button size="sm" variant="outline" disabled={!available || pending} onClick={() => startTransition(async () => {
            const response = await fetch(`${base}&mode=files`);
            const data = await response.json();
            if (!response.ok) return push(data.error || "Não foi possível listar os arquivos.", "error");
            setFiles(data.files);
        })}>Ver arquivos</Button>
        {available ? <a className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:text-white" href={base}>Baixar ZIP</a> : null}
        <Button size="sm" variant="danger" onClick={() => setConfirm(true)}>Excluir</Button>
        <Modal open={files !== null} onClose={() => setFiles(null)} title={`Arquivos da v${version}`}>
            <div className="max-h-96 overflow-auto rounded-lg bg-black/30 p-3 font-mono text-xs text-zinc-300">{files?.map((file) => <p key={file}>{file}</p>)}</div>
        </Modal>
        <ConfirmDialog open={confirm} title="Excluir release" message={`Excluir definitivamente a release v${version}?`} confirmLabel="Excluir" danger busy={pending} onCancel={() => setConfirm(false)} onConfirm={() => startTransition(async () => {
            const response = await fetch(`/api/products/${productId}/releases`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ storeId, version }) });
            const data = await response.json();
            if (!response.ok) return push(data.error || "Não foi possível excluir.", "error");
            setConfirm(false);
            push("Release excluída.");
            router.refresh();
        })} />
    </>;
}