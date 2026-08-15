"use client";

import { useEffect, useState } from "react";
import { getBotConfigStatus } from "@/lib/actions/bot-config.actions";

export function BotStatusIndicator({ storeId: appId, minimal = false }: { storeId: string; minimal?: boolean }) {
    const [online, setOnline] = useState<boolean | null>(null);

    useEffect(() => {
        let active = true;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const check = async () => {
            try {
                const result = await getBotConfigStatus(appId);
                if (active) setOnline(result.online);
            } catch {
                // Server Actions can be briefly unavailable while Next recompiles.
                // Preserve the last known state and retry on the next cycle.
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

    return minimal ? (
        <span className="inline-flex items-center">
            <i className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400" : online === false ? "bg-red-500" : "animate-pulse bg-zinc-600"}`} />
        </span>
    ) : (
        <span className={`inline-flex items-center gap-1.5 text-[10px] ${online ? "text-emerald-400" : online === false ? "text-red-400" : "text-zinc-500"}`}>
            <i className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400" : online === false ? "bg-red-500" : "animate-pulse bg-zinc-600"}`} />
            {online ? "Conectado" : online === false ? "Indisponível" : "Verificando"}
        </span>
    );
}
