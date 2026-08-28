"use client";

import { useState } from "react";
import type { DiscordGuildChannel } from "@/lib/actions/bot-config.actions";
import { PanelPublisher } from "./PanelPublisher";
import { Card } from "./ui";

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export function ModulePanelPublisher({ appId, moduleName, value, channels }: { appId: string; moduleName: "tickets" | "cloud"; value: Record<string, unknown>; channels: DiscordGuildChannel[] }) {
    const panels = record(value.config).panels ? record(record(value.config).panels) : record(value.panels);
    const panelEntries = Object.entries(panels).filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[1] && typeof entry[1] === "object" && !Array.isArray(entry[1])));
    const [panelId, setPanelId] = useState(panelEntries[0]?.[0] || "");
    if (moduleName === "cloud") {
        return <Card className="mb-5"><h2 className="font-semibold text-white">Publicar verificação no Discord</h2><p className="mt-1 text-xs text-zinc-500">Envia a mensagem configurada com o botão que gera o link individual do ZUROS Cloud.</p><PanelPublisher appId={appId} panel="cloud" channels={channels} label="Enviar painel de verificação" /></Card>;
    }
    const selected = panelEntries.find(([id]) => id === panelId)?.[1] || {};
    return <Card className="mb-5"><h2 className="font-semibold text-white">Publicar painel de tickets</h2><p className="mt-1 text-xs text-zinc-500">Publica ou atualiza o painel com botões/opções iguais ao bot.</p>{panelEntries.length ? <div className="mt-4"><select className="h-10 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 text-base text-zinc-200" value={panelId} onChange={(event) => setPanelId(event.target.value)}>{panelEntries.map(([id, panel]) => <option key={id} value={id}>{String(panel.name || panel.title || id)}</option>)}</select><PanelPublisher appId={appId} panel="tickets" panelId={panelId} channels={channels} initialChannelId={typeof selected.channel_id === "string" ? selected.channel_id : undefined} label="Enviar ou atualizar painel" /></div> : <p className="mt-4 rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">Crie um painel de ticket antes de publicar.</p>}</Card>;
}