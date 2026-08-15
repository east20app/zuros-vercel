"use client";
import { useState, useTransition } from "react";
import { publishProductToDiscord } from "@/lib/actions/admin.actions";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "./Toast";
import { Button, Field, inputClass, Modal } from "./ui";
export function PublishProductButton({ productId }: { productId: string }) { const [open,setOpen]=useState(false); const [channel,setChannel]=useState(""); const [pending,startTransition]=useTransition(); const {push}=useToast(); return <><Button size="sm" variant="success" onClick={()=>setOpen(true)}>Publicar no Discord</Button><Modal open={open} onClose={()=>setOpen(false)} title="Publicar produto"><form className="space-y-4" onSubmit={(event)=>{event.preventDefault();startTransition(async()=>{try{await publishProductToDiscord(productId,channel);push("Produto publicado no Discord.");setOpen(false);}catch(error){push(getErrorMessage(error,"Não foi possível publicar."),"error");}});}}><Field label="ID do canal Discord"><input className={inputClass} value={channel} onChange={(event)=>setChannel(event.target.value)} required /></Field><Button type="submit" disabled={pending}>Publicar mensagem</Button></form></Modal></>; }
