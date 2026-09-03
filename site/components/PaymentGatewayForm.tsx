"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PaymentGateway, SettingsView } from "@/lib/types";
import { getErrorMessage } from "@/lib/errors";
import { Button, Field, inputClass, SecretInput, Spinner } from "./ui";
import { useToast } from "./Toast";

export interface PaymentCredentials {
    efi?: { client_id?: string; client_secret?: string; pix_key?: string; cert?: string };
    manual?: { pix_key?: string; key_type?: string };
    promisse?: { api_key?: string };
    sharpify?: { client_id?: string; client_secret?: string };
}

/**
 * Formulário de gateway reutilizável. A lista de gateways permitidos é definida
 * por cada área; PromissePay é disponibilizado exclusivamente no admin.
 */
export function PaymentGatewayForm({
    settings,
    onSave,
    allowedGateways = ["efi", "manual", "promisse"],
}: {
    settings: SettingsView;
    onSave: (gateway: PaymentGateway, credentials: PaymentCredentials) => Promise<void>;
    allowedGateways?: PaymentGateway[];
}) {
    const router = useRouter();
    const { push } = useToast();
    const [busy, setBusy] = useState(false);
    const initialGateway = settings.paymentGateway && allowedGateways.includes(settings.paymentGateway) ? settings.paymentGateway : allowedGateways[0] || "manual";
    const [gateway, setGateway] = useState<PaymentGateway>(initialGateway);

    const [efiClientId, setEfiClientId] = useState("");
    const [efiClientSecret, setEfiClientSecret] = useState("");
    const [efiPixKey, setEfiPixKey] = useState("");
    const [efiCert, setEfiCert] = useState("");
    const [manualPixKey, setManualPixKey] = useState("");
    const [manualKeyType, setManualKeyType] = useState("email");
    const [promisseApiKey, setPromisseApiKey] = useState("");
    const [sharpifyClientId, setSharpifyClientId] = useState("");
    const [sharpifyClientSecret, setSharpifyClientSecret] = useState("");

    async function handleSave() {
        setBusy(true);
        try {
            if (!allowedGateways.includes(gateway)) throw new Error("Gateway indisponível nesta área.");
            await onSave(gateway, {
                efi: { client_id: efiClientId, client_secret: efiClientSecret, pix_key: efiPixKey, cert: efiCert },
                manual: { pix_key: manualPixKey, key_type: manualKeyType },
                promisse: { api_key: promisseApiKey },
                sharpify: { client_id: sharpifyClientId, client_secret: sharpifyClientSecret },
            });
            push("Configuração de pagamento salva.");
            router.refresh();
        } catch (e) {
            push(getErrorMessage(e, "Erro ao salvar configuração."), "error");
        } finally {
            setBusy(false);
        }
    }

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
                e.preventDefault();
                handleSave();
            }}
        >
            <Field label="Gateway de pagamento">
                <select className={inputClass} value={gateway} onChange={(e) => setGateway(e.target.value as PaymentGateway)}>
{allowedGateways.includes("efi") && <option value="efi">EFI</option>}
                    {allowedGateways.includes("manual") && <option value="manual">Manual (chave PIX)</option>}
                    {allowedGateways.includes("promisse") && <option value="promisse">PromissePay</option>}
                    {allowedGateways.includes("sharpify") && <option value="sharpify">Sharpify (PIX)</option>}
                </select>
            </Field>

            {gateway === "efi" && (
                <>
                    <Field label="Client ID">
                        <input className={inputClass} value={efiClientId} onChange={(e) => setEfiClientId(e.target.value)} required />
                    </Field>
                    <Field label="Client Secret">
                        <SecretInput value={efiClientSecret} onChange={setEfiClientSecret} />
                    </Field>
                    <Field label="Chave PIX">
                        <input className={inputClass} value={efiPixKey} onChange={(e) => setEfiPixKey(e.target.value)} required />
                    </Field>
                    <Field label="Certificado (base64)" hint="Deixe em branco para manter o atual.">
                        <textarea className={`${inputClass} h-24 font-mono text-xs`} value={efiCert} onChange={(e) => setEfiCert(e.target.value)} />
                    </Field>
                    <div className="text-xs text-zinc-500">
                        {settings.efiConfigured ? (
                            <span className="text-emerald-400">Certificado atual configurado {settings.efiValid ? "(válido)" : "(inválido)"}</span>
                        ) : (
                            "Nenhum certificado configurado ainda."
                        )}
                    </div>
                </>
            )}

            {gateway === "manual" && (
                <>
                    <Field label="Chave PIX">
                        <input className={inputClass} value={manualPixKey} onChange={(e) => setManualPixKey(e.target.value)} required />
                    </Field>
                    <Field label="Tipo da chave">
                        <select className={inputClass} value={manualKeyType} onChange={(e) => setManualKeyType(e.target.value)}>
                            <option value="email">E-mail</option>
                            <option value="cpf">CPF</option>
                            <option value="cnpj">CNPJ</option>
                            <option value="phone">Telefone</option>
                            <option value="random">Chave aleatória</option>
                        </select>
                    </Field>
                </>
            )}

            {gateway === "promisse" && allowedGateways.includes("promisse") && (
                <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] p-4">
                    <Field label="API Key PromissePay" hint="Chave secreta com os escopos payments.create e payments.read. Ela fica protegida e nunca é enviada ao navegador depois de salva.">
                        <SecretInput value={promisseApiKey} onChange={setPromisseApiKey} placeholder="sk_live_..." />
                    </Field>
                    <p className="text-xs leading-5 text-zinc-500">As cobranças usam valores em centavos e são confirmadas pelo webhook ou pela consulta segura da transação.</p>
                    <div className="flex flex-wrap gap-2 text-[11px]"><span className="rounded-full border border-white/[.07] bg-black/20 px-2.5 py-1 text-zinc-400">payments.create</span><span className="rounded-full border border-white/[.07] bg-black/20 px-2.5 py-1 text-zinc-400">payments.read</span></div>
                </div>
            )}

            {gateway === "sharpify" && allowedGateways.includes("sharpify") && (
                <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] p-4">
                    <Field label="Client ID Sharpify" hint="Credencial privada com CREATE_PAYMENT_LINK e GET_PAYMENT_LINK.">
                        <SecretInput value={sharpifyClientId} onChange={setSharpifyClientId} placeholder="SHARPIFY_CLIENT_ID_..." />
                    </Field>
                    <Field label="Client Secret Sharpify" hint="O segredo é usado somente no servidor e não volta para o navegador.">
                        <SecretInput value={sharpifyClientSecret} onChange={setSharpifyClientSecret} placeholder="SHARPIFY_CLIENT_SECRET_..." />
                    </Field>
                    <p className="text-xs leading-5 text-zinc-500">As cobranças da plataforma serão geradas exclusivamente por PIX no runtime seguro da Sharpify.</p>
                </div>
            )}
            <div className="flex justify-end">
                <Button type="submit" disabled={busy}>
                    {busy ? <Spinner /> : null}
                    Salvar
                </Button>
            </div>
        </form>
    );
}
