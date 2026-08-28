"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const ITEMS: Array<{ label: string; suffix: string; icon: IconName }> = [
    { label: "Visão geral", suffix: "", icon: "dashboard" },
    { label: "Pedidos", suffix: "/vendas/pedidos", icon: "invoice" },
    { label: "Produtos", suffix: "/vendas/produtos", icon: "product" },
    { label: "Tickets", suffix: "/config/tickets", icon: "ticket" },
];

export function UserBotWorkspaceBar({ routeId, name, productName, active }: { routeId: string; name: string; productName: string; active: boolean }) {
    const pathname = usePathname();
    if (pathname === `/dashboard/${routeId}`) return null;
    return (
        <div className="sticky top-16 z-30 border-b border-white/[.06] bg-black/65 px-4 backdrop-blur-2xl sm:px-8">
            <div className="mx-auto flex max-w-7xl items-center gap-4 overflow-x-auto py-3">
                <Link href={`/dashboard/${routeId}`} className="flex shrink-0 items-center gap-2.5 pr-2">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#7c3aed] text-sm font-bold text-white">{name.charAt(0).toUpperCase()}</span>
                    <span className="hidden min-w-0 sm:block">
                        <b className="block max-w-40 truncate text-xs text-white">{name}</b>
                        <small className="block max-w-40 truncate text-[10px] text-zinc-500">{productName}</small>
                    </span>
                    <i className={`h-2 w-2 rounded-full ${active ? "bg-emerald-400" : "bg-amber-400"}`} title={active ? "Ativo" : "Em carência"} />
                </Link>
                <nav className="flex min-w-max items-center gap-1 border-l border-zinc-800 pl-4" aria-label="Atalhos do bot">
                    {ITEMS.map((item) => {
                        const href = `/dashboard/${routeId}${item.suffix}`;
                        const selected = item.suffix ? pathname.startsWith(href) : pathname === href;
                        return <Link key={item.label} href={href} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${selected ? "bg-[#7c3aed]/15 text-[#b8bdfb]" : "text-zinc-500 hover:bg-white/[.05] hover:text-white"}`}><Icon name={item.icon} className="h-3.5 w-3.5" />{item.label}</Link>;
                    })}
                </nav>
            </div>
        </div>
    );
}
