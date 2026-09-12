"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export interface AppTabItem {
    id: string;
    label: string;
    content: ReactNode;
}

export function AppTabs({ tabs, defaultTab }: { tabs: AppTabItem[]; defaultTab?: string }) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const requestedTab = searchParams.get("tab");
    const [activeId, setActiveId] = useState(requestedTab && tabs.some((tab) => tab.id === requestedTab) ? requestedTab : defaultTab ?? tabs[0]?.id);
    useEffect(() => {
        if (requestedTab && tabs.some((tab) => tab.id === requestedTab)) setActiveId(requestedTab);
    }, [requestedTab, tabs]);
    const current = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

    function selectTab(tabId: string) {
        setActiveId(tabId);
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", tabId);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }

    return <div>
        <nav aria-label="Seções da aplicação" role="tablist" className="app-tabs">
            {tabs.map((tab, index) => <button key={tab.id} type="button" role="tab" onClick={() => selectTab(tab.id)} aria-selected={tab.id === current?.id} className={`app-tab ${tab.id === current?.id ? "is-active" : ""}`}><span>0{index + 1}</span>{tab.label}</button>)}
        </nav>
        <div key={current?.id} className="mt-6 animate-fade-in">{current?.content}</div>
    </div>;
}
