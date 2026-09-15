"use client";

import { useState } from "react";
import { changeAppName, changeAppToken } from "@/lib/actions/apps.actions";
import { getErrorMessage } from "@/lib/errors";
import { Button, Card, Field, inputClass } from "./ui";
import { useToast } from "./Toast";

export function AppIdentityPanel({ appId, currentName, botId }: { appId: string; currentName: string; botId: string }) {
    const { push } = useToast();
    const [name, setName] = useState(currentName);
    const [token, setToken] = useState("");
    const [savingName, setSavingName] = useState(false);
    const [savingToken, setSavingToken] = useState(false);

    async function saveName() {
        setSavingName(true);
        try {
            await changeAppName(appId, name);
            push("Nome da aplicação atualizado.", "success");
        } catch (error) {
            push(getErrorMessage(error, "Não foi possível atualizar o nome."), "error");
        } finally { setSavingName(false); }
    }

    async function saveToken() {
        if (!token.trim()) { push("Informe o novo token.", "error"); return; }
        if (!window.confirm("O token atual será substituído e o bot poderá reiniciar. Deseja continuar?")) return;
        setSavingToken(true);
        try {
            const result = await changeAppToken(appId, token.trim());
            setToken("");
            push(`Token atualizado. Bot vinculado: ${result.botId}.`, "success");
        } catch (error) {
            push(getErrorMessage(error, "Não foi possível atualizar o token."), "error");
        } finally { setSavingToken(false); }
    }

    return <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-4">
            <div><h2 className="text-base font-semibold text-white">Identidade da aplicação</h2><p className="mt-1 text-xs text-zinc-500">Altere os dados públicos do bot sem expor credenciais.</p></div>
            <Field label="Nome exibido"><input className={inputClass} maxLength={40} value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Button onClick={() => void saveName()} disabled={savingName || !name.trim() || name.trim() === currentName}>{savingName ? "Salvando..." : "Salvar nome"}</Button>
        </Card>
        <Card className="space-y-4">
            <div><h2 className="text-base font-semibold text-white">Token do bot</h2><p className="mt-1 text-xs text-amber-200/70">O token nunca é exibido. Informe um novo token somente quando for necessário.</p></div>
            <p className="rounded-lg border border-white/[.08] bg-white/[.03] px-3 py-2 text-xs text-zinc-400">Bot atual: <strong className="text-zinc-200">{botId || "não vinculado"}</strong></p>
            <Field label="Novo token"><input className={inputClass} type="password" autoComplete="new-password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Cole o novo token do Discord" /></Field>
            <Button variant="danger" onClick={() => void saveToken()} disabled={savingToken || !token.trim()}>{savingToken ? "Atualizando..." : "Substituir token"}</Button>
        </Card>
    </div>;
}

export default AppIdentityPanel;
