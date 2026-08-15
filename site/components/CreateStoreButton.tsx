"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStore } from "@/lib/actions/admin.actions";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "./Toast";
import { Button, Field, inputClass, Modal } from "./ui";

export function CreateStoreButton() {
    const [open, setOpen] = useState(false); const [name, setName] = useState(""); const [pending, startTransition] = useTransition();
    const router = useRouter(); const { push } = useToast();
    return <><Button onClick={() => setOpen(true)}>Nova loja</Button><Modal open={open} onClose={() => setOpen(false)} title="Criar loja"><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); startTransition(async () => { try { const store = await createStore(name); push("Loja criada."); setOpen(false); router.push(`/admin/${store.id}`); } catch (error) { push(getErrorMessage(error, "Não foi possível criar a loja."), "error"); } }); }}><Field label="Nome da loja"><input autoFocus className={inputClass} value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required /></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={pending}>Criar loja</Button></div></form></Modal></>;
}
