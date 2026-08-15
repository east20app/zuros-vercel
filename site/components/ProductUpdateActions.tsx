"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { retryProductUpdates } from "@/lib/actions/admin.actions";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "./Toast";
import { Button } from "./ui";
export function ProductUpdateActions({ productId, productName, pendingCount, errorCount }: { productId:string; productName:string; pendingCount:number; errorCount:number }) { const [pending,startTransition]=useTransition();const router=useRouter();const{push}=useToast();function report(){const text=[`Status de atualização — ${productName}`,`Aguardando: ${pendingCount}`,`Com erro: ${errorCount}`,`Gerado em: ${new Date().toLocaleString("pt-BR")}`].join("\n");const url=URL.createObjectURL(new Blob([text],{type:"text/plain"}));const link=document.createElement("a");link.href=url;link.download=`status-${productName}.txt`;link.click();URL.revokeObjectURL(url);}return <><Button size="sm" variant="outline" onClick={report}>Baixar status</Button>{errorCount>0?<Button size="sm" disabled={pending} onClick={()=>startTransition(async()=>{try{const result=await retryProductUpdates(productId);push(`${result.count} aplicação(ões) preparada(s) para nova tentativa.`);router.refresh();}catch(error){push(getErrorMessage(error,"Não foi possível repetir as atualizações."),"error");}})}>Repetir atualizações com erro</Button>:null}</>; }
