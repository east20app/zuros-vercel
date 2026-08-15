"use client";
import { useMemo } from "react";
import { Badge, DiscordCard } from "./ui";
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

function ShieldIcon({ level }: { level: number }) {
    const color = level >= 80 ? "#23a559" : level >= 50 ? "#f0b232" : level > 0 ? "#f23f43" : "#4e5058";
    return (
        <div className="relative grid h-28 w-28 shrink-0 place-items-center">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-24 w-24 fill-none stroke-current drop-shadow-[0_0_18px_rgba(88,101,242,.5)]" style={{ color }}>
                <path strokeWidth="1.5" d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" />
            </svg>
            <span className="absolute inset-0 grid place-items-center">
                <span className="text-3xl font-black" style={{ color }}>{level}%</span>
            </span>
        </div>
    );
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

    return (
        <DiscordCard title="Escudo de proteção" icon={<Icon name="shield" className="h-4 w-4" />}>
            <div className="flex flex-wrap items-center gap-5">
                <ShieldIcon level={level} />
                <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-[#f2f3f5]">{label}</p>
                    <p className="mt-0.5 text-sm text-[#949ba4]">{active} de {flags.length} defesas ativas no servidor.</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        <Badge tone={activeDefenses > 0 ? "green" : "zinc"}>{activeDefenses} barreiras ligadas</Badge>
                        <Badge tone={antifakeEnabled ? "green" : "zinc"}>Anti-fake {antifakeEnabled ? "ativo" : "inativo"}</Badge>
                        <Badge tone="blue">{authorizedCount} autorizado(s)</Badge>
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
        </DiscordCard>
    );
}
