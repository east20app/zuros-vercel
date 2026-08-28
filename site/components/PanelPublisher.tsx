"use client";

import { useState } from "react";
import { publishBotPanel, type DiscordGuildChannel, type PublishableBotPanel } from "@/lib/actions/bot-config.actions";
import { getErrorMessage } from "@/lib/errors";
import { Button, Spinner } from "./ui";
import { useToast } from "./Toast";

export function PanelPublisher({ appId, panel, channels, initialChannelId, label = "Enviar painel", panelId }: { appId: string; panel: PublishableBotPanel; channels: DiscordGuildChannel[]; initialChannelId?: string; label?: string; panelId?: string }) {
    const textChannels = channels.filter((channel) => channel.type === 0 || channel.type === 5);
    const [channelId, setChannelId] = useState(initialChannelId && textChannels.some((channel) => channel.id === initialChannelId) ? initialChannelId : textChannels[0]?.id || "");
    const [pending, setPending] = useState(false);
    const { push } = useToast();

    async function publish() {
        if (!channelId) return;
        setPending(true);
        try {
            await publishBotPanel(appId, panel, channelId, panelId);
            push(panel === "balance" ? "Painel de depósito enviado ao Discord." : panel === "stock_requests" ? "Painel de solicitação de estoque enviado ao Discord." : panel === "tickets" ? "Painel de ticket enviado ao Discord." : "Painel de verificação enviado ao Discord.");
        } catch (error) {
            push(getErrorMessage(error, "Não foi possível enviar o painel."), "error");
        } finally {
            setPending(false);
        }
    }

    return (
        <div className="mt-4 grid gap-2 rounded-xl border border-violet-500/20 bg-violet-500/[.05] p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <select aria-label="Canal para publicar o painel" className="h-10 min-w-0 rounded-lg border border-white/10 bg-zinc-950 px-3 text-base text-zinc-200 outline-none focus:border-violet-500" value={channelId} onChange={(event) => setChannelId(event.target.value)} disabled={!textChannels.length || pending}>
                {!textChannels.length ? <option value="">Nenhum canal de texto disponível</option> : null}
                {textChannels.map((channel) => <option key={channel.id} value={channel.id}># {channel.name}</option>)}
            </select>
            <Button onClick={() => void publish()} disabled={!channelId || pending}>{pending ? <Spinner /> : null}{label}</Button>
        </div>
    );
}