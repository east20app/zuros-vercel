"use client";

import { useState } from "react";

export function AnnouncementBar() {
    const [visible, setVisible] = useState(true);
    if (!visible) return null;
    return (
        <div className="relative border-b border-[var(--border)] bg-[var(--accent-soft)] px-12 py-2.5 text-center text-xs font-medium text-[var(--accent)]">
            <span className="mr-2 text-[var(--accent)]" aria-hidden>●</span>
            Precisa de ajuda com sua operação?
            <a href="#suporte" className="ml-2 font-semibold text-[var(--accent)] underline-offset-4 hover:underline">Acessar suporte</a>
            <button type="button" onClick={() => setVisible(false)} aria-label="Fechar aviso" className="absolute right-4 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-white">×</button>
        </div>
    );
}
