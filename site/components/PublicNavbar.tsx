"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PublicAccountMenu } from "./PublicAccountMenu";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./ThemeToggle";

const NAV_ITEMS = [
    { label: "Início", href: "/" },
    { label: "Planos", href: "/planos" },
    { label: "Sobre", href: "/sobre" },
    { label: "Status", href: "/status" },
    { label: "Dúvidas", href: "/duvidas" },
];

function isActive(pathname: string, href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicNavbar({ user, pendingCount = 0 }: { user?: { name?: string | null; image?: string | null } | null; pendingCount?: number }) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const close = () => setOpen(false);

    return (
        <header className="public-nav-wrap sticky top-0 z-40">
            <div className="px-5 pt-4 sm:px-8 sm:pt-5">
                <div className="public-nav mx-auto flex h-[4.75rem] w-full max-w-7xl items-center justify-between gap-6 px-2 sm:px-4">
                    <Link href="/" onClick={close} aria-label="ZUROS — início" className="public-brand group inline-flex items-center gap-3">
                        <BrandLogo priority className="h-8 w-28 sm:h-9 sm:w-36" />
                        <span className="public-brand-sub hidden border-l border-white/15 pl-3 text-[9px] font-semibold uppercase tracking-[.22em] text-zinc-500 lg:inline">Control room<br />for communities</span>
                    </Link>
                    <nav aria-label="Navegação principal" className="public-nav-links hidden items-center gap-7 md:flex">
                        {NAV_ITEMS.map((item) => <Link key={item.label} href={item.href} className={`public-nav-link ${isActive(pathname, item.href) ? "is-active" : ""}`}>{item.label}</Link>)}
                    </nav>
                    <div className="flex items-center gap-3">
                        <ThemeToggle compact />
                        <Link href="/planos" className="public-nav-mobile-plan hidden border border-white/15 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-[var(--accent)] hover:text-white sm:inline-flex md:hidden">Planos</Link>
                        {user ? <PublicAccountMenu name={user.name} image={user.image} pendingCount={pendingCount} /> : <Link href="/login" className="public-nav-cta">Entrar <span aria-hidden>↗</span></Link>}
                        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="public-mobile-menu" aria-label={open ? "Fechar menu" : "Abrir menu"} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 text-zinc-300 md:hidden">{open ? "×" : "☰"}</button>
                    </div>
                </div>
            </div>
            {open && <div id="public-mobile-menu" className="mx-5 mt-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-2xl md:hidden"><nav aria-label="Navegação móvel" className="grid gap-1">{NAV_ITEMS.map((item) => <Link key={item.label} href={item.href} onClick={close} className={`rounded-xl px-4 py-3 text-sm ${isActive(pathname, item.href) ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"}`}>{item.label}</Link>)}</nav></div>}
        </header>
    );
}
