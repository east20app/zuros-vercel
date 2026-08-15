"use client";
import { useRef, useState } from "react";
import { Button, Spinner } from "./ui";
import { useToast } from "./Toast";
export function CertificateUploader() {
    const ref = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const { push } = useToast();
    async function submit(event: React.FormEvent) { event.preventDefault(); const file = ref.current?.files?.[0]; if (!file) return push("Selecione o certificado.", "error"); setBusy(true); try { const body = new FormData(); body.append("certificate", file); const response = await fetch("/api/admin/certificate", { method: "POST", body }); const result = await response.json() as { valid?: boolean; error?: string }; if (!response.ok) throw new Error(result.error || "Falha no envio."); push(result.valid ? "Certificado validado e salvo." : "Certificado salvo, mas as credenciais EFI não foram validadas.", result.valid ? "success" : "info"); if (ref.current) ref.current.value = ""; } catch (error) { push(error instanceof Error ? error.message : "Falha no envio.", "error"); } finally { setBusy(false); } }
    return <form onSubmit={submit} className="space-y-3"><input ref={ref} type="file" accept=".p12,.pfx,.pem" disabled={busy} className="block w-full rounded-xl border border-zinc-700/80 bg-zinc-900/80 p-2.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,.02)] transition file:mr-3 file:rounded-lg file:border-0 file:bg-gradient-to-b file:from-zinc-200 file:to-zinc-400 file:px-3.5 file:py-1.5 file:font-semibold file:text-black hover:file:from-white hover:file:to-zinc-300 focus:border-emerald-500/60" /><Button type="submit" disabled={busy}>{busy && <Spinner />}Enviar e validar certificado</Button></form>;
}
