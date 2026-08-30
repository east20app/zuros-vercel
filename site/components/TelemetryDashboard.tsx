"use client";
import { useCallback, useEffect, useState } from "react";
import type { LogEntryDTO, ServiceStatusDTO, TelemetrySeverity } from "@root/src/integration/telemetry";

type Telemetry = { statuses: ServiceStatusDTO[]; logs: LogEntryDTO[] };
type ServiceFilter = "all" | "web" | "system";

const severityOptions: { value: TelemetrySeverity; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "error", label: "Erros" },
    { value: "warn", label: "Avisos" },
    { value: "info", label: "Info" },
];
const serviceOptions: { value: ServiceFilter; label: string }[] = [
    { value: "all", label: "Todos os serviços" },
    { value: "web", label: "Painel" },
    { value: "system", label: "Sistema" },
];

function statusPill(state?: string) {
    if (state === "online") return { dot: "bg-[#23a559]", glow: "shadow-[0_0_12px_#23a559]", label: "Online" };
    if (state === "degraded") return { dot: "bg-[#f0b232]", glow: "", label: "Degradado" };
    if (state === "starting") return { dot: "bg-[#d6ff63]", glow: "", label: "Iniciando" };
    return { dot: "bg-[#949ba4]", glow: "", label: "Offline" };
}

export function TelemetryDashboard() {
    const [data, setData] = useState<Telemetry>({ statuses: [], logs: [] });
    const [severity, setSeverity] = useState<TelemetrySeverity>("all");
    const [service, setService] = useState<ServiceFilter>("all");
    const [loading, setLoading] = useState(true);

    const load = useCallback(() => {
        return fetch(`/api/admin/status?severity=${severity}&service=${service}`, { cache: "no-store" })
            .then((response) => response.ok ? response.json() as Promise<Telemetry> : null)
            .catch(() => null);
    }, [severity, service]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        void load().then((value) => { if (active && value) { setData(value); setLoading(false); } });
        const timer = setInterval(() => {
            void load().then((value) => { if (active && value) setData(value); });
        }, 4000);
        return () => { active = false; clearInterval(timer); };
    }, [load]);

    const errorCount = data.logs.filter((entry) => entry.level === "error").length;
    const warnCount = data.logs.filter((entry) => entry.level === "warn").length;

    return (
        <section className="admin-telemetry-panel flex flex-col gap-4 rounded-xl border border-white/[.08] bg-[#122029] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.03)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-semibold text-white">
                    <span className="h-4 w-1 rounded-full bg-[var(--accent)]" />
                    Telemetria da plataforma
                </h2>
                <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1.5 rounded-full border border-[#f23f43]/40 bg-[#f23f43]/10 px-2.5 py-1 text-[#f97175]">{errorCount} erro(s)</span>
                    <span className="flex items-center gap-1.5 rounded-full border border-[#f0b232]/40 bg-[#f0b232]/10 px-2.5 py-1 text-[#f8c25c]">{warnCount} aviso(s)</span>
                    <span className="text-[#949ba4]">Tempo real · 4s</span>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <div className="flex rounded-md bg-[#1e1f22] p-0.5">
                    {severityOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setSeverity(option.value)}
                            aria-pressed={severity === option.value}
                            className={`rounded px-2.5 py-1 text-xs font-medium transition ${severity === option.value ? "bg-[var(--accent)] text-[#091116]" : "text-[#949ba4] hover:text-white"}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <select
                    aria-label="Filtrar por serviço"
                    value={service}
                    onChange={(event) => setService(event.target.value as ServiceFilter)}
                    className="rounded-md border border-[#4e5058]/70 bg-[#1e1f22] px-2.5 py-1 text-xs text-[#b5bac1] outline-none focus:border-[var(--accent)]"
                >
                    {serviceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
            </div>

            <div className="grid gap-2">
                {(["web"] as const).map((name) => {
                    const item = data.statuses.find((status) => status.service === name);
                    const pill = statusPill(item?.state);
                    return (
                        <div key={name} className="flex items-center justify-between rounded-lg border border-white/[.08] bg-[#1e1f22] p-3">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold uppercase tracking-wide text-white">Painel standalone</p>
                                <p className="truncate text-xs text-[#949ba4]">{item?.message || "Aguardando telemetria"}</p>
                            </div>
                            <span className="flex shrink-0 items-center gap-2 text-xs text-[#949ba4]">
                                {pill.label}
                                <span className={`h-2.5 w-2.5 rounded-full ${pill.dot} ${pill.glow}`} />
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="admin-telemetry-feed max-h-72 space-y-1 overflow-auto rounded-lg border border-white/[.06] bg-black/40 p-3 font-mono text-xs shadow-[inset_0_1px_2px_rgba(0,0,0,.6)]">
                {loading && <div className="space-y-2">{[0, 1, 2, 3].map((index) => <div key={index} className="skeleton h-4 w-full rounded" />)}</div>}
                {!loading && data.logs.length === 0 && <p className="text-[#949ba4]">Nenhum evento registrado para este filtro.</p>}
                {!loading && data.logs.map((entry) => (
                    <p key={entry.id} className={entry.level === "error" ? "text-[#f97175]" : entry.level === "warn" ? "text-[#f8c25c]" : "text-[#949ba4]"}>
                        <span className="text-[#72767d]">{new Date(entry.timestamp).toLocaleTimeString("pt-BR")}</span>{" "}
                        [<span className="text-[#b5bac1]">{entry.service}</span>] {entry.message}
                    </p>
                ))}
            </div>
        </section>
    );
}
