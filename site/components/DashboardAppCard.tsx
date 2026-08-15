"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { restartApp, startApp, stopApp } from "@/lib/actions/apps.actions";
import { getErrorMessage } from "@/lib/errors";
import { getRemainingLabel, getRemainingTone } from "@/lib/status";
import type { AppSummary } from "@/lib/types";
import { Badge, Button, ConfirmDialog, Spinner } from "./ui";
import { useToast } from "./Toast";

export function DashboardAppCard({ app, index = 0 }: { app: AppSummary; index?: number }) {
    const router = useRouter();
    const { push } = useToast();
    const [busy, setBusy] = useState<string | null>(null);
    const [stopConfirming, setStopConfirming] = useState(false);

    const tone = getRemainingTone(app.expiresAt, app.lifetime);
    const expiring = app.status === "active" && tone !== "green";
    const routeId = app.botId || app.id;

    async function run(action: string, fn: () => Promise<unknown>, message: string) {
        setBusy(action);
        try {
            const result = await fn();
            if (result && typeof result === "object" && "ok" in result && result.ok === false && "error" in result) throw new Error(String(result.error));
            push(message);
            router.refresh();
        } catch (error) {
            push(getErrorMessage(error, "Erro ao executar operação."), "error");
        } finally {
            setBusy(null);
        }
    }

    return (
        <div
            className="zuros-card zuros-card-lit zuros-lift flex h-full flex-col gap-3 p-5 animate-fade-up"
            style={{ animationDelay: `${index * 45}ms` }}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#5865f2] to-[#eb459e] text-base font-bold text-white shadow-[0_0_18px_-8px_rgba(235,69,158,.6)]">
                        {app.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/dashboard/${routeId}`} className="truncate font-display font-semibold text-white transition hover:text-magenta-300">
                                {app.name}
                            </Link>
                            <i
                                title={app.errorOnUpdate ? "Erro na atualização" : app.status !== "active" ? "Período de carência" : "Ativo"}
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                    app.errorOnUpdate
                                        ? "bg-red-500 shadow-[0_0_8px_rgba(242,63,67,.9)]"
                                        : app.status !== "active"
                                          ? "bg-amber-400 shadow-[0_0_8px_rgba(240,178,50,.9)]"
                                          : "bg-emerald-500 shadow-[0_0_8px_rgba(35,165,89,.9)]"
                                }`}
                            />
                        </div>
                        <p className="truncate text-xs text-zinc-500">{app.productName}</p>
                        {app.storeName && <p className="truncate text-xs text-zinc-600">{app.storeName}</p>}
                    </div>
                </div>
                {app.errorOnUpdate ? (
                    <Badge tone="red">Erro</Badge>
                ) : app.status !== "active" ? (
                    <Badge tone="amber">Carência</Badge>
                ) : expiring ? (
                    <Badge tone="amber">Expira</Badge>
                ) : (
                    <Badge tone="green">Ativo</Badge>
                )}
            </div>

            <div className="flex flex-col gap-1.5 rounded-xl border border-white/[.05] bg-background px-3 py-2.5 text-xs text-zinc-400">
                <div className="flex items-center justify-between">
                    <span>Plano</span>
                    <span className={tone === "red" ? "font-medium text-red-400" : tone === "amber" ? "font-medium text-amber-400" : "font-medium text-white"}>
                        {getRemainingLabel(app.expiresAt, app.lifetime)}
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <span>Versão</span>
                    <span className="font-medium text-zinc-200">v{app.version}</span>
                </div>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-2">
                <Button size="sm" variant="success" disabled={!!busy || app.status !== "active"} title={app.status !== "active" ? "Renove a aplicação para iniciar" : "Iniciar bot"} onClick={() => run("start", () => startApp(app.id), "Bot iniciado com sucesso.")}>
                    {busy === "start" ? <Spinner /> : null}Iniciar
                </Button>
                <Button size="sm" variant="secondary" disabled={!!busy || app.status !== "active"} title={app.status !== "active" ? "Aplicação em carência" : "Pausar bot"} onClick={() => setStopConfirming(true)}>
                    {busy === "stop" ? <Spinner /> : null}Pausar
                </Button>
                <Button size="sm" variant="secondary" disabled={!!busy || app.status !== "active"} title={app.status !== "active" ? "Renove a aplicação para reiniciar" : "Reiniciar bot"} onClick={() => run("restart", () => restartApp(app.id), "Bot reiniciado com sucesso.")}>
                    {busy === "restart" ? <Spinner /> : null}Reiniciar
                </Button>
                <Button size="sm" variant="primary" href={app.status === "active" ? `/dashboard/${routeId}/config` : "/dashboard/invoices"} className="ml-auto">
                    {app.status === "active" ? "Configurar DROX" : "Renovar"}
                </Button>
            </div>

            <ConfirmDialog
                open={stopConfirming}
                title="Pausar aplicação"
                message="Tem certeza que deseja pausar esta aplicação? Ela ficará offline até ser iniciada novamente."
                confirmLabel="Pausar"
                danger
                busy={busy === "stop"}
                onCancel={() => setStopConfirming(false)}
                onConfirm={() => {
                    setStopConfirming(false);
                    run("stop", () => stopApp(app.id), "Bot pausado.");
                }}
            />
        </div>
    );
}
