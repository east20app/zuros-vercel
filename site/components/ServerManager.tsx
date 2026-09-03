"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeAppMainServer, type BotGuildOption } from "@/lib/actions/apps.actions";
import { getErrorMessage } from "@/lib/errors";
import { Button, Spinner } from "./ui";
import { useToast } from "./Toast";

export function ServerManager({ appId, botId, guilds }: { appId: string; botId: string; guilds: BotGuildOption[] }) {
    const router = useRouter();
    const { push } = useToast();
    const [serverId, setServerId] = useState(guilds[0]?.id || "");
    const [saving, setSaving] = useState(false);
    const inviteUrl = botId ? `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(botId)}&permissions=0&scope=bot%20applications.commands` : "";

    async function save() {
        if (!serverId) return;
        setSaving(true);
        try {
            await changeAppMainServer(appId, serverId);
            push("Servidor principal atualizado. As configurações do painel serão enviadas somente para ele.");
            router.refresh();
        } catch (error) {
            push(getErrorMessage(error, "Não foi possível selecionar o servidor principal."), "error");
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="zuros-card mb-6 grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="min-w-0">
                <label htmlFor="main-server" className="mb-2 block text-sm font-semibold text-white">Servidor principal</label>
                <p className="mb-3 text-xs text-zinc-500">O painel, a loja e as automações usam somente o servidor principal selecionado.</p>
                <select id="main-server" value={serverId} onChange={(event) => setServerId(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-base text-zinc-200 outline-none focus:border-[var(--accent)]" disabled={!guilds.length}>
                    {!guilds.length ? <option value="">Adicione o bot a um servidor</option> : null}
                    {guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}
                </select>
            </div>
            <div className="grid grid-cols-2 gap-2 md:flex">
                {inviteUrl ? <a href={inviteUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/[.06] px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/[.1]">Adicionar bot</a> : null}
                <Button onClick={() => void save()} disabled={!serverId || saving}>{saving ? <Spinner /> : null}Selecionar</Button>
            </div>
        </section>
    );
}