"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sharpifyGetPayment, sharpifyGetWithdraw, sharpifyRefundPayment, sharpifyRequestWithdraw } from "@/lib/actions/sharpify.actions";
import { Button, Field, inputClass, Spinner } from "./ui";
import { useToast } from "./Toast";
import { getErrorMessage } from "@/lib/errors";

type DashboardData = { withdrawData: Record<string, unknown> | null; events: Array<{ id: string; webhookId: string; name: string; context: string; contextId: string; occurredAt: string }> };

export function SharpifyDashboard({ data }: { data: DashboardData }) {
    const router = useRouter(); const { push } = useToast();
    const [busy, setBusy] = useState(""); const [result, setResult] = useState<unknown>(null);
    const [paymentId, setPaymentId] = useState(""); const [refundAmount, setRefundAmount] = useState("");
    const [withdrawId, setWithdrawId] = useState(""); const [amount, setAmount] = useState(""); const [fullName, setFullName] = useState(""); const [pixKey, setPixKey] = useState(""); const [pixType, setPixType] = useState("CPF");
    async function run(name: string, fn: () => Promise<unknown>) { setBusy(name); try { const value = await fn(); setResult(value); push("Operação concluída."); router.refresh(); } catch (e) { push(getErrorMessage(e, "A Sharpify recusou a operação."), "error"); } finally { setBusy(""); } }
    const w = data.withdrawData as { balance?: number; availableBalance?: number; withdrawFee?: number; hasPendingWithdraw?: boolean; canRequest?: boolean; limits?: { minimumAmount?: number; maximumAmount?: number }; dailyWithdrawalAvailability?: { available?: number; limit?: number } } | null;
    return <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Saldo" value={money(w?.balance)} /><Metric label="Disponível" value={money(w?.availableBalance)} /><Metric label="Taxa de saque" value={money(w?.withdrawFee)} /><Metric label="Saque" value={w?.hasPendingWithdraw ? "Pendente" : w?.canRequest ? "Disponível" : "Indisponível"} />
        </div>
        {w?.limits ? <div className="rounded-xl border border-white/[.06] bg-black/20 p-4 text-sm text-zinc-400">Limites: {money(w.limits.minimumAmount)} a {money(w.limits.maximumAmount)} · disponibilidade diária {money(w.dailyWithdrawalAvailability?.available)} de {money(w.dailyWithdrawalAvailability?.limit)}</div> : null}
        <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Pagamento e reembolso">
                <Field label="ID do link de pagamento"><input className={inputClass} value={paymentId} onChange={e=>setPaymentId(e.target.value)} /></Field>
                <div className="flex flex-wrap gap-2"><Button type="button" disabled={!!busy || !paymentId} onClick={()=>run("payment",()=>sharpifyGetPayment(paymentId))}>{busy==="payment"?<Spinner/>:null}Consultar</Button></div>
                <Field label="Valor do reembolso"><input className={inputClass} inputMode="decimal" value={refundAmount} onChange={e=>setRefundAmount(e.target.value)} placeholder="0,00" /></Field>
                <Button type="button" variant="danger" disabled={!!busy || !paymentId || !refundAmount} onClick={()=>run("refund",()=>sharpifyRefundPayment(paymentId, Number(refundAmount.replace(",","."))))}>{busy==="refund"?<Spinner/>:null}Solicitar reembolso</Button>
            </Panel>
            <Panel title="Solicitar saque">
                <Field label="Valor"><input className={inputClass} inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} /></Field>
                <Field label="Nome completo"><input className={inputClass} value={fullName} onChange={e=>setFullName(e.target.value)} /></Field>
                <Field label="Chave PIX"><input className={inputClass} value={pixKey} onChange={e=>setPixKey(e.target.value)} /></Field>
                <Field label="Tipo"><select className={inputClass} value={pixType} onChange={e=>setPixType(e.target.value)}><option>CPF</option><option>CNPJ</option><option value="EMAIL">E-mail</option><option value="PHONE_NUMBER">Telefone</option><option value="RANDOM_KEY">Aleatória</option></select></Field>
                <Button type="button" disabled={!!busy} onClick={()=>run("withdraw",()=>sharpifyRequestWithdraw({ amount:Number(amount.replace(",",".")), fullName, pixKey, pixType }))}>{busy==="withdraw"?<Spinner/>:null}Solicitar saque</Button>
            </Panel>
            <Panel title="Consultar saque">
                <Field label="ID do saque"><input className={inputClass} value={withdrawId} onChange={e=>setWithdrawId(e.target.value)} /></Field>
                <Button type="button" disabled={!!busy || !withdrawId} onClick={()=>run("get-withdraw",()=>sharpifyGetWithdraw(withdrawId))}>{busy==="get-withdraw"?<Spinner/>:null}Consultar saque</Button>
            </Panel>
            <Panel title="Resultado da última operação"><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-black/40 p-3 text-xs text-zinc-300">{result ? JSON.stringify(result,null,2) : "Nenhuma operação nesta sessão."}</pre></Panel>
        </div>
        <Panel title="Webhooks recebidos"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-xs uppercase text-zinc-500"><tr><th className="p-3">Data</th><th>Evento</th><th>Contexto</th><th>ID</th><th>Webhook</th></tr></thead><tbody>{data.events.map((e)=><tr key={e.id} className="border-t border-white/[.05] text-zinc-300"><td className="p-3">{new Date(e.occurredAt).toLocaleString("pt-BR")}</td><td>{e.name}</td><td>{e.context}</td><td>{e.contextId}</td><td className="font-mono text-xs text-zinc-500">{e.webhookId}</td></tr>)}</tbody></table>{!data.events.length?<p className="p-4 text-sm text-zinc-500">Nenhum webhook recebido.</p>:null}</div></Panel>
    </div>;
}
function money(v:unknown){return typeof v==="number"?v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):"—"}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-white/[.07] bg-black/30 p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-2 text-2xl font-bold text-white">{value}</p></div>}
function Panel({title,children}:{title:string;children:React.ReactNode}){return <section className="space-y-4 rounded-2xl border border-white/[.07] bg-black/30 p-5"><h2 className="text-base font-semibold text-white">{title}</h2>{children}</section>}