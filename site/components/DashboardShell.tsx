"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar, type SidebarUser } from "./Sidebar";
import { DashboardOnboarding, MobileDashboardNav } from "./DashboardOnboarding";
import { BotActivityNotificationWatcher } from "./BotActivityNotificationWatcher";

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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
            <BotActivityNotificationWatcher />
            <Sidebar user={user} balance={balance} pendingCount={pendingCount} canAdmin={canAdmin} collapsed={focusMode} onToggleCollapsed={toggleSidebar} mobileMenuOpen={mobileMenuOpen} onSetMobileMenuOpen={setMobileMenuOpen} />
            <div className={`zuros-dashboard-stage min-h-[calc(100dvh-4rem)] pt-16 ${focusMode ? "lg:ml-20" : "lg:ml-64"} transition-[margin] duration-300`}>
                <div className="zuros-dashboard-content min-h-[calc(100dvh-4rem)]">{children}</div>
            </div>
            <MobileDashboardNav onOpenMenu={() => setMobileMenuOpen(true)} />
            <DashboardOnboarding />
        </>
    );
}
