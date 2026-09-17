"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar, type SidebarUser } from "./Sidebar";
import { DashboardOnboarding, MobileDashboardNav } from "./DashboardOnboarding";
import { BotActivityNotificationWatcher } from "./BotActivityNotificationWatcher";
import { getRequiredDiscordIdentity } from "@/lib/actions/identity.actions";

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
    const router = useRouter();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    useEffect(() => {
        if (pathname === "/dashboard/discord") return;
        void getRequiredDiscordIdentity().then((identity) => {
            if (identity.required) router.replace("/dashboard/discord");
        }).catch(() => undefined);
    }, [pathname, router]);
    const focusMode = false;

    return (
        <>
            <BotActivityNotificationWatcher />
            <Sidebar user={user} balance={balance} pendingCount={pendingCount} canAdmin={canAdmin} collapsed={focusMode} mobileMenuOpen={mobileMenuOpen} onSetMobileMenuOpen={setMobileMenuOpen} />
            <div className={`zuros-dashboard-stage min-h-dvh pt-16 lg:pt-0 ${focusMode ? "lg:ml-20" : "lg:ml-64"}`}>
                <div className="zuros-dashboard-content min-h-dvh">{children}</div>
            </div>
            <MobileDashboardNav onOpenMenu={() => setMobileMenuOpen(true)} />
            <DashboardOnboarding />
        </>
    );
}
