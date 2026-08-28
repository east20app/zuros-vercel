"use client";

import { useState } from "react";
import { publishDroxProduct, type DiscordGuildChannel } from "@/lib/actions/bot-config.actions";
import { getErrorMessage } from "@/lib/errors";
import { Button, Spinner } from "./ui";
import { useToast } from "./Toast";

export function ProductPublisher({ appId, productId, channels }: { appId: string; productId: string; channels: DiscordGuildChannel[] }) {
    const textChannels = channels.filter((channel) => channel.type === 0 || channel.type === 5);
    const [channelId, setChannelId] = useState(textChannels[0]?.id || "");
    const [pending, setPending] = useState(false);
    const { push } = useToast();
    async function publish() {
        if (!channelId) return;
        setPending(true);
        try { await publishDroxProduct(appId, productId, channelId); push("Produto publicado no Discord com o botão de compra do DROX."); }
        catch (error) { push(getErrorMessage(error, "Não foi possível publicar o produto."), "error"); }
        finally { setPending(false); }
    }
    return <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <select aria-label="Canal do produto" className="h-10 min-w-0 rounded-lg border border-white/10 bg-zinc-950 px-3 text-base text-zinc-200" value={channelId} onChange={(event) => setChannelId(event.target.value)}>
            {!textChannels.length ? <option value="">Nenhum canal de texto</option> : null}
            {textChannels.map((channel) => <option key={channel.id} value={channel.id}># {channel.name}</option>)}
        </select>
        <Button size="sm" disabled={!channelId || pending} onClick={() => void publish()}>{pending ? <Spinner /> : null}Enviar ao Discord</Button>
    </div>;
}