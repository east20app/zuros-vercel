"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const light = mounted && resolvedTheme === "light";
    const label = light ? "Ativar tema escuro" : "Ativar tema claro";

    return (
        <button
            type="button"
            onClick={() => setTheme(light ? "dark" : "light")}
            aria-label={label}
            title={label}
            className={`inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)] ${compact ? "h-9 w-9" : "gap-2 px-3 py-2 text-xs"}`}
        >
            <span aria-hidden className="text-base leading-none">{light ? "☾" : "☼"}</span>
            {!compact && <span>{light ? "Tema escuro" : "Tema claro"}</span>}
        </button>
    );
}
