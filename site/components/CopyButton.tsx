"use client";

import { useState } from "react";
import { useToast } from "./Toast";
import { Icon } from "./Icon";

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
    const { push } = useToast();
    const [done, setDone] = useState(false);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(text);
            setDone(true);
            setTimeout(() => setDone(false), 2000);
        } catch {
            push("Não foi possível copiar.", "error");
        }
    }

    return (
        <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700/60 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-emerald-500/40 hover:text-emerald-300"
        >
            <Icon name={done ? "check" : "copy"} className="h-3.5 w-3.5" />{done ? "Copiado!" : label}
        </button>
    );
}
