"use client";
import { useMemo } from "react";
import { Icon } from "./Icon";

function collectFlags(source: Record<string, unknown>, prefix: string[] = [], state: { defenses: number } = { defenses: 0 }): { path: string[]; label: string; value: boolean }[] {
    return Object.entries(source).flatMap(([key, value]) => {
        const path = [...prefix, key];
        if (typeof value === "boolean") return [{ path, label: key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), value }];
        if (value && typeof value === "object" && !Array.isArray(value)) {
            const nested = value as Record<string, unknown>;
            if (Boolean(nested.ativado)) state.defenses += 1;
            return collectFlags(nested, path, state);
        }
        return [];
    });
}
function countEntries(value: unknown): number {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length;
    return 0;
}

export function ProtectionDashboard({ data }: { data: Record<string, unknown> }) {
    const { flags, activeDefenses } = useMemo(() => {
        const state = { defenses: 0 };
        const flags = collectFlags(data, [], state);
        return { flags, activeDefenses: state.defenses };
    }, [data]);
    const active = flags.filter((flag) => flag.value).length;
    const level = flags.length ? Math.round((active / flags.length) * 100) : 0;
    const label = level >= 80 ? "Reforçado" : level >= 50 ? "Equilibrado" : level > 0 ? "Frágil" : "Sem defesas ativas";
    const authorizedCount = countEntries(data.authorized);
    const antifakeEnabled = Boolean((data.antifake as Record<string, unknown> | undefined)?.enabled);

    const color = level >= 80 ? "#23a559" : level >= 50 ? "#f0b232" : level > 0 ? "#f23f43" : "#4e5058";

    return (
        <div className="rounded-2xl border border-white/[.1] bg-[#101012] p-5 sm:p-6">
            <div className="flex items-center gap-4">
                <div className="relative grid h-20 w-20 shrink-0 place-items-center">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-16 w-16 fill-none stroke-current drop-shadow-[0_0_14px_rgba(124,58,237,.4)]" style={{ color }}>
                        <path strokeWidth="1.5" d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" />
                    </svg>
                    <span className="absolute inset-0 grid place-items-center">
                        <span className="text-lg font-black" style={{ color }}>{level}%</span>
                    </span>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#7c3aed]/15 text-[#949cf7]"><Icon name="shield" /></span>
                        <h3 className="text-sm font-semibold text-white">Escudo de proteção</h3>
                    </div>
                    <p className="mt-1 text-sm text-[#b5bac1]">{label}</p>
                    <p className="mt-0.5 text-xs text-[#949ba4]">{active} de {flags.length} defesas ativas no servidor</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${activeDefenses > 0 ? "border-[#23a559]/30 bg-[#23a559]/10 text-[#4ade80]" : "border-white/[.08] bg-white/[.03] text-[#949ba4]"}`}><i className={`h-1.5 w-1.5 rounded-full ${activeDefenses > 0 ? "bg-[#22c55e]" : "bg-[#4e5058]"}`} />{activeDefenses} barreiras ligadas</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${antifakeEnabled ? "border-[#23a559]/30 bg-[#23a559]/10 text-[#4ade80]" : "border-white/[.08] bg-white/[.03] text-[#949ba4]"}`}><i className={`h-1.5 w-1.5 rounded-full ${antifakeEnabled ? "bg-[#22c55e]" : "bg-[#4e5058]"}`} />Anti-fake {antifakeEnabled ? "ativo" : "inativo"}</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[.08] bg-white/[.03] px-2.5 py-1 text-[11px] font-medium text-[#949ba4]"><i className="h-1.5 w-1.5 rounded-full bg-[#5865F2]" />{authorizedCount} autorizado(s)</span>
                    </div>
                </div>
            </div>

            {flags.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {flags.map((flag) => (
                        <div key={flag.path.join(".")} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${flag.value ? "border-[#23a559]/30 bg-[#23a559]/[.06]" : "border-white/[.06] bg-[#1e1f22]"}`}>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-[#f2f3f5]">{flag.label}</p>
                                <p className="truncate text-xs text-[#949ba4]">{flag.path.slice(0, -1).join(" / ") || "Proteção geral"}</p>
                            </div>
                            <span className={`flex shrink-0 items-center gap-1.5 text-xs font-medium ${flag.value ? "text-[#2fc06a]" : "text-[#949ba4]"}`}>
                                <span className={`h-2 w-2 rounded-full ${flag.value ? "bg-[#23a559] shadow-[0_0_8px_#23a559]" : "bg-[#4e5058]"}`} />
                                {flag.value ? "Ativada" : "Desativada"}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            {flags.length === 0 && (
                <p className="mt-4 text-sm text-[#949ba4]">Nenhuma defesa configurada no momento. Use os controles abaixo para ajustar cada barreira.</p>
            )}
        </div>
    );
}
