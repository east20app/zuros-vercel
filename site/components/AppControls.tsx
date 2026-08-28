"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startApp, stopApp, restartApp } from "@/lib/actions/apps.actions";
import { getErrorMessage } from "@/lib/errors";
import { Button, ConfirmDialog, Spinner } from "./ui";
import { useToast } from "./Toast";
import type { AppStatus } from "@/lib/types";

export function AppControls({ appId, status, online, variant = "full" }: { appId: string; botId: string; status: AppStatus; online: boolean; variant?: "full" | "quick" }) {
    const router = useRouter();
    const { push } = useToast();
    const [busy, setBusy] = useState<string | null>(null);
    const [stopConfirming, setStopConfirming] = useState(false);

    const successMessages: Record<string, string> = {
        start: "Bot iniciado com sucesso.",
        restart: "Bot reiniciado com sucesso.",
        stop: "Bot parado.",
    };

    async function run(action: string, fn: () => Promise<unknown>) {
        setBusy(action);
        try {
            const result = await fn();
            if (result && typeof result === "object" && "ok" in result && result.ok === false && "error" in result) {
                throw new Error(String(result.error));
            }
            push(successMessages[action] || "Operação realizada com sucesso.");
            router.refresh();
            return result ?? true;
        } catch (error) {
            push(getErrorMessage(error, "Erro ao executar operação."), "error");
            return null;
        } finally {
            setBusy(null);
        }
    }

    return (
        <>
            {status !== "active" ? (
                <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-200">
                    <p className="font-semibold">Controles pausados durante a carência</p>
                    <p className="mt-1 text-xs text-amber-200/75">Renove a aplicação para voltar a iniciar, parar ou reiniciar o bot.</p>
                    <Button href="/dashboard/invoices" size="sm" className="mt-3">Ver renovação</Button>
                </div>
            ) : null}

            <div className={variant === "quick"
                ? "grid grid-cols-3 gap-2 [&>*]:h-10 [&>*]:min-w-0 [&>*]:px-1 [&>*]:text-xs"
                : "grid max-w-lg grid-cols-3 gap-2 [&>*]:min-w-0 [&>*]:px-2"}>
                <Button variant="success" disabled={!!busy || status !== "active" || online} title={status !== "active" ? "Renove a aplicação para iniciar" : online ? "O bot já está online" : "Iniciar bot"} onClick={() => run("start", () => startApp(appId))}>
                    {busy === "start" ? <Spinner /> : null}
                    Iniciar
                </Button>
                <Button variant="secondary" disabled={!!busy || status !== "active"} title={status !== "active" ? "Renove a aplicação para reiniciar" : online ? "Reiniciar bot" : "O bot está offline e será iniciado"} onClick={() => run("restart", () => restartApp(appId))}>
                    {busy === "restart" ? <Spinner /> : null}
                    Reiniciar
                </Button>
                <Button variant="danger" disabled={!!busy || status !== "active" || !online} title={status !== "active" ? "Aplicação em carência" : !online ? "O bot já está offline" : "Parar bot"} onClick={() => setStopConfirming(true)}>
                    {busy === "stop" ? <Spinner /> : null}
                    Parar
                </Button>
            </div>

            <ConfirmDialog
                open={stopConfirming}
                title="Parar aplicação"
                message="Tem certeza que deseja parar esta aplicação? Ela ficará offline até ser iniciada novamente."
                confirmLabel="Parar"
                danger
                busy={busy === "stop"}
                onCancel={() => setStopConfirming(false)}
                onConfirm={() => {
                    setStopConfirming(false);
                    void run("stop", () => stopApp(appId));
                }}
            />
        </>
    );
}