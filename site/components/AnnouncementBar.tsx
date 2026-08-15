"use client";

import { useState } from "react";

export function AnnouncementBar() {
    const [visible, setVisible] = useState(true);
    if (!visible) return null;
    return (
        <div className="relative border-b border-emerald-500/20 bg-emerald-500/[.08] px-12 py-2.5 text-center text-xs font-medium text-emerald-100">
            <span className="mr-2 text-emerald-400" aria-hidden>●</span>
            Precisa de ajuda com sua operação?
            <a href="#suporte" className="ml-2 font-semibold text-emerald-300 underline-offset-4 hover:underline">Acessar suporte</a>
            <button type="button" onClick={() => setVisible(false)} aria-label="Fechar aviso" className="absolute right-4 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-emerald-500/70 transition hover:bg-emerald-500/10 hover:text-white">×</button>
        </div>
    );
}
