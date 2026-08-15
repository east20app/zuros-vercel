"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveBotAvatar, saveBotIdentity, savePaymentConfig, type BotIdentityView } from "@/lib/actions/admin.actions";
import type { SettingsView } from "@/lib/types";
import { getErrorMessage } from "@/lib/errors";
import { Button, Field, inputClass, Spinner } from "./ui";
import { useToast } from "./Toast";
import { PaymentGatewayForm } from "./PaymentGatewayForm";

export function PaymentForm({ settings }: { settings: SettingsView }) {
    return <PaymentGatewayForm settings={settings} onSave={async (gateway, credentials) => { await savePaymentConfig(gateway, credentials); }} />;
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
                <div className="flex gap-2">
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
            {presences.map((presence, index) => (
                <Field key={index} label={`Rich Presence ${index + 1}`}>
                    <input
                        className={inputClass}
                        value={presence}
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
