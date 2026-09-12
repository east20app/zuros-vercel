"use client";

import { useMemo, useState } from "react";
import {
    createBotBackup,
    deleteBotBackup,
    getBotBackups,
    restoreBotBackup,
    saveBotBackupAuto,
    type BackupAutoConfig,
    type BackupEntry,
} from "@/lib/actions/backups.actions";
import { Card, Empty, Spinner } from "./ui";

const EXCLUDE_OPTIONS = [
    ["channels", "Canais"],
    ["categories", "Categorias"],
    ["roles", "Cargos"],
    ["members", "Membros"],
    ["emojis", "Emojis"],
    ["stickers", "Figurinhas"],
    ["messages", "Mensagens"],
] as const;

const WIPE_OPTIONS = [
    ["none", "Não apagar nada"],
    ["all", "Apagar tudo"],
    ["channels,roles,emojis,stickers", "Selecionar... (canais, cargos, emojis, figurinhas)"],
] as const;

function fmtDate(ts: number | null) {
    if (!ts) return "—";
    return new Date(ts * 1000).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function BackupsPanel({ appId, initial, auto: initialAuto }: { appId: string; initial: BackupEntry[]; auto: BackupAutoConfig }) {
    const [backups, setBackups] = useState<BackupEntry[]>(initial);
    const [auto, setAuto] = useState<BackupAutoConfig>(initialAuto);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [restoreState, setRestoreState] = useState<{ arquivo: string; tipos: string; guild_id: string } | null>(null);

    function notify(text: string) {
        setMessage(text);
        setTimeout(() => setMessage(null), 5000);
    }

    async function run(fn: () => Promise<unknown>, ok: string) {
        setBusy(true);
        try {
            await fn();
            notify(ok);
            const data = await getBotBackups(appId);
            setBackups(data.backups);
            setAuto(data.auto);
        } catch (error) {
            notify(error instanceof Error ? error.message : "Falha ao executar ação.");
        } finally {
            setBusy(false);
        }
    }

    const toggles = useMemo(() => {
        const set = new Set(auto.backup_auto_exclude);
        return EXCLUDE_OPTIONS.map(([value, label]) => ({ value, label, checked: set.has(value) }));
    }, [auto.backup_auto_exclude]);

    function toggleExclude(value: string) {
        const set = new Set(auto.backup_auto_exclude);
        if (set.has(value)) set.delete(value); else set.add(value);
        const next = { ...auto, backup_auto_exclude: Array.from(set) };
        setAuto(next);
        run(() => saveBotBackupAuto(appId, next), "Configuração do backup automático salva.");
    }

    return (
        <div className="flex flex-col gap-6">
            {busy && <div className="flex items-center gap-2 text-xs text-zinc-400"><Spinner /> Processando requisição...</div>}
            {message && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-300">{message}</div>}

            <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-semibold text-white">Backup Automático</h3>
                        <p className="mt-0.5 text-xs text-zinc-500">
                            {auto.backup_auto_ativo ? `Ativado (a cada ${auto.backup_auto_minutos} min)` : "Desativado"} · atualizado pelo bot no servidor principal
                        </p>
                    </div>
                    <button
                        type="button"
                        className="rounded-lg bg-[#3b82f6] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2563eb] disabled:opacity-50"
                        disabled={busy}
                        onClick={() => run(() => saveBotBackupAuto(appId, { ...auto, backup_auto_ativo: !auto.backup_auto_ativo }), "Status do backup automático atualizado.")}
                    >
                        {auto.backup_auto_ativo ? "Desativar" : "Ativar"}
                    </button>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-zinc-400">Tempo entre backups (minutos)</span>
                        <input
                            type="number"
                            min={1}
                            max={2880}
                            className="rounded-lg border border-white/[.08] bg-[#232428]/80 px-3 py-2 text-sm text-white outline-none focus:border-[#3b82f6]"
                            value={auto.backup_auto_minutos}
                            onChange={(e) => setAuto({ ...auto, backup_auto_minutos: Number(e.target.value) })}
                        />
                    </label>
                    <div className="flex items-end">
                        <button
                            type="button"
                            className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/[.05] disabled:opacity-50"
                            disabled={busy}
                            onClick={() => run(() => saveBotBackupAuto(appId, auto), "Configuração do backup automático salva.")}
                        >
                            Salvar tempo
                        </button>
                    </div>
                </div>

                <div className="mt-4">
                    <p className="text-xs font-medium text-zinc-400">O que NÃO incluir no backup</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {toggles.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                    opt.checked ? "border-[#3b82f6] bg-[#3b82f6]/15 text-[#bfdbfe]" : "border-white/10 text-zinc-500 hover:bg-white/[.05] hover:text-white"
                                }`}
                                disabled={busy}
                                onClick={() => toggleExclude(opt.value)}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </Card>

            <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-semibold text-white">Backups do servidor</h3>
                        <p className="mt-0.5 text-xs text-zinc-500">Criados pelo bot em {backups.length ? backups[0].guild : "—"} e espelhados para o painel.</p>
                    </div>
                    <button
                        type="button"
                        className="rounded-lg bg-[#3b82f6] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2563eb] disabled:opacity-50"
                        disabled={busy}
                        onClick={() => run(() => createBotBackup(appId), "Backup solicitado. O bot cria na próxima checagem da fila.")}
                    >
                        Criar um novo Backup
                    </button>
                </div>

                {restoreState && (
                    <div className="mt-4 rounded-xl border border-white/[.08] bg-[#232428]/80 p-4">
                        <p className="text-xs font-medium text-zinc-400">Restaurar <code className="text-zinc-200">{restoreState.arquivo}</code></p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            <select
                                className="rounded-lg border border-white/[.08] bg-[#232428]/80 px-3 py-2 text-sm text-white outline-none focus:border-[#3b82f6]"
                                value={restoreState.tipos}
                                onChange={(e) => setRestoreState({ ...restoreState, tipos: e.target.value })}
                            >
                                {WIPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                            <input
                                type="text"
                                placeholder="ID do servidor alvo (opcional)"
                                className="rounded-lg border border-white/[.08] bg-[#232428]/80 px-3 py-2 text-sm text-white outline-none focus:border-[#3b82f6]"
                                value={restoreState.guild_id}
                                onChange={(e) => setRestoreState({ ...restoreState, guild_id: e.target.value })}
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                                    disabled={busy}
                                    onClick={() => {
                                        const { arquivo, tipos, guild_id } = restoreState;
                                        const wipeWarning = tipos !== "none" ? " A opção selecionada apagará dados do servidor antes da restauração." : "";
                                        if (!window.confirm(`Restaurar o backup ${arquivo}?${wipeWarning} Esta ação altera o servidor Discord real.`)) return;
                                        setRestoreState(null);
                                        run(() => restoreBotBackup(appId, arquivo, tipos, guild_id || undefined), "Restauração solicitada. O bot executa na próxima checagem da fila.");
                                    }}
                                >
                                    Restaurar
                                </button>
                                <button
                                    type="button"
                                    className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:bg-white/[.05]"
                                    onClick={() => setRestoreState(null)}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {backups.length === 0 ? (
                    <div className="mt-4"><Empty text="Nenhum backup encontrado. Crie um backup para começar." /></div>
                ) : (
                    <div className="mt-4 overflow-hidden rounded-xl border border-white/[.06]">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-xs uppercase tracking-wide text-zinc-500">
                                    <th className="p-3">Arquivo</th>
                                    <th className="p-3">Data</th>
                                    <th className="p-3">Estrutura</th>
                                    <th className="p-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {backups.map((b) => (
                                    <tr key={b.arquivo} className="border-b border-white/[.04] last:border-0 hover:bg-white/[.02]">
                                        <td className="p-3">
                                            <code className="break-all text-xs text-[#bfdbfe]">{b.arquivo.replace(".json", "")}</code>
                                            <span className="block text-[10px] text-zinc-500">{b.guild}</span>
                                        </td>
                                        <td className="p-3 text-xs text-zinc-400">{fmtDate(b.timestamp)}</td>
                                        <td className="p-3 text-[11px] text-zinc-500">
                                            Canais {b.canais} · Categorias {b.categorias} · Cargos {b.cargos} · Emojis {b.emojis} · Fig. {b.stickers} · Membros {b.membros} · Msgs {b.mensagens}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    className="rounded-md bg-emerald-600/90 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                                                    disabled={busy}
                                                    onClick={() => setRestoreState({ arquivo: b.arquivo, tipos: "none", guild_id: "" })}
                                                >
                                                    Restaurar
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rounded-md bg-red-600/90 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
                                                    disabled={busy}
                                                    onClick={() => {
                                                        if (window.confirm(`Apagar o backup ${b.arquivo}? Esta ação não pode ser desfeita.`)) void run(() => deleteBotBackup(appId, b.arquivo), "Backup apagado.");
                                                    }}
                                                >
                                                    Apagar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
