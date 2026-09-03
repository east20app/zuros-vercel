"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveBotAvatar, saveBotIdentity, saveCamposToken, savePaymentConfig, type BotIdentityView } from "@/lib/actions/admin.actions";
import type { SettingsView } from "@/lib/types";
import { getErrorMessage } from "@/lib/errors";
import { Button, Field, inputClass, Spinner } from "./ui";
import { useToast } from "./Toast";
import { PaymentGatewayForm } from "./PaymentGatewayForm";

export function CamposTokenForm({ configured, masked }: { configured: boolean; masked: string | null }) {
    const router = useRouter();
    const { push } = useToast();
    const [token, setToken] = useState("");
    const [showToken, setShowToken] = useState(false);
    const [busy, setBusy] = useState(false);

    return (
        <form
            className="space-y-4"
            onSubmit={async (event) => {
                event.preventDefault();
                const value = token.trim();
                if (!value) {
                    push("Informe uma chave de API.", "error");
                    return;
                }
                setBusy(true);
                try {
                    await saveCamposToken(value);
                    setToken("");
                    setShowToken(false);
                    push("Chave validada e salva com segurança.");
                    router.refresh();
                } catch (error) {
                    push(getErrorMessage(error, "Não foi possível validar a chave."), "error");
                } finally {
                    setBusy(false);
                }
            }}
        >
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[.06] bg-black/20 px-4 py-3">
                <div>
                    <p className="text-sm font-medium text-white">Status da integração</p>
                    <p className="mt-1 text-xs text-zinc-500">{configured ? "Uma chave está configurada. Salve outra para substituí-la." : "Nenhuma chave configurada."}</p>
                </div>
                <span className={"rounded-full border px-3 py-1 text-xs font-semibold " + (configured ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300")}>
                    {configured ? "Configurada · " + (masked || "protegida") : "Configuração necessária"}
                </span>
            </div>

            <Field label="Chave de API da Campos" hint="Encontre em Informações da conta → Desenvolvedor → Seção de Desenvolvedor. A chave é validada antes de ser salva.">
                <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                        className={inputClass}
                        type={showToken ? "text" : "password"}
                        value={token}
                        autoComplete="new-password"
                        spellCheck={false}
                        placeholder="Cole aqui a nova chave de API"
                        onChange={(event) => setToken(event.target.value)}
                    />
                    <Button type="button" variant="outline" disabled={busy} onClick={() => setShowToken((current) => !current)}>
                        {showToken ? "Ocultar" : "Mostrar"}
                    </Button>
                </div>
            </Field>

            <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs leading-5 text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
                <p>A chave nunca será exibida novamente. Depois de salvar uma chave válida, o worker poderá processar as atualizações pendentes.</p>
                <Button type="submit" disabled={busy || !token.trim()}>
                    {busy ? <Spinner /> : null}
                    {busy ? "Validando..." : configured ? "Substituir chave" : "Salvar chave"}
                </Button>
            </div>
        </form>
    );
}
export function PaymentForm({ settings }: { settings: SettingsView }) {
    return <PaymentGatewayForm settings={settings} allowedGateways={["efi", "manual", "promisse", "sharpify"]} onSave={async (gateway, credentials) => { await savePaymentConfig(gateway, credentials); }} />;
}

export function BotIdentityForm({ identity }: { identity: BotIdentityView }) {
    const router = useRouter();
    const { push } = useToast();
    const [busy, setBusy] = useState(false);
    const [description, setDescription] = useState(identity.description);
    const [avatarUrl, setAvatarUrl] = useState("");
    const [presences, setPresences] = useState<string[]>(
        Array.from({ length: 5 }, (_, index) => identity.presences[index] || "")
    );

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                try {
                    await saveBotIdentity({ description, presences });
                    push("Identidade do bot atualizada no site e no Discord.");
                    router.refresh();
                } catch (error) {
                    push(getErrorMessage(error, "Erro ao atualizar o bot."), "error");
                } finally {
                    setBusy(false);
                }
            }}
        >
            <Field label="Avatar do bot" hint="URL de uma imagem PNG, JPEG, GIF ou WebP de até 8 MB.">
                <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                        className={inputClass}
                        type="url"
                        value={avatarUrl}
                        placeholder="https://exemplo.com/avatar.png"
                        onChange={(event) => setAvatarUrl(event.target.value)}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        disabled={busy || !avatarUrl}
                        onClick={async () => {
                            setBusy(true);
                            try {
                                await saveBotAvatar(avatarUrl);
                                setAvatarUrl("");
                                push("Avatar atualizado no Discord.");
                                router.refresh();
                            } catch (error) {
                                push(getErrorMessage(error, "Erro ao atualizar o avatar."), "error");
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        Aplicar
                    </Button>
                </div>
            </Field>
            <Field label="Biografia do bot" hint="A mesma descrição exibida no perfil do bot no Discord.">
                <textarea
                    className={`${inputClass} h-28`}
                    value={description}
                    maxLength={400}
                    onChange={(event) => setDescription(event.target.value)}
                />
            </Field>
            {presences.map((presenle, index) => (
                <Field key={index} label={`Rich Presence ${index + 1}`}>
                    <input
                        className={inputClass}
                        value={presenle}
                        maxLength={128}
                        placeholder="Ex.: Gerenciando aplicações"
                        onChange={(event) => {
                            const values = [...presences];
                            values[index] = event.target.value;
                            setPresences(values);
                        }}
                    />
                </Field>
            ))}
            <div className="flex justify-end">
                <Button type="submit" disabled={busy}>
                    {busy ? <Spinner /> : null}
                    Salvar identidade
                </Button>
            </div>
        </form>
    );
}
