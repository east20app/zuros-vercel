"use client";
import { useState } from "react";
import { Field, inputClass } from "../ui";
import { Icon, type IconName } from "../Icon";
import type { DiscordGuildChannel, DiscordGuildRole } from "@/lib/actions/bot-config.actions";

type Doc = Record<string, unknown>;
type Aggregate = Record<string, unknown>;

const PUNISHMENTS = [
    { value: "none", label: "Nenhuma (só logs)" },
    { value: "ban", label: "Banimento" },
    { value: "kick", label: "Expulsão" },
    { value: "timeout_30d", label: "Castigo de 30 dias" },
    { value: "remove_roles", label: "Remoção dos cargos" },
    { value: "revert_action", label: "Reversão da ação" },
];

const BARRIERS: { key: string; title: string; description: string; group: "anti-raid" | "privatizacao"; icon: IconName }[] = [
    { key: "banimentos", title: "Banimentos", description: "Pune banimentos em massa no servidor", group: "anti-raid", icon: "shield" },
    { key: "canais", title: "Canais", description: "Monitora criação, edição e exclusão de canais", group: "anti-raid", icon: "settings" },
    { key: "cargos", title: "Cargos", description: "Monitora criação, edição e exclusão de cargos", group: "anti-raid", icon: "user" },
    { key: "comandosExt", title: "Comandos externos", description: "Limita comandos disparados por outros bots", group: "anti-raid", icon: "bot" },
    { key: "expulsoes", title: "Expulsões", description: "Pune expulsões em massa do servidor", group: "anti-raid", icon: "shield" },
    { key: "webhooks", title: "Webhooks", description: "Monitor de criação de webhooks (anti-spam)", group: "anti-raid", icon: "settings" },
    { key: "privatApps", title: "Aplicativos (Apps)", description: "Bloqueia apps que tentam se infiltrar", group: "privatizacao", icon: "bot" },
    { key: "privatCargos", title: "Cargos", description: "Bloqueia atribuição de cargos privados", group: "privatizacao", icon: "user" },
    { key: "privatMencoes", title: "Menções", description: "Bloqueia menções em massa e a cargos proibidos", group: "privatizacao", icon: "bell" },
    { key: "privatPerms", title: "Permissões", description: "Bloqueia concessão de permissões perigosas", group: "privatizacao", icon: "shield" },
    { key: "privatPersistencia", title: "Persistência de canais", description: "Restaura canais e categorias apagadas", group: "privatizacao", icon: "settings" },
    { key: "privatUrls", title: "URLs", description: "Bloqueia envio de links indesejados", group: "privatizacao", icon: "help" },
];

const COMPLEMENTARY = [
    { key: "antifake", title: "Anti-fake", description: "Bloqueia contas recém-criadas", icon: "shield" },
    { key: "interactionMonitor", title: "Monitor de interações", description: "Registra interações suspeitas de membros", icon: "settings" },
] as const;

function asDoc(raw: unknown): Doc {
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Doc) : {};
}
function asList(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
    if (typeof value === "string") return value ? value.split(/[,\s]+/).filter(Boolean) : [];
    return [];
}

function ChoiceChecklist({ items, value, onChange }: { items: Array<{ id: string; name: string }>; value: string[]; onChange: (next: string[]) => void }) {
    const selected = new Set(value);
    return (
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/[.08] bg-[#1e1f22] p-2">
            {items.length ? items.map((item) => {
                const checked = selected.has(item.id);
                return (
                    <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition ${checked ? "bg-[#00CBA4]/20 text-white" : "text-[#b5bac1] hover:bg-[#35373c]"}`}>
                        <input type="checkbox" checked={checked} onChange={() => onChange(checked ? value.filter((id) => id !== item.id) : [...value, item.id])} className="h-4 w-4 accent-[#00CBA4]" />
                        <span className="truncate">{item.name}</span>
                    </label>
                );
            }) : <p className="px-2 py-3 text-xs text-[#949ba4]">Nenhuma opção encontrada no servidor.</p>}
        </div>
    );
}
function str(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
}
function setPath<T extends Record<string, unknown>>(source: T, path: string[], next: unknown): T {
    const clone: Record<string, unknown> = structuredClone(source);
    let cursor: Record<string, unknown> = clone;
    for (const key of path.slice(0, -1)) {
        const child = (cursor[key] as Record<string, unknown> | undefined) ?? {};
        cursor[key] = child;
        cursor = child;
    }
    cursor[path[path.length - 1]] = next;
    return clone as T;
}

function actionEntries(doc: Doc): { key: string; obj: Doc }[] {
    return Object.entries(doc).flatMap(([key, value]) => {
        if (key.toLowerCase().includes("avancado") || key === "config") return [];
        const obj = asDoc(value);
        if (Object.keys(obj).length === 0) return [];
        return [{ key, obj }];
    });
}
function advancedEntry(doc: Doc): { key: string; obj: Doc } | null {
    const entry = Object.entries(doc).find(([key]) => key.toLowerCase().includes("avancado"));
    return entry ? { key: entry[0], obj: asDoc(entry[1]) } : null;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
    return (
        <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/[.08] bg-[#232428] px-3 py-2 text-left transition hover:border-[#00CBA4]/50">
            <span className="min-w-0 text-sm text-[#f2f3f5]">{label}</span>
            <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-[#23a559]" : "bg-[#4e5058]"}`}>
                <i className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-4.5" : "left-0.5"}`} />
            </span>
        </button>
    );
}

function PunishmentSelect({ value, onChange }: { value: string; onChange: (next: string) => void }) {
    return (
        <select aria-label="Punição" className={inputClass} value={PUNISHMENTS.some((p) => p.value === value) ? value : "none"} onChange={(e) => onChange(e.target.value)}>
            {PUNISHMENTS.map((punishment) => (
                <option key={punishment.value} value={punishment.value}>{punishment.label}</option>
            ))}
        </select>
    );
}

function ListField({ label, value, onChange, hint }: { label: string; value: string[]; onChange: (next: string[]) => void; hint?: string }) {
    return (
        <Field label={label} hint={hint}>
            <textarea
                aria-label={label}
                className={`${inputClass} font-mono text-xs`}
                rows={2}
                value={value.join("\n")}
                onChange={(e) => onChange(e.target.value.split("\n").map((item) => item.trim()).filter(Boolean))}
            />
        </Field>
    );
}

function BarrierRow({ alias, data, roles, channels, onChange }: { alias: string; data: Aggregate; roles: DiscordGuildRole[]; channels: DiscordGuildChannel[]; onChange: (next: Aggregate) => void }) {
    const meta = BARRIERS.find((item) => item.key === alias);
    const doc = asDoc(data[alias]);
    const actions = actionEntries(doc);
    const advanced = advancedEntry(doc);
    const activeCount = actions.filter(({ obj }) => Boolean(obj.ativado)).length;
    const fullActive = actions.length > 0 && actions.every(({ obj }) => Boolean(obj.ativado));
    const [open, setOpen] = useState(false);

    const setInDoc = (path: string[], next: unknown) => {
        const nextDoc = setPath(doc, path, next);
        onChange({ ...data, [alias]: nextDoc });
    };

    const toggleAll = (next: boolean) => {
        const nextDoc = structuredClone(doc);
        for (const { key } of actions) {
            if (nextDoc[key] && typeof nextDoc[key] === "object") {
                (nextDoc[key] as Doc).ativado = next;
            }
        }
        onChange({ ...data, [alias]: nextDoc });
    };

    return (
        <article className={`drox-automation-item ${open ? "is-open" : ""}`}>
            <div className="drox-automation-row">
                <button type="button" className="drox-automation-trigger" onClick={() => setOpen(!open)} aria-expanded={open}>
                    <span className={`drox-automation-icon ${fullActive ? "is-active" : ""}`}><Icon name={meta?.icon ?? "shield"} /></span>
                    <span className="drox-automation-copy"><b>{meta?.title ?? alias}</b><small>{fullActive ? "Ativa" : activeCount > 0 ? `${activeCount} ativo(s)` : "Desativada"}</small></span>
                </button>
                <button type="button" className={`drox-automation-chevron ${open ? "is-open" : ""}`} onClick={() => setOpen(!open)} aria-label={`${open ? "Fechar" : "Abrir"} ${meta?.title ?? alias}`}>⌄</button>
                <label className={`drox-switch ${fullActive ? "is-on" : ""}`}><input type="checkbox" checked={fullActive} onChange={(event) => toggleAll(event.target.checked)} aria-label={`${fullActive ? "Desativar" : "Ativar"} ${meta?.title ?? alias}`} /><span /></label>
            </div>
            {open && (
                <div className="drox-automation-details">
                    <p className="drox-automation-details-title">Configuração</p>
                    <div className="space-y-3">
                        {actions.map(({ key, obj }) => {
                            const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
                            const hasLimits = typeof obj.limite === "number" || typeof obj.intervalo === "number";
                            return (
                                <div key={key} className={`rounded-lg border p-3 ${Boolean(obj.ativado) ? "border-[#23a559]/25 bg-[#23a559]/[.05]" : "border-white/[.06] bg-[#1e1f22]"}`}>
                                    <Toggle label={label} checked={Boolean(obj.ativado)} onChange={(next) => setInDoc([key, "ativado"], next)} />
                                    {hasLimits && (
                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            {typeof obj.limite === "number" && (
                                                <label className="block">
                                                    <span className="mb-1 block text-[11px] uppercase tracking-wider text-[#949ba4]">Limite</span>
                                                    <input aria-label={`Limite de ${label}`} type="number" min="1" className={inputClass} value={Number(obj.limite)} onChange={(e) => setInDoc([key, "limite"], Number(e.target.value))} />
                                                </label>
                                            )}
                                            {typeof obj.intervalo === "number" && (
                                                <label className="block">
                                                    <span className="mb-1 block text-[11px] uppercase tracking-wider text-[#949ba4]">Intervalo (min)</span>
                                                    <input aria-label={`Intervalo de ${label}`} type="number" min="1" className={inputClass} value={Number(obj.intervalo)} onChange={(e) => setInDoc([key, "intervalo"], Number(e.target.value))} />
                                                </label>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {advanced && (
                            <div className="grid gap-2 rounded-lg border border-white/[.06] bg-black/20 p-3 sm:grid-cols-2">
                                <label className="block">
                                    <span className="mb-1 block text-[11px] uppercase tracking-wider text-[#949ba4]">Punição</span>
                                    <PunishmentSelect value={str(advanced.obj.punicao, "none")} onChange={(next) => setInDoc([advanced.key, "punicao"], next)} />
                                </label>
                                <label className="block">
                                    <span className="mb-1 block text-[11px] uppercase tracking-wider text-[#949ba4]">Canal de logs</span>
                                    <select aria-label="Canal de logs" className={inputClass} value={str(advanced.obj.canal_logs)} onChange={(e) => setInDoc([advanced.key, "canal_logs"], e.target.value || null)}><option value="">Nenhum canal</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.type === 4 ? "Categoria" : channel.type === 2 || channel.type === 13 ? "Voz" : "#"} {channel.name}</option>)}</select>
                                </label>
                                {Object.keys(advanced.obj).filter((key) => Array.isArray(advanced.obj[key])).map((key) => (
                                    <div key={key} className="sm:col-span-2">
                                        {/cargo|role/i.test(key) ? <Field label={key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())} hint="Clique para marcar os cargos"><ChoiceChecklist items={roles} value={asList(advanced.obj[key])} onChange={(next) => setInDoc([advanced.key, key], next)} /></Field> : /canal|channel|categoria/i.test(key) ? <Field label={key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())} hint="Clique para marcar os canais"><ChoiceChecklist items={channels.map((channel) => ({ id: channel.id, name: `${channel.type === 4 ? "Categoria" : channel.type === 2 || channel.type === 13 ? "Voz" : "#"} ${channel.name}` }))} value={asList(advanced.obj[key])} onChange={(next) => setInDoc([advanced.key, key], next)} /></Field> : <ListField label={key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())} hint="Um item por linha" value={asList(advanced.obj[key])} onChange={(next) => setInDoc([advanced.key, key], next)} />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </article>
    );
}

function ComplementaryRow({ item, value, onChange }: { item: { key: string; title: string; description: string; icon: IconName }; value: Aggregate; onChange: (next: Aggregate) => void }) {
    const doc = asDoc(value[item.key]);
    const [open, setOpen] = useState(false);
    const active = Boolean(doc.enabled);

    const toggleActive = (next: boolean) => {
        onChange({ ...value, [item.key]: { ...doc, enabled: next } });
    };

    return (
        <article className={`drox-automation-item ${open ? "is-open" : ""}`}>
            <div className="drox-automation-row">
                <button type="button" className="drox-automation-trigger" onClick={() => setOpen(!open)} aria-expanded={open}>
                    <span className={`drox-automation-icon ${active ? "is-active" : ""}`}><Icon name={item.icon} /></span>
                    <span className="drox-automation-copy"><b>{item.title}</b><small>{active ? "Ativa" : "Desativada"}</small></span>
                </button>
                <button type="button" className={`drox-automation-chevron ${open ? "is-open" : ""}`} onClick={() => setOpen(!open)} aria-label={`${open ? "Fechar" : "Abrir"} ${item.title}`}>⌄</button>
                <label className={`drox-switch ${active ? "is-on" : ""}`}><input type="checkbox" checked={active} onChange={(event) => toggleActive(event.target.checked)} aria-label={`${active ? "Desativar" : "Ativar"} ${item.title}`} /><span /></label>
            </div>
            {open && (
                <div className="drox-automation-details">
                    <p className="drox-automation-details-title">Configuração</p>
                    {item.key === "antifake" ? (
                        <div className="space-y-3">
                            <label className="block">
                                <span className="mb-1 block text-[11px] uppercase tracking-wider text-[#949ba4]">Idade mínima (dias)</span>
                                <input aria-label="Idade mínima" type="number" min="0" className={inputClass} value={Number(doc.min_days ?? 0)} onChange={(e) => onChange({ ...value, [item.key]: { ...doc, min_days: Number(e.target.value) } })} />
                            </label>
                            <Toggle label="Bloquear bots" checked={Boolean(doc.block_bots)} onChange={(next) => onChange({ ...value, [item.key]: { ...doc, block_bots: next } })} />
                        </div>
                    ) : (
                        <p className="text-sm text-[#949ba4]">Configuração do monitor de interações sincronizada com o módulo do DROX.</p>
                    )}
                </div>
            )}
        </article>
    );
}

export function ProtectionEditor({ value, roles = [], channels = [], onChange }: { value: Aggregate; roles?: DiscordGuildRole[]; channels?: DiscordGuildChannel[]; onChange: (next: Aggregate) => void }) {
    return (
        <div className="drox-automations-ui space-y-6">
            <section className="drox-automation-group"><h3>Anti-raid</h3><div className="drox-automation-card">
                {BARRIERS.filter((item) => item.group === "anti-raid").map((item) => (
                    <BarrierRow key={item.key} alias={item.key} data={value} roles={roles} channels={channels} onChange={onChange} />
                ))}
            </div></section>

            <section className="drox-automation-group"><h3>Privatizações</h3><div className="drox-automation-card">
                {BARRIERS.filter((item) => item.group === "privatizacao").map((item) => (
                    <BarrierRow key={item.key} alias={item.key} data={value} roles={roles} channels={channels} onChange={onChange} />
                ))}
            </div></section>

            <section className="drox-automation-group"><h3>Barreiras complementares</h3><div className="drox-automation-card">
                {COMPLEMENTARY.map((item) => (
                    <ComplementaryRow key={item.key} item={item} value={value} onChange={onChange} />
                ))}
            </div></section>
        </div>
    );
}
