"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar, type SidebarUser } from "./Sidebar";

export function DashboardShell({
    user,
    balance,
    pendingCount,
    canAdmin,
    children,
}: {
    user: SidebarUser;
    balance: number;
    pendingCount?: number;
    canAdmin?: boolean;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const automaticFocus = /^\/dashboard\/[^/]+\/config(?:\/|$)/.test(pathname);
    const [manualCollapsed, setManualCollapsed] = useState<boolean | null>(null);
    useEffect(() => {
        const saved = localStorage.getItem("sidebar-collapsed") ?? localStorage.getItem("zuros-sidebar-collapsed");
        if (saved !== null) setManualCollapsed(saved === "true");
    }, []);
    const focusMode = manualCollapsed ?? automaticFocus;
    const toggleSidebar = () => setManualCollapsed((current) => {
        const next = !(current ?? automaticFocus);
        localStorage.setItem("sidebar-collapsed", String(next));
        return next;
    });

    return (
        <>
            <Sidebar user={user} balance={balance} pendingCount={pendingCount} canAdmin={canAdmin} collapsed={focusMode} onToggleCollapsed={toggleSidebar} />
            <div className={`min-h-[calc(100vh-4rem)] pt-16 ${focusMode ? "lg:ml-20" : "lg:ml-64"} transition-[margin]`}>
                <div className="min-h-[calc(100vh-4rem)] border-t border-zinc-900 bg-background lg:rounded-tl-[28px] lg:border-l">{children}</div>
            </div>
        </>
    );
}
