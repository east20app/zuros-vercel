"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createProduct, updateProduct } from "@/lib/actions/admin.actions";
import type { ProductView } from "@/lib/types";
import { getErrorMessage } from "@/lib/errors";
import { Button, Field, inputClass, Modal, Spinner } from "./ui";
import { useToast } from "./Toast";

const VALID_RUNTIMES = ["nodejs", "python", "java", "go", "rust", "dotnet", "deno"];

export function ProductFormModal({
    storeId,
    product,
    onClose,
}: {
    storeId: string;
    product?: ProductView | null;
    onClose: () => void;
}) {
    const router = useRouter();
    const { push } = useToast();
    const [busy, setBusy] = useState(false);
    const [name, setName] = useState(product?.name || "");
    const [productType, setProductType] = useState<"bot" | "auth" | "complete">(product?.productType || "bot");
    const [authPlan, setAuthPlan] = useState<"basic" | "cloud" | "pro">(product?.authSettings?.plan || "basic");
    const [authServers, setAuthServers] = useState(String(product?.authSettings?.servers || 1));
    const [authUsers, setAuthUsers] = useState(String(product?.authSettings?.verifiedUsers || 1000));
    const [authFeatures, setAuthFeatures] = useState(product?.authSettings?.features.join("\n") || "");
    const [runtime, setRuntime] = useState(product?.runtimeEnvironment || "nodejs");
    const [runCommand, setRunCommand] = useState(product?.runCommand || "");
    const [weekly, setWeekly] = useState(product?.prices?.weekly ? String(product.prices.weekly) : "");
    const [biweekly, setBiweekly] = useState(product?.prices?.biweekly ? String(product.prices.biweekly) : "");
    const [monthly, setMonthly] = useState(product?.prices?.monthly ? String(product.prices.monthly) : "");
    const [lifetime, setLifetime] = useState(product?.prices?.lifetime ? String(product.prices.lifetime) : "");
    const [memoryMB, setMemoryMB] = useState(product ? String(product.memoryMB) : "256");
    const [description, setDescription] = useState(product?.messageSettings.description || "");
    const [banner, setBanner] = useState(product?.messageSettings.banner || "");
    const [video, setVideo] = useState(product?.messageSettings.video || "");
    const [buttonName, setButtonName] = useState(product?.messageSettings.buttonName || "Comprar");
    const [protectedFiles, setProtectedFiles] = useState(product?.protectedFiles.join("\n") || "");
    const [redeemActive, setRedeemActive] = useState(product?.redeemSettings.active || false);
    const [redeemDays, setRedeemDays] = useState(product?.redeemSettings.days ? String(product.redeemSettings.days) : "");
    const [redeemWebhook, setRedeemWebhook] = useState(product?.redeemSettings.webhook || "");

    const num = (v: string) => (v === "" || isNaN(Number(v)) ? undefined : Number(v));

    async function handleSubmit() {
        setBusy(true);
        try {
            const prices = {
                weekly: num(weekly),
                biweekly: num(biweekly),
                monthly: num(monthly),
                lifetime: num(lifetime),
            };
            const messageSettings = { description, banner, video, buttonName };
            const authSettings = { plan: authPlan, servers: Number(authServers) || 1, verifiedUsers: Number(authUsers) || 1000, features: authFeatures.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) };
            const extras = { productType, authSettings, protectedFiles: protectedFiles.split(/\r?\n/).map((item) => item.trim()).filter(Boolean), redeemSettings: { active: redeemActive, days: num(redeemDays), webhook: redeemWebhook.trim() || undefined } };
            if (product) {
                await updateProduct(product.id, { name, runtimeEnvironment: runtime, runCommand, memoryMB: Number(memoryMB) || 256, prices, messageSettings, ...extras });
                push("Produto atualizado.");
            } else {
                await createProduct(storeId, { name, runtimeEnvironment: runtime, runCommand, memoryMB: Number(memoryMB) || 256, prices, messageSettings, ...extras });
                push("Produto criado.");
            }
            router.refresh();
            onClose();
        } catch (e) {
            push(getErrorMessage(e, "Erro ao salvar produto."), "error");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal open onClose={onClose} title={product ? "Editar produto" : "Novo produto"}>
            <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit();
                }}
            >
                <Field label="Nome">
                    <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
                </Field>
                <Field label="Tipo do produto">
                    <select className={inputClass} value={productType} onChange={(e) => setProductType(e.target.value as "bot" | "auth" | "complete")}><option value="bot">Bot Discord</option><option value="auth">ZUROS Auth</option><option value="complete">Bot + ZUROS Auth</option></select>
                </Field>
                {productType !== "bot" && <div className="grid gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 sm:grid-cols-3"><Field label="Plano Auth"><select className={inputClass} value={authPlan} onChange={(e) => setAuthPlan(e.target.value as "basic" | "cloud" | "pro")}><option value="basic">Auth</option><option value="cloud">Bot + Auth</option><option value="pro">Completo</option></select></Field><Field label="Servidores"><input className={inputClass} type="number" min="1" value={authServers} onChange={(e) => setAuthServers(e.target.value)} /></Field><Field label="Usuários verificados"><input className={inputClass} type="number" min="1" value={authUsers} onChange={(e) => setAuthUsers(e.target.value)} /></Field><Field label="Recursos Auth" hint="Um por linha"><textarea className={`${inputClass} min-h-24`} value={authFeatures} onChange={(e) => setAuthFeatures(e.target.value)} /></Field></div>}
                {productType !== "auth" && <>                <Field label="Runtime">
                    <select className={inputClass} value={runtime} onChange={(e) => setRuntime(e.target.value)}>
                        {VALID_RUNTIMES.map((r) => (
                            <option key={r} value={r}>
                                {r}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Comando de execução" hint="Ex.: node index.js, python app.py">
                    <input className={inputClass} value={runCommand} onChange={(e) => setRunCommand(e.target.value)} required />
                </Field>
                <Field label="Memória (MB)">
                    <input className={inputClass} type="number" min={64} step={64} value={memoryMB} onChange={(e) => setMemoryMB(e.target.value)} />
                </Field>
                </>}
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Semanal (R$)">
                        <input className={inputClass} type="number" step="0.01" min={0} value={weekly} onChange={(e) => setWeekly(e.target.value)} />
                    </Field>
                    <Field label="Quinzenal (R$)">
                        <input className={inputClass} type="number" step="0.01" min={0} value={biweekly} onChange={(e) => setBiweekly(e.target.value)} />
                    </Field>
                    <Field label="Mensal (R$)">
                        <input className={inputClass} type="number" step="0.01" min={0} value={monthly} onChange={(e) => setMonthly(e.target.value)} />
                    </Field>
                    <Field label="Vitalício (R$)">
                        <input className={inputClass} type="number" step="0.01" min={0} value={lifetime} onChange={(e) => setLifetime(e.target.value)} />
                    </Field>
                </div>
                <div className="grid gap-3 border-t border-zinc-800 pt-3 lg:grid-cols-2"><Field label="Arquivos protegidos" hint="Um caminho por linha; eles serão preservados nas atualizações."><textarea className={`${inputClass} min-h-28`} value={protectedFiles} onChange={(event) => setProtectedFiles(event.target.value)} placeholder="config.json&#10;data/" /></Field><div className="space-y-3"><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={redeemActive} onChange={(event) => setRedeemActive(event.target.checked)} />Ativar resgate do produto</label><Field label="Dias de acesso no resgate"><input type="number" min="1" className={inputClass} value={redeemDays} onChange={(event) => setRedeemDays(event.target.value)} /></Field><Field label="Webhook do resgate"><input type="url" className={inputClass} value={redeemWebhook} onChange={(event) => setRedeemWebhook(event.target.value)} /></Field></div></div>
                <div className="border-t border-zinc-800 pt-3">
                    <p className="mb-3 text-sm font-semibold text-white">Mensagem no Discord</p>
                    <div className="grid gap-3 lg:grid-cols-2">
                        <div className="space-y-3">
                            <Field label="Descrição" hint="Até 4.000 caracteres">
                                <textarea className={`${inputClass} min-h-28 resize-y`} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
                            </Field>
                            <Field label="URL do banner"><input className={inputClass} type="url" value={banner} onChange={(e) => setBanner(e.target.value)} /></Field>
                            <Field label="URL do vídeo"><input className={inputClass} type="url" value={video} onChange={(e) => setVideo(e.target.value)} /></Field>
                            <Field label="Texto do botão"><input className={inputClass} maxLength={80} value={buttonName} onChange={(e) => setButtonName(e.target.value)} required /></Field>
                        </div>
                        <div className="rounded-xl bg-[#313338] p-3 shadow-2xl ring-1 ring-black/50">
                            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400"><i className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Preview em tempo real</p>
                            <div className="border-l-4 border-emerald-500 bg-[#2b2d31] p-3 shadow-lg">
                                <p className="font-semibold text-white">{name || "Nome do produto"}</p>
                                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{description || "A descrição da oferta aparecerá aqui."}</p>
                                {banner && <Image unoptimized src={banner} width={640} height={160} alt={`Preview do banner de ${name || "produto"}`} className="mt-3 max-h-40 w-full rounded object-cover" />}
                                {video && <p className="mt-2 truncate text-xs text-sky-400">🎬 {video}</p>}
                            </div>
                            <button type="button" className="mt-2 rounded-lg bg-gradient-to-b from-indigo-400 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(99,102,241,.6)] transition hover:from-indigo-300 hover:to-indigo-500">{buttonName || "Comprar"}</button>
                        </div>
                    </div>
                </div>
                <div className="sticky bottom-0 z-20 mt-3 flex justify-end gap-2 border-t border-zinc-800 bg-zinc-950/95 px-2 py-4 shadow-[0_-18px_35px_-24px_rgba(0,0,0,.95)] backdrop-blur-xl">
                    <Button variant="ghost" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={busy} className="min-w-36">
                        {busy ? <Spinner /> : null}
                        {product ? "Salvar alterações" : "Salvar produto"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
