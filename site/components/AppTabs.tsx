"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export interface AppTabItem {
    id: string;
    label: string;
    content: ReactNode;
}

export function AppTabs({ tabs, defaultTab }: { tabs: AppTabItem[]; defaultTab?: string }) {
    const [activeId, setActiveId] = useState(defaultTab ?? tabs[0]?.id);
    const current = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

    return (
        <div>
            <nav
                aria-label="Seções da aplicação"
                role="tablist"
                className="inline-flex flex-wrap rounded-xl border border-white/[.08] bg-background p-1 shadow-[inset_0_1px_0_rgba(255,255,255,.03)]"
            >
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        onClick={() => setActiveId(tab.id)}
                        aria-selected={tab.id === current?.id}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                            tab.id === current?.id
                                ? "bg-[#5865f2] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15),0_4px_14px_-6px_rgba(0,0,0,.6)]"
                                : "text-zinc-400 hover:bg-white/[.06] hover:text-white"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>
            <div key={current?.id} className="mt-6 animate-fade-in">
                {current?.content}
            </div>
        </div>
    );
}
