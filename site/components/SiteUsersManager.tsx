"use client";
/* eslint-disable @next/next/no-img-element -- avatar remoto do Discord já vem dimensionado */

import { useState, useTransition } from "react";
import { addSiteUserToServer, listBotServers } from "@/lib/actions/site-users.actions";

type User = {
    id: string; name: string; username: string; globalName: string; discriminator: string; email: string; image: string;
    avatarHash: string; bannerHash: string; accentColor: number; locale: string; emailVerified: boolean; mfaEnabled: boolean;
    premiumType: number; flags: number; publicFlags: number; authorized: boolean; tokenExpiresAt: string;
    firstLoginAt: string; lastLoginAt: string; loginCount: number;
    guilds: Array<{ id: string; name: string; icon?: string; owner?: boolean; permissions?: string; features?: string[] }>;
};
type App = { id: string; name: string; botId: string };

export function SiteUsersManager({ users, applications }: { users: User[]; applications: App[] }) {
    const [appId, setAppId] = useState("");
    const [guildId, setGuildId] = useState("");
    const [guilds, setGuilds] = useState<Array<{ id: string; name: string }>>([]);
    const [message, setMessage] = useState("");
    const [pending, startTransition] = useTransition();

    function selectApp(value: string) {
        setAppId(value); setGuildId(""); setGuilds([]); setMessage("");
        if (!value) return;
        startTransition(async () => {
            const result = await listBotServers(value);
            if (result.ok) setGuilds(result.data); else setMessage(result.error);
        });
    }

    function addUser(userId: string) {
        if (!appId || !guildId) return setMessage("Selecione o bot e o servidor.");
        setMessage("");
        startTransition(async () => {
            const result = await addSiteUserToServer({ userId, appId, guildId });
            setMessage(result.ok ? "Usuário adicionado ao servidor." : result.error);
        });
    }

    return <div className="space-y-5">
        <div className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 sm:grid-cols-2">
            <label className="text-sm text-zinc-300">Bot
                <select value={appId} onChange={(event) => selectApp(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-black p-2.5 text-white">
                    <option value="">Selecione um bot</option>{applications.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
                </select>
            </label>
            <label className="text-sm text-zinc-300">Servidor
                <select value={guildId} onChange={(event) => setGuildId(event.target.value)} disabled={!appId || pending} className="mt-1 w-full rounded-lg border border-zinc-700 bg-black p-2.5 text-white disabled:opacity-50">
                    <option value="">{pending ? "Carregando..." : "Selecione um servidor"}</option>{guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}
                </select>
            </label>
        </div>
        {message ? <p role="status" className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-200">{message}</p> : null}
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm"><thead className="bg-zinc-950 text-zinc-500"><tr><th className="p-3">Usuário</th><th className="p-3">Entradas</th><th className="p-3">Discord</th><th className="p-3">Autorização</th><th className="p-3">Ação</th></tr></thead>
                <tbody>{users.map((user) => <tr key={user.id} className="border-t border-zinc-800 align-top text-zinc-300"><td className="p-3"><div className="flex items-center gap-3">{user.image ? <img src={user.image} alt="" className="h-10 w-10 rounded-full" /> : null}<div><b className="text-white">{user.globalName || user.name}</b><div className="text-xs text-zinc-500">@{user.username || user.name} · {user.id}</div><div className="text-xs text-zinc-500">{user.email || "E-mail não informado"} {user.emailVerified ? "✓" : ""}</div></div></div><details className="mt-3 text-xs"><summary className="cursor-pointer text-emerald-400">Ver todas as informações</summary><div className="mt-2 grid gap-1 rounded-lg bg-black/40 p-3 text-zinc-400"><span>Idioma: {user.locale || "não informado"}</span><span>MFA: {user.mfaEnabled ? "ativado" : "não informado/desativado"}</span><span>Nitro: {user.premiumType || "não"}</span><span>Flags: {user.flags} / públicas: {user.publicFlags}</span><span>Avatar: {user.avatarHash || "sem hash"}</span><span>Banner: {user.bannerHash || "não informado"}</span><span>Cor: {user.accentColor || "não informada"}</span><span>Servidores visíveis: {user.guilds.length}</span>{user.guilds.length ? <span className="mt-1 text-zinc-300">{user.guilds.map((guild) => guild.name).join(", ")}</span> : null}</div></details></td><td className="p-3"><b className="text-white">{user.loginCount}</b><div className="mt-1 text-xs text-zinc-500">Primeira: {new Date(user.firstLoginAt).toLocaleString("pt-BR")}</div><div className="text-xs text-zinc-500">Última: {new Date(user.lastLoginAt).toLocaleString("pt-BR")}</div></td><td className="p-3">{user.guilds.length} servidores<div className="mt-1 text-xs text-zinc-500">Nitro: {user.premiumType || "não"}</div></td><td className="p-3">{user.authorized ? <span className="text-emerald-400">Autorizado</span> : <span className="text-amber-400">Precisa entrar novamente</span>}<div className="mt-1 text-xs text-zinc-500">{user.tokenExpiresAt ? `Expira ${new Date(user.tokenExpiresAt).toLocaleString("pt-BR")}` : "Sem validade registrada"}</div></td><td className="p-3"><button type="button" onClick={() => addUser(user.id)} disabled={pending || !user.authorized || !guildId} className="rounded-lg bg-emerald-500 px-3 py-2 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">Adicionar</button></td></tr>)}</tbody>
            </table>
        </div>
    </div>;
}
