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
}

/**
 * Formulário único de gateway de pagamento (EFI / Manual / PromissePay),
 * compartilhado pelo painel global (SettingsForms.PaymentForm) e pela
 * configuração da loja (StorePaymentForm). A única diferença entre os dois
 * pontos é a action que persiste os dados.
 */
export function PaymentGatewayForm({
    settings,
    onSave,
}: {
    settings: SettingsView;
    onSave: (gateway: PaymentGateway, credentials: PaymentCredentials) => Promise<void>;
}) {
    const router = useRouter();
    const { push } = useToast();
    const [busy, setBusy] = useState(false);
    const [gateway, setGateway] = useState<PaymentGateway>(settings.paymentGateway || "manual");

    const [efiClientId, setEfiClientId] = useState("");
    const [efiClientSecret, setEfiClientSecret] = useState("");
    const [efiPixKey, setEfiPixKey] = useState("");
    const [efiCert, setEfiCert] = useState("");
    const [manualPixKey, setManualPixKey] = useState("");
    const [manualKeyType, setManualKeyType] = useState("email");
    const [promisseApiKey, setPromisseApiKey] = useState("");

    async function handleSave() {
        setBusy(true);
        try {
            await onSave(gateway, {
                efi: { client_id: efiClientId, client_secret: efiClientSecret, pix_key: efiPixKey, cert: efiCert },
                manual: { pix_key: manualPixKey, key_type: manualKeyType },
                promisse: { api_key: promisseApiKey },
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
                    <option value="efi">EFI</option>
                    <option value="manual">Manual (chave PIX)</option>
                    <option value="promisse">PromissePay</option>
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

            {gateway === "promisse" && (
                <Field label="API Key PromissePay">
                    <SecretInput value={promisseApiKey} onChange={setPromisseApiKey} />
                </Field>
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
