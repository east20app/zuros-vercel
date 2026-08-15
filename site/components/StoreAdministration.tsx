"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteStore, removeStorePermission, saveStorePermission, updateStoreAdministration, type StoreAdministrationView } from "@/lib/actions/admin.actions";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "./Toast";
import { Button, Card, Field, inputClass } from "./ui";

const permissionOptions = [
    ["admin", "Administrador"], ["manage-products", "Gerenciar produtos"], ["manage-sales", "Gerenciar vendas"],
    ["manage-logs", "Gerenciar logs"], ["delete-application", "Excluir aplicações"],
    ["toggle-application", "Controlar aplicações"], ["transfer-application-ownership", "Transferir aplicações"],
    ["change-application-duration", "Alterar vencimento"], ["see-balance", "Ver saldo"],
] as const;

export function StoreAdministration({ store }: { store: StoreAdministrationView }) {
    const router = useRouter(); const { push } = useToast(); const [pending, startTransition] = useTransition();
    const [name, setName] = useState(store.name); const [logs, setLogs] = useState(store.logsAndRoles);
    const [userId, setUserId] = useState(""); const [permissions, setPermissions] = useState<string[]>(["admin"]);
    const [confirmation, setConfirmation] = useState("");
    const run = (fn: () => Promise<unknown>, message: string) => startTransition(async () => { try { await fn(); push(message); router.refresh(); } catch (error) { push(getErrorMessage(error, "Não foi possível salvar."), "error"); } });
    const setLog = (key: keyof typeof logs, value: string) => setLogs((current) => ({ ...current, [key]: value }));

    return <div className="space-y-6">
        <Card><h2 className="mb-4 font-semibold text-white">Dados e notificações da loja</h2><div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome da loja"><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="Canal de vendas"><input className={inputClass} value={logs.sales} onChange={(event) => setLog("sales", event.target.value)} placeholder="ID do canal Discord" /></Field>
            <Field label="Canal de renovações"><input className={inputClass} value={logs.renovations} onChange={(event) => setLog("renovations", event.target.value)} placeholder="ID do canal Discord" /></Field>
            <Field label="Canal de transferências"><input className={inputClass} value={logs.transferOwnership} onChange={(event) => setLog("transferOwnership", event.target.value)} placeholder="ID do canal Discord" /></Field>
            <Field label="Canal de aplicações expiradas"><input className={inputClass} value={logs.expiredApplication} onChange={(event) => setLog("expiredApplication", event.target.value)} placeholder="ID do canal Discord" /></Field>
            <Field label="Cargo de cliente"><input className={inputClass} value={logs.customerRole} onChange={(event) => setLog("customerRole", event.target.value)} placeholder="ID do cargo Discord" /></Field>
        </div><Button className="mt-4" disabled={pending} onClick={() => run(() => updateStoreAdministration(store.id, { name, logsAndRoles: logs }), "Configurações salvas.")}>Salvar configurações</Button></Card>

        <Card><h2 className="font-semibold text-white">Equipe e permissões</h2><p className="mt-1 text-sm text-zinc-500">Autorize outros usuários do Discord a administrar partes da loja.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto]"><input aria-label="ID do usuário Discord" className={inputClass} value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="ID do usuário Discord" /><div className="flex flex-wrap gap-2">{permissionOptions.map(([value, label]) => <label key={value} className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-2 text-xs text-zinc-300"><input type="checkbox" checked={permissions.includes(value)} onChange={() => setPermissions((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])} />{label}</label>)}</div><Button disabled={pending || !userId} onClick={() => run(() => saveStorePermission(store.id, userId, permissions), "Permissões salvas.")}>Adicionar</Button></div>
            <div className="mt-4 space-y-2">{store.permissions.map((entry) => <div key={entry.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black/20 p-3"><div><p className="text-sm text-white">{entry.userId}</p><p className="text-xs text-zinc-500">{entry.permissions.join(", ") || "Sem permissões"}</p></div><Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => removeStorePermission(store.id, entry.userId), "Acesso removido.")}>Remover</Button></div>)}</div>
        </Card>

        <Card className="border-red-500/20"><h2 className="font-semibold text-red-300">Excluir loja</h2><p className="mt-1 text-sm text-zinc-500">Só é possível excluir uma loja sem aplicações. Digite <strong>{store.name}</strong> para confirmar.</p><div className="mt-4 flex gap-2"><input className={inputClass} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /><Button variant="danger" disabled={pending || confirmation !== store.name} onClick={() => run(async () => { await deleteStore(store.id, confirmation); router.push("/admin"); }, "Loja excluída.")}>Excluir definitivamente</Button></div></Card>
    </div>;
}
