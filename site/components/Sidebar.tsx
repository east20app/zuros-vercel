"use client";

import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BOT_MODULE_META } from "@/lib/bot-config-meta";
import { BotsNav } from "./BotsNav";
import { BotStatusIndicator } from "./BotStatusIndicator";
import { Icon } from "./Icon";
import { BrandLogo } from "./BrandLogo";
import { SidebarApplicationControls } from "./SidebarApplicationControls";

export interface SidebarUser {
    name?: string | null;
    email?: string | null;
    image?: string | null;
}

type SidebarIconName = "dashboard" | "invoice" | "settings" | "user" | "affiliate" | "bell" | "admin";
type SidebarLink = { icon: SidebarIconName | "left" | "tutorial"; label: string; href: string; badge?: "soon" | number; exact?: boolean; section?: string };

const exactRoutes = new Set(["/dashboard", "/dashboard/account", "/admin"]);

const routeIsActive = (pathname: string, href: string) =>
    pathname === href || (!exactRoutes.has(href) && pathname.startsWith(`${href}/`));

const PANEL_RAIL_ITEMS = [
    { module: "loja", label: "Configurar Loja" },
    { module: "tickets", label: "Gerenciar Ticket" },
    { module: "vendas", label: "Ver Rendimento" },
    { module: "customizacao", label: "Personalização" },
    { module: "automacoes", label: "Automações" },
    { module: "cloud", label: "DROX Cloud" },
    { module: "mensagens", label: "Mensagens" },
    { module: "protecao", label: "Proteção do Servidor" },
    { module: "giveaways", label: "Sorteios" },
    { module: "configuracoes", label: "Configurações" },
] as const;

function SidebarIcon({
    name,
    className = "h-4 w-4",
}: {
    name: SidebarIconName | "menu" | "logout" | "left" | "right" | "home" | "tutorial" | "help";
    className?: string;
}) {
    const paths: Record<string, React.ReactNode> = {
        dashboard: (
            <>
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
            </>
        ),
        invoice: (
            <>
                <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
                <path d="M9 8h6M9 12h6" />
            </>
        ),
        settings: (
            <>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
            </>
        ),
        user: (
            <>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
            </>
        ),
        affiliate: (
            <>
                <circle cx="7" cy="7" r="3" />
                <circle cx="17" cy="17" r="3" />
                <path d="m9 9 6 6" />
            </>
        ),
        bell: (
            <>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M10 21h4" />
            </>
        ),
        admin: (
            <>
                <path d="M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7l-8-4Z" />
                <path d="m9 12 2 2 4-4" />
            </>
        ),
        menu: <path d="M4 6h16M4 12h16M4 18h16" />,
        logout: (
            <>
                <path d="m10 17 5-5-5-5M15 12H3" />
                <path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
            </>
        ),
        left: <path d="m15 18-6-6 6-6" />,
        right: <path d="m9 18 6-6-6-6" />,
        home: (
            <>
                <path d="m3 11 9-8 9 8" />
                <path d="M5 10v11h14V10M9 21v-6h6v6" />
            </>
        ),
        tutorial: (
            <>
                <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
                <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z" />
            </>
        ),
        help: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="M9.8 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.2.9-1.2 1.8M12 17h.01" />
            </>
        ),
    };
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={`${className} fill-none stroke-current stroke-[1.8]`}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {paths[name]}
        </svg>
    );
}

function UserAvatar({ user }: { user?: SidebarUser }) {
    return user?.image ? (
        <Image unoptimized priority referrerPolicy="no-referrer" src={user.image} width={36} height={36} alt={`Avatar de ${user.name || "usuário"}`} className="h-9 w-9 shrink-0 rounded-full object-cover" />
    ) : (
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-purple-400 text-sm font-bold text-white">
            {(user?.name || "Z")[0]}
        </span>
    );
}

function Logo({ compact = false }: { compact?: boolean }) {
    return (
        <Link href="/dashboard" aria-label="ZUROS" className={`flex ${compact ? "h-11 w-11 items-center justify-center overflow-hidden" : "h-12 items-center px-2"}`}>
            {compact ? <BrandLogo compact className="h-9 w-9 rounded-lg" /> : <BrandLogo className="h-9 w-36" />}
        </Link>
    );
}

/** Fixed top bar shown above the main content; offsets to clear whichever rail is docked on desktop. */
function TopHeader({ leftOffsetClass, pendingCount, title }: { leftOffsetClass: string; pendingCount: number; title: string }) {
    return (
        <header className={`zuros-mobile-header fixed inset-x-0 top-0 z-30 h-16 border-b border-white/[.06] bg-black/70 backdrop-blur-xl ${leftOffsetClass}`}>
            <div className="flex h-full items-center pl-28 pr-5 sm:pr-7 lg:pl-7"><span className="text-xs font-semibold uppercase tracking-[.18em] text-zinc-400">{title}</span></div>
            {pendingCount > 0 && (
                <Link
                    href="/dashboard/invoices"
                    aria-label={`Ver ${pendingCount} fatura${pendingCount > 1 ? "s" : ""} pendente${pendingCount > 1 ? "s" : ""}`}
                    className="absolute right-6 top-3.5 grid h-9 w-9 place-items-center rounded-xl border border-zinc-800 text-zinc-400"
                >
                    <Icon name="bell" className="h-4 w-4" />
                    <span aria-hidden="true" className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 text-[9px] font-bold text-black">
                        {pendingCount}
                    </span>
                </Link>
            )}
        </header>
    );
}

/** Hamburger button that opens the mobile drawer; hidden on desktop. */
function MobileMenuButton({ onOpen }: { onOpen: () => void }) {
    return (
        <button
            type="button"
            onClick={onOpen}
            aria-label="Abrir menu"
            className="zuros-mobile-menu-button fixed left-4 top-3 z-50 inline-flex h-10 items-center gap-2 rounded-xl border border-white/[.08] bg-white/[.045] px-3 text-xs font-medium text-white shadow-lg shadow-black/20 backdrop-blur-xl lg:hidden"
        >
            <Icon name="menu" className="h-4 w-4" />
            <span>Menu</span>
        </button>
    );
}

/** Full-height slide-in drawer used on mobile regardless of which desktop rail is active. */
function MobileDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
    if (!open) return null;
    return (
        <div className="zuros-mobile-drawer fixed inset-0 z-[60] lg:hidden">
            <button aria-label="Fechar menu" className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative flex h-full w-full flex-col border-r border-white/[.08] bg-black/95 shadow-2xl">
                <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/[.06] px-5">
                    <h2 className="text-xl font-bold text-white">Menu</h2>
                    <button type="button" onClick={onClose} aria-label="Fechar menu" className="grid h-10 w-10 place-items-center rounded-xl text-3xl font-light text-zinc-400 hover:bg-white/[.05] hover:text-white">×</button>
                </header>
                <div className="min-h-0 flex-1">{children}</div>
            </div>
        </div>
    );
}

function ConfigRail({ storeId, pathname, user }: { storeId: string; pathname: string; user: SidebarUser }) {
    return (
        <aside className="flex h-full flex-col items-center gap-1 border-r border-zinc-800 bg-background-dark px-2 py-4">
            <Logo compact />
            <Link
                href={`/dashboard/${storeId}`}
                aria-label="Voltar para o bot"
                title="Voltar para o bot"
                className="mt-1 grid h-10 w-10 place-items-center rounded-xl text-zinc-500 transition hover:bg-zinc-900 hover:text-white"
            >
                ←
            </Link>
            <div className="mt-1 h-px w-8 bg-zinc-800" />
            <nav className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto">
                {PANEL_RAIL_ITEMS.map((item) => {
                    const sales = item.module === "vendas";
                    const meta = sales ? { icon: "dashboard" as const, description: "Vendas do bot" } : BOT_MODULE_META[item.module];
                    const href = sales ? `/dashboard/${storeId}/vendas` : `/dashboard/${storeId}/config/${item.module}`;
                    const active = pathname === href;
                    return (
                        <Link
                            key={item.module}
                            href={href}
                            title={`${item.label} — ${meta.description}`}
                            aria-label={item.label}
                            className={`grid h-10 w-10 place-items-center rounded-xl text-sm transition ${
                                active ? "border border-violet-500/30 bg-violet-500/10 text-violet-300" : "text-zinc-500 hover:bg-zinc-900 hover:text-white"
                            }`}
                        >
                            <Icon name={meta.icon} className="h-4 w-4" />
                        </Link>
                    );
                })}
            </nav>
            <div className="mt-1 flex flex-col items-center gap-2">
                <span title="Status do bot">
                    <BotStatusIndicator storeId={storeId} minimal />
                </span>
                <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    title="Sair"
                    aria-label="Sair"
                    className="grid h-10 w-10 place-items-center rounded-xl text-zinc-500 transition hover:bg-zinc-900 hover:text-white"
                >
                    <UserAvatar user={user} />
                </button>
            </div>
        </aside>
    );
}

function CompactRail({ pathname, user, onExpand }: { pathname: string; user: SidebarUser; onExpand?: () => void }) {
    const items: Array<{ label: string; href: string; icon: SidebarIconName }> = [
        { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
        { label: "Faturas", href: "/dashboard/invoices", icon: "invoice" },
        { label: "Conta", href: "/dashboard/account", icon: "user" },
    ];
    return (
        <aside className="flex h-full flex-col items-center gap-2 bg-background-dark px-2 py-4">
            <Logo compact />
            <button
                type="button"
                onClick={onExpand}
                title="Expandir menu"
                aria-label="Expandir menu"
                className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-800 text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
            >
                <SidebarIcon name="right" className="h-5 w-5" />
            </button>
            <nav className="mt-2 flex flex-1 flex-col gap-1">
                {items.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        aria-label={item.label}
                        className={`grid h-10 w-10 place-items-center rounded-xl transition ${
                            routeIsActive(pathname, item.href) ? "bg-zinc-900 text-white shadow-inner" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                        }`}
                    >
                        <SidebarIcon name={item.icon} className="h-5 w-5" />
                    </Link>
                ))}
            </nav>
            <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                title="Sair"
                aria-label="Sair"
                className="grid h-10 w-10 place-items-center rounded-xl text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
            >
                <SidebarIcon name="logout" className="h-5 w-5" />
                <span className="sr-only">{user.name}</span>
            </button>
        </aside>
    );
}

export function Sidebar({
    user,
    pendingCount = 0,
    canAdmin = false,
    defaultAdminStoreId,
    collapsed = false,
    onToggleCollapsed,
    mobileMenuOpen,
    onSetMobileMenuOpen,
}: {
    user: SidebarUser;
    balance: number;
    pendingCount?: number;
    canAdmin?: boolean;
    defaultAdminStoreId?: string;
    collapsed?: boolean;
    onToggleCollapsed?: () => void;
    mobileMenuOpen?: boolean;
    onSetMobileMenuOpen?: (open: boolean) => void;
}) {
    const pathname = usePathname();
    const [internalOpen, setInternalOpen] = useState(false);
    const open = mobileMenuOpen ?? internalOpen;
    const setOpen = onSetMobileMenuOpen ?? setInternalOpen;
    const admin = pathname.startsWith("/admin") || pathname.startsWith("/sharpify");
    const account = pathname.startsWith("/dashboard/account");
    const currentAdminStoreId = pathname.match(/^\/admin\/(?!settings(?:\/|$))([^/]+)(?:\/|$)/)?.[1];
    const adminStoreId = currentAdminStoreId || defaultAdminStoreId;
    const authLicenseId = pathname.match(/^\/dashboard\/auth\/([^/]+)(?:\/|$)/)?.[1];
    const configStoreId = pathname.match(/^\/dashboard\/([^/]+)\/config(?:\/|$)/)?.[1];
    const selectedBotId = pathname.match(/^\/dashboard\/(?!account(?:\/|$)|invoices(?:\/|$)|store(?:\/|$)|auth(?:\/|$))([^/]+)(?:\/|$)/)?.[1];

    const links: SidebarLink[] = admin
        ? adminStoreId
            ? [
                  { icon: "admin", label: "Todas as lojas", href: "/admin", exact: true },
                  { icon: "user", label: "Usuários do site", href: "/admin/users" },
                  { icon: "dashboard", label: "Visão geral", href: `/admin/${adminStoreId}`, exact: true },
                  { icon: "affiliate", label: "Aplicações", href: `/admin/${adminStoreId}/apps` },
                  { icon: "invoice", label: "Produtos", href: `/admin/${adminStoreId}/products` },
                  { icon: "settings", label: "Cupons", href: `/admin/${adminStoreId}/coupons` },
                  { icon: "dashboard", label: "Carrinhos abertos", href: `/admin/${adminStoreId}/carts` },
                  { icon: "bell", label: "Pagamentos", href: `/admin/${adminStoreId}/payments` },
                  { icon: "invoice", label: "Extrato", href: `/admin/${adminStoreId}/extracts` },
                  { icon: "affiliate", label: "Enviar release", href: `/admin/${adminStoreId}/releases` },
                  { icon: "settings", label: "Sharpify", href: "/sharpify" },
                  { icon: "settings", label: "Configurações", href: "/admin/settings" },
              ]
            : [
                  { icon: "admin", label: "Todas as lojas", href: "/admin", exact: true },
                  { icon: "user", label: "Usuários do site", href: "/admin/users" },
                  { icon: "settings", label: "Sharpify", href: "/sharpify" },
                  { icon: "settings", label: "Configurações", href: "/admin/settings" },
              ]
        : account
        ? [
              { icon: "user", label: "Perfil", href: "/dashboard/account" },
              { icon: "invoice", label: "Faturas", href: "/dashboard/invoices" },
              { icon: "affiliate", label: "Afiliados", href: "/dashboard/account/affiliates", badge: "soon" },
              { icon: "bell", label: "Notificações e app", href: "/dashboard/account/notifications" },
              { icon: "invoice", label: "Extrato", href: "/dashboard/account/extracts" },
          ]
        : authLicenseId
        ? [
              { icon: "left", label: "Minhas aplicações", href: "/dashboard", exact: true, section: "ZUROS Auth" },
              { icon: "dashboard", label: "Overview", href: `/dashboard/auth/${authLicenseId}#overview`, section: "Auth" },
              { icon: "admin", label: "Servidores", href: `/dashboard/auth/${authLicenseId}#servers` },
              { icon: "bell", label: "Mensagem", href: `/dashboard/auth/${authLicenseId}#message` },
              { icon: "user", label: "Verificados", href: `/dashboard/auth/${authLicenseId}#verified` },
              { icon: "settings", label: "Recovery", href: `/dashboard/auth/${authLicenseId}#recovery` },
              { icon: "affiliate", label: "Gifts", href: `/dashboard/auth/${authLicenseId}#gifts` },
              { icon: "settings", label: "Configurações", href: `/dashboard/auth/${authLicenseId}#settings`, section: "Gerenciamento" },
              { icon: "user", label: "Equipe", href: `/dashboard/auth/${authLicenseId}#team` },
              { icon: "settings", label: "Credenciais", href: `/dashboard/auth/${authLicenseId}#credentials` },
              { icon: "admin", label: "Key de integração", href: `/dashboard/auth/${authLicenseId}#integration` },
              { icon: "invoice", label: "Logs", href: `/dashboard/auth/${authLicenseId}#logs`, section: "Monitoramento" },
              { icon: "invoice", label: "Tasks", href: `/dashboard/auth/${authLicenseId}#tasks` },
          ]
        : selectedBotId
        ? [
              { icon: "left", label: "Meus Bots", href: "/dashboard", exact: true, section: "Meus Bots" },
              { icon: "settings", label: "Abrir controles completos", href: `/dashboard/${selectedBotId}?tab=controles`, exact: true },
              { icon: "dashboard", label: "Visão Geral", href: `/dashboard/${selectedBotId}`, exact: true, section: "Principal" },
              { icon: "admin", label: "Servidores", href: `/dashboard/${selectedBotId}/servidores`, exact: true, section: "Gerenciamento" },
              { icon: "invoice", label: "Pedidos", href: `/dashboard/${selectedBotId}/vendas/pedidos`, exact: true },
              { icon: "user", label: "Clientes", href: `/dashboard/${selectedBotId}/vendas/clientes`, exact: true },
              { icon: "invoice", label: "Carrinhos abertos", href: `/dashboard/${selectedBotId}/vendas/carrinhos-abertos`, exact: true },
              { icon: "dashboard", label: "Rendimentos", href: `/dashboard/${selectedBotId}/vendas`, exact: true, section: "Loja" },
              { icon: "invoice", label: "Produtos", href: `/dashboard/${selectedBotId}/vendas/produtos`, exact: true },
              { icon: "settings", label: "Configurar loja", href: `/dashboard/${selectedBotId}/config/loja`, exact: true },
              { icon: "invoice", label: "Pagamentos", href: `/dashboard/${selectedBotId}/vendas/pagamentos`, exact: true },
              { icon: "invoice", label: "Gerenciar tickets", href: `/dashboard/${selectedBotId}/config/tickets`, exact: true, section: "Bot" },
              { icon: "user", label: "Personalização", href: `/dashboard/${selectedBotId}/config/customizacao`, exact: true },
              { icon: "settings", label: "Automações", href: `/dashboard/${selectedBotId}/config/automacoes`, exact: true },
              { icon: "admin", label: "DROX Cloud", href: `/dashboard/${selectedBotId}/config/cloud`, exact: true },
              { icon: "bell", label: "Mensagens", href: `/dashboard/${selectedBotId}/config/mensagens`, exact: true },
              { icon: "admin", label: "Proteção do servidor", href: `/dashboard/${selectedBotId}/config/protecao`, exact: true },
              { icon: "affiliate", label: "Sorteios", href: `/dashboard/${selectedBotId}/config/giveaways`, exact: true },
              { icon: "settings", label: "Configurações", href: `/dashboard/${selectedBotId}/config/configuracoes`, exact: true },
          ]
        : [
              { icon: "dashboard", label: "Dashboard", href: "/dashboard" },
              { icon: "invoice", label: "Faturas", href: "/dashboard/invoices", badge: pendingCount },
              { icon: "settings", label: "Configurações", href: "/dashboard/account" },
          ];

    const headerTitle = admin ? "Administração" : account ? "Minha conta" : authLicenseId ? "ZUROS Auth" : selectedBotId ? "Gerenciar bot" : "Minhas aplicações";

    const FullPanel = (
        <aside className="zuros-sidebar-panel relative flex h-full min-h-0 flex-col overflow-hidden px-3 py-4">
            <button
                type="button"
                onClick={onToggleCollapsed}
                title="Recolher menu"
                aria-label="Recolher menu"
                className="absolute right-2 top-2 hidden h-8 w-8 place-items-center rounded-lg border border-zinc-700 bg-surface text-zinc-300 transition hover:bg-zinc-800 hover:text-white lg:grid"
            >
                <SidebarIcon name="left" />
            </button>

            <div className="hidden lg:block"><Logo /></div>


            <div className={`mt-5 hidden rounded-xl border border-zinc-800 bg-background p-1 lg:grid ${canAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
                <Link href="/dashboard" onClick={() => setOpen(false)} className={`rounded-lg px-2 py-2.5 text-center text-sm transition ${!account && !admin ? "bg-violet-600 text-white shadow-[0_8px_20px_-10px_rgba(124,58,237,.8)]" : "text-zinc-500 hover:text-white"}`}>
                    Apps
                </Link>
                {canAdmin && (
                    <Link href="/admin" onClick={() => setOpen(false)} className={`rounded-lg px-2 py-2.5 text-center text-sm transition ${admin ? "bg-violet-600 text-white" : "text-zinc-500 hover:text-white"}`}>
                        Admin
                    </Link>
                )}
                <Link href="/dashboard/account" onClick={() => setOpen(false)} className={`rounded-lg px-2 py-2.5 text-center text-sm transition ${account ? "bg-violet-600 text-white" : "text-zinc-500 hover:text-white"}`}>
                    Conta
                </Link>
            </div>

            <div className="sidebar-scrollbar mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            {selectedBotId ? <SidebarApplicationControls appId={selectedBotId} /> : null}
            <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[.22em] text-zinc-600">
                {admin ? "Administração" : account ? "Conta" : "Navegação"}
            </p>

            <nav className="space-y-1">
                {links.map((link) => (
                    <div key={link.href}>
                    {link.section ? <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-[.2em] text-zinc-600 first:mt-0">{link.section}</p> : null}
                    <Link
                        onClick={() => setOpen(false)}
                        href={link.href}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition ${
                            (link.exact ? pathname === link.href : routeIsActive(pathname, link.href)) ? "border-violet-500/25 bg-violet-500/10 text-violet-100 shadow-inner" : "border-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-white"
                        }`}
                    >
                        <span className="grid h-5 w-5 shrink-0 place-items-center text-zinc-400">
                            <SidebarIcon name={link.icon} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{link.label}</span>
                        {link.badge === "soon" ? (
                            <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] text-zinc-400">Em breve</span>
                        ) : typeof link.badge === "number" && link.badge > 0 ? (
                            <span className="min-w-5 shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">{link.badge}</span>
                        ) : null}
                    </Link>
                    </div>
                ))}
            </nav>

            {!admin && !account && !selectedBotId && (
                <div className="mt-5 border-t border-zinc-900 pt-4">
                    <BotsNav onNavigate={() => setOpen(false)} />
                </div>
            )}

            {!admin && !account && (
                <div className="mt-5 border-t border-zinc-900 pt-4">
                    <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[.22em] text-zinc-600">Ajuda</p>
                    <Link href={authLicenseId ? `/dashboard/auth/${authLicenseId}` : selectedBotId ? `/dashboard/${selectedBotId}?tour=1` : "/dashboard?tour=1"} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-zinc-500 hover:bg-zinc-900/50 hover:text-white">
                        <SidebarIcon name="tutorial" className="h-4 w-4 shrink-0" />Conheça o painel ZUROS
                    </Link>
                    <Link href="/#beneficios" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-zinc-500 hover:bg-zinc-900/50 hover:text-white">
                        <SidebarIcon name="tutorial" className="h-4 w-4 shrink-0" />Tutoriais
                    </Link>
                    <Link href="/#suporte" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-zinc-500 hover:bg-zinc-900/50 hover:text-white">
                        <SidebarIcon name="help" className="h-4 w-4 shrink-0" />Suporte
                    </Link>
                </div>
            )}
            </div>

            <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                title="Sair da conta"
                aria-label="Sair da conta"
                className="mt-3 flex shrink-0 items-center gap-3 rounded-xl border border-zinc-800 bg-background p-3 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
            >
                <UserAvatar user={user} />
                <span className="min-w-0 flex-1">
                    <b className="block truncate text-xs text-white">{user.name || "Conta"}</b>
                    <small className="block truncate text-[10px] text-zinc-600">{user.email || "Online"}</small>
                </span>
                <SidebarIcon name="logout" className="h-4 w-4 shrink-0 text-zinc-500" />
            </button>
        </aside>
    );

    // Modo foco: enquanto o usuário configura um bot, a barra lateral principal
    // vira uma trilha estreita de ícones para não competir com o editor.
    if (collapsed) {
        if (!configStoreId) {
            return (
                <>
                    <TopHeader leftOffsetClass="lg:left-20" pendingCount={pendingCount} title={headerTitle} />
                    <MobileMenuButton onOpen={() => setOpen(true)} />
                    <div className="fixed bottom-3 left-3 top-3 z-40 hidden w-16 overflow-hidden rounded-2xl border border-white/[.07] bg-black/70 shadow-2xl shadow-black/40 backdrop-blur-xl lg:block">
                        <CompactRail pathname={pathname} user={user} onExpand={onToggleCollapsed} />
                    </div>
                    <MobileDrawer open={open} onClose={() => setOpen(false)}>
                        {FullPanel}
                    </MobileDrawer>
                </>
            );
        }
        return (
            <>
                <TopHeader leftOffsetClass="lg:left-20" pendingCount={pendingCount} title={headerTitle} />
                <MobileMenuButton onOpen={() => setOpen(true)} />
                <div className="fixed bottom-3 left-3 top-3 z-40 hidden w-16 overflow-hidden rounded-2xl border border-white/[.07] bg-black/70 shadow-2xl shadow-black/40 backdrop-blur-xl lg:block">
                    <button
                        type="button"
                        onClick={onToggleCollapsed}
                        title="Expandir menu"
                        aria-label="Expandir menu"
                        className="absolute right-2 top-16 z-50 grid h-8 w-8 place-items-center rounded-lg border border-zinc-700 bg-surface text-zinc-300 hover:text-white"
                    >
                        »
                    </button>
                    <ConfigRail storeId={configStoreId} pathname={pathname} user={user} />
                </div>
                <MobileDrawer open={open} onClose={() => setOpen(false)}>
                    {FullPanel}
                </MobileDrawer>
            </>
        );
    }

    return (
        <>
            <TopHeader leftOffsetClass="lg:left-64" pendingCount={pendingCount} title={headerTitle} />
            <MobileMenuButton onOpen={() => setOpen(true)} />
            <div className="fixed bottom-3 left-3 top-3 z-40 hidden w-60 overflow-hidden rounded-2xl border border-white/[.07] bg-black/70 shadow-2xl shadow-black/40 backdrop-blur-xl lg:block">{FullPanel}</div>
            <MobileDrawer open={open} onClose={() => setOpen(false)}>
                {FullPanel}
            </MobileDrawer>
        </>
    );
}
