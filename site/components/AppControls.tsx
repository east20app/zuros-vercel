"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    startApp,
    stopApp,
    restartApp,
    changeAppName,
    changeAppToken,
    changeAppMainServer,
    listBotGuilds,
    type BotGuildOption,
} from "@/lib/actions/apps.actions";
import { getErrorMessage } from "@/lib/errors";
import { Button, ConfirmDialog, Field, inputClass, Modal, Spinner } from "./ui";
import { useToast } from "./Toast";
import type { AppStatus } from "@/lib/types";

export function AppControls({ appId, botId, status, online }: { appId: string; botId: string; status: AppStatus; online: boolean }) {
    const router = useRouter();
    const { push } = useToast();
    const [busy, setBusy] = useState<string | null>(null);
    const [renameOpen, setRenameOpen] = useState(false);
    const [tokenOpen, setTokenOpen] = useState(false);
    const [serverOpen, setServerOpen] = useState(false);
    const [stopConfirming, setStopConfirming] = useState(false);
    const [nameValue, setNameValue] = useState("");
    const [tokenValue, setTokenValue] = useState("");
    const [serverValue, setServerValue] = useState("");
    const [guilds, setGuilds] = useState<BotGuildOption[]>([]);

    const SUCCESS_MESSAGES: Record<string, string> = {
        start: "Bot iniciado com sucesso.",
        restart: "Bot reiniciado com sucesso.",
        stop: "Bot parado.",
        rename: "Nome do bot atualizado.",
        token: "Token do bot atualizado.",
        server: "Servidor principal atualizado.",
    };

    async function run(action: string, fn: () => Promise<unknown>) {
        setBusy(action);
        try {
            const result = await fn();
            if (result && typeof result === "object" && "ok" in result && result.ok === false && "error" in result) throw new Error(String(result.error));
            push(SUCCESS_MESSAGES[action] || "Operação realizada com sucesso.");
            router.refresh();
            return result ?? true;
        } catch (e) {
            push(getErrorMessage(e, "Erro ao executar operação."), "error");
            return null;
        } finally {
            setBusy(null);
        }
    }

    return (
        <>
            {status !== "active" && <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-200"><p className="font-semibold">Controles pausados durante a carência</p><p className="mt-1 text-xs text-amber-200/75">Renove a aplicação para voltar a iniciar, parar ou reiniciar o bot.</p><Button href="/dashboard/invoices" size="sm" className="mt-3">Ver renovação</Button></div>}
            <div className="flex flex-wrap gap-2">
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
                <Button
                    variant="outline"
                    onClick={() => {
                        setNameValue("");
                        setRenameOpen(true);
                    }}
                >
                    Renomear
                </Button>
                <Button
                    variant="outline"
                    onClick={() => {
                        setTokenValue("");
                        setTokenOpen(true);
                    }}
                >
                    Alterar Token
                </Button>
                <Button
                    variant="outline"
                    disabled={!!busy}
                    onClick={() => {
                        setBusy("guilds");
                        listBotGuilds(appId)
                            .then((items) => {
                                setGuilds(items);
                                setServerValue(items[0]?.id || "");
                                setServerOpen(true);
                            })
                            .catch((e) => push(getErrorMessage(e, "Erro ao listar servidores."), "error"))
                            .finally(() => setBusy(null));
                    }}
                >
                    {busy === "guilds" ? <Spinner /> : null}
                    Servidor principal
                </Button>
                {botId ? <a className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white" href={`https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(botId)}&permissions=8&scope=bot%20applications.commands`} target="_blank" rel="noreferrer">Adicionar ao servidor</a> : null}
            </div>

            <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Alterar nome">
                <form
                    className="flex flex-col gap-4"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        if (await run("rename", () => changeAppName(appId, nameValue))) setRenameOpen(false);
                    }}
                >
                    <Field label="Novo nome">
                        <input
                            className={inputClass}
                            value={nameValue}
                            onChange={(e) => setNameValue(e.target.value)}
                            placeholder="Nome da aplicação"
                            maxLength={40}
                            required
                        />
                    </Field>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setRenameOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={!!busy}>
                            Salvar
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal open={serverOpen} onClose={() => setServerOpen(false)} title="Servidor principal">
                <form
                    className="flex flex-col gap-4"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        if (await run("server", () => changeAppMainServer(appId, serverValue))) setServerOpen(false);
                    }}
                >
                    <Field label="Servidor Discord" hint="O bot precisa participar do servidor selecionado.">
                        <select
                            className={inputClass}
                            value={serverValue}
                            onChange={(e) => setServerValue(e.target.value)}
                            required
                        >
                            {guilds.length === 0 ? <option value="">Nenhum servidor encontrado</option> : null}
                            {guilds.map((guild) => (
                                <option key={guild.id} value={guild.id}>{guild.name} ({guild.id})</option>
                            ))}
                        </select>
                    </Field>
                    <p className="text-xs text-amber-300">
                        A configuração será aplicada à hospedagem e a aplicação será reiniciada se estiver online.
                    </p>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setServerOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={!!busy || !serverValue}>
                            {busy === "server" ? <Spinner /> : null}
                            Aplicar
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal open={tokenOpen} onClose={() => setTokenOpen(false)} title="Alterar token do bot">
                <form
                    className="flex flex-col gap-4"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        const result = await run("token", () => changeAppToken(appId, tokenValue));
                        if (result) {
                            setTokenOpen(false);
                            if (typeof result === "object" && "botId" in result && typeof result.botId === "string") {
                                router.replace(`/dashboard/${result.botId}`);
                            }
                        }
                    }}
                >
                    <Field label="Novo token" hint="O bot será repaginado com o novo token automaticamente.">
                        <input
                            className={inputClass}
                            value={tokenValue}
                            onChange={(e) => setTokenValue(e.target.value)}
                            placeholder="Token do bot Discord"
                            required
                        />
                    </Field>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setTokenOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={!!busy}>
                            {busy === "token" ? <Spinner /> : null}
                            Alterar
                        </Button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog
                open={stopConfirming}
                title="Parar aplicação"
                message="Tem certeza que deseja parar esta aplicação? Ela ficará offline até ser iniciada novamente."
                confirmLabel="Parar"
                danger
                busy={busy === "stop"}
                onCancel={() => setStopConfirming(false)}
                onConfirm={() => {
                    run("stop", () => stopApp(appId));
                    setStopConfirming(false);
                }}
            />
        </>
    );
}
