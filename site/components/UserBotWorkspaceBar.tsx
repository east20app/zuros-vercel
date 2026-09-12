"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

interface NavItem {
    label: string;
    suffix: string;
    icon: IconName;
    exact?: boolean;
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
    {
        label: "Principal",
        items: [
            { label: "Visão geral", suffix: "", icon: "dashboard", exact: true },
            { label: "Servidores", suffix: "/servidores", icon: "apps" },
        ],
    },
    {
        label: "Vendas",
        items: [
            { label: "Rendimentos", suffix: "/vendas", icon: "dashboard", exact: true },
            { label: "Pedidos", suffix: "/vendas/pedidos", icon: "invoice" },
            { label: "Clientes", suffix: "/vendas/clientes", icon: "user" },
            { label: "Carrinhos abertos", suffix: "/vendas/carrinhos-abertos", icon: "cart" },
            { label: "Recebimento / PIX", suffix: "/vendas/pagamentos", icon: "payment" },
            { label: "Produtos", suffix: "/vendas/produtos", icon: "product" },
        ],
    },
    {
        label: "Módulos",
        items: [
            { label: "Configurar loja", suffix: "/config/loja", icon: "store" },
            { label: "Tickets", suffix: "/config/tickets", icon: "ticket" },
            { label: "Automações", suffix: "/config/automacoes", icon: "settings" },
            { label: "Sorteios", suffix: "/config/giveaways", icon: "coupon" },
            { label: "Proteção", suffix: "/config/protecao", icon: "shield" },
            { label: "DROX Cloud", suffix: "/config/cloud", icon: "apps" },
            { label: "Mensagens", suffix: "/config/mensagens", icon: "bell" },
            { label: "Personalização", suffix: "/config/customizacao", icon: "bot" },
            { label: "Configurações", suffix: "/config/configuracoes", icon: "settings" },
            { label: "Extensões", suffix: "/config/extensions", icon: "apps" },
            { label: "Backups", suffix: "/backups", icon: "package" },
        ],
    },
];

export function UserBotWorkspaceBar({ routeId, name, productName, active }: { routeId: string; name: string; productName: string; active: boolean }) {
    const pathname = usePathname();
    if (pathname === `/dashboard/${routeId}`) return null;
    return (
        <div className="user-bot-workspace-bar sticky top-16 z-30 border-b border-white/[.06] bg-black/65 px-4 backdrop-blur-2xl sm:px-8">
            <div className="relative mx-auto flex max-w-7xl items-center gap-4 overflow-x-auto py-3 pr-8 [scrollbar-width:thin] after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-12 after:bg-gradient-to-l after:from-black/80 after:to-transparent after:content-['']" title="Deslize horizontalmente para ver todos os módulos">
                <Link href={`/dashboard/${routeId}`} className="flex shrink-0 items-center gap-2.5 pr-2">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-sm font-bold text-[var(--accent-foreground)] shadow-[0_8px_22px_rgba(0,0,0,.22)]">{name.charAt(0).toUpperCase()}</span>
                    <span className="hidden min-w-0 sm:block">
                        <b className="block max-w-40 truncate text-xs text-white">{name}</b>
                        <small className="block max-w-40 truncate text-[10px] text-zinc-500">{productName}</small>
                    </span>
                    <i className={`h-2 w-2 rounded-full ${active ? "bg-emerald-400" : "bg-amber-400"}`} title={active ? "Ativo" : "Em carência"} />
                </Link>
                <nav className="flex min-w-max items-center gap-1" aria-label="Módulos do bot">
                    {NAV_GROUPS.map((group) => (
                        <span key={group.label} className="flex min-w-max items-center gap-1 border-l border-zinc-800 pl-3 first:border-l-0 first:pl-4">
                            <span className="pr-1 text-[9px] font-semibold uppercase tracking-[.12em] text-zinc-600">{group.label}</span>
                            {group.items.map((item) => {
                                const href = `/dashboard/${routeId}${item.suffix}`;
                                const selected = item.exact ? pathname === href : pathname.startsWith(href);
                                return (
                                    <Link
                                        key={item.suffix}
                                        href={href}
                                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
                                            selected ? "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]" : "text-zinc-500 hover:bg-white/[.05] hover:text-white"
                                        }`}
                                    >
                                        <Icon name={item.icon} className="h-3.5 w-3.5" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </span>
                    ))}
                </nav>
            </div>
        </div>
    );
}
