"use client";

import { useEffect, useState } from "react";
import { getBotConfigStatus } from "@/lib/actions/bot-config.actions";

type Presence = "online" | "idle" | "dnd" | "offline";

const PRESENCE_META: Record<Presence, { label: string; dot: string; ring: string }> = {
    online: { label: "Online", dot: "bg-[#23a55a]", ring: "ring-[#23a55a]/30" },
    idle: { label: "Ausente", dot: "bg-[#f0b232]", ring: "ring-[#f0b232]/30" },
    dnd: { label: "Ocupado", dot: "bg-[#f23f43]", ring: "ring-[#f23f43]/30" },
    offline: { label: "Offline", dot: "bg-[#80848e]", ring: "ring-[#80848e]/30" },
};

function DiscordPresenceIcon({ presence }: { presence: Presence }) {
    // Ícones inspirados no status do Discord (círculo verde, crescente laranja,
    // círculo vermelho com traço). Desenhados em SVG para não depender de assets.
    if (presence === "idle") {
        return (
            <svg viewBox="0 0 24 24" className="h-3 w-3 fill-[#f0b232]" aria-hidden>
                <path d="M20.3 17.1c.3-.4.1-1-.4-1.2a8.5 8.5 0 0 1-5-7.8 8.6 8.6 0 1 0 5.4 9Z" />
            </svg>
        );
    }
    if (presence === "dnd") {
        return (
            <svg viewBox="0 0 24 24" className="h-3 w-3 text-[#f23f43]" aria-hidden>
                <circle cx="12" cy="12" r="9" fill="currentColor" />
                <rect x="7.5" y="10.8" width="9" height="2.4" rx="1.2" fill="#0b0b0b" />
            </svg>
        );
    }
    return <span className={`h-3 w-3 rounded-full ${presence === "online" ? "bg-[#23a55a]" : "bg-[#80848e]"}`} />;
}

export function BotStatusBadge({ appId, status, errorOnUpdate }: { appId: string; status?: string; errorOnUpdate?: boolean }) {
    const [online, setOnline] = useState<boolean | null>(null);

    useEffect(() => {
        let active = true;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const check = async () => {
            try {
                const result = await getBotConfigStatus(appId);
                if (active) setOnline(result.online);
            } catch {
                // Falha transitória: preserva o último estado e tenta de novo.
            } finally {
                if (active) timer = setTimeout(check, 30_000);
            }
        };

        void check();
        return () => {
            active = false;
            if (timer) clearTimeout(timer);
        };
    }, [appId]);

    const presence: Presence = online === null ? "offline" : online ? (errorOnUpdate ? "dnd" : status === "grace_period" ? "idle" : "online") : "offline";
    const meta = PRESENCE_META[presence];

    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[.06] bg-black/40 py-0.5 pl-1.5 pr-2 text-[10px] font-medium text-zinc-300"
            title={`Presença Discord: ${meta.label}`}
        >
            <DiscordPresenceIcon presence={presence} />
            {meta.label}
        </span>
    );
}
