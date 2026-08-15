"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import { Button, Spinner } from "./ui";

const MAX_SIZE = 50 * 1024 * 1024;

export function ReleaseUploader({ storeId, productId, disabled }: { storeId: string; productId: string; disabled: boolean }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const { push } = useToast();
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const file = inputRef.current?.files?.[0];
        if (!file) return push("Selecione um arquivo.", "error");
        if (!file.name.toLowerCase().endsWith(".zip")) return push("Envie um arquivo .zip válido.", "error");
        if (file.size === 0) return push("O arquivo está vazio.", "error");
        if (file.size > MAX_SIZE) return push("O arquivo excede o limite de 50 MB.", "error");

        setBusy(true);
        setProgress(0);
        try {
            const chunkSize = 3 * 1024 * 1024;
            const total = Math.ceil(file.size / chunkSize);
            const uploadId = crypto.randomUUID();
            let result: { version?: string; error?: string } = {};
            for (let index = 0; index < total; index++) {
                const chunk = file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize));
                const query = new URLSearchParams({ chunk: "1", storeId, uploadId, index: String(index), total: String(total) });
                const response = await fetch(`/api/products/${productId}/releases?${query}`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: chunk });
                result = await response.json() as typeof result;
                if (!response.ok) throw new Error(result.error || `Erro HTTP ${response.status}.`);
                setProgress(Math.round(((index + 1) / total) * 100));
            }
            if (!result.version) throw new Error(result.error || "O servidor não retornou a versão publicada.");
            push(`Release ${result.version} publicada com sucesso.`);
            if (inputRef.current) inputRef.current.value = "";
            router.refresh();
        } catch (error) {
            push(error instanceof Error ? error.message : "Não foi possível enviar a release.", "error");
        } finally {
            setBusy(false);
            setProgress(0);
        }
    }

    return <form onSubmit={submit} className="space-y-3">
        <input ref={inputRef} type="file" accept=".zip,application/zip" disabled={busy || disabled} className="block w-full rounded-xl border border-zinc-700/80 bg-zinc-900/80 p-2.5 text-sm text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,.02)] transition file:mr-3 file:rounded-lg file:border-0 file:bg-gradient-to-b file:from-emerald-400 file:to-emerald-600 file:px-3.5 file:py-1.5 file:font-semibold file:text-black hover:file:from-emerald-300 hover:file:to-emerald-500 focus:border-emerald-500/60" />
        {busy && <div className="space-y-1" aria-live="polite"><div className="h-2 overflow-hidden rounded-full bg-zinc-800 shadow-[inset_0_1px_2px_rgba(0,0,0,.5)]"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[0_0_10px_rgba(16,185,129,.6)] transition-[width] duration-200" style={{ width: `${progress}%` }} /></div><p className="text-xs text-zinc-400">{progress < 100 ? `Enviando ${progress}%` : "Validando e publicando…"}</p></div>}
        <Button type="submit" disabled={busy || disabled}>{busy && <Spinner />}{busy ? "Processando…" : "Enviar release .zip"}</Button>
    </form>;
}
