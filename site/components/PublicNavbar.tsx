"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PublicAccountMenu } from "./PublicAccountMenu";
import { BrandLogo } from "./BrandLogo";

const NAV_ITEMS = [
    { label: "Início", href: "/" },
    { label: "Planos", href: "/planos" },
    { label: "Recursos", href: "/#beneficios" },
    { label: "Suporte", href: "/#suporte" },
];

function isActive(pathname: string, href: string): boolean {
    if (href === "/") return pathname === "/";
    if (href.startsWith("/#")) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicNavbar({ user, pendingCount = 0 }: { user?: { name?: string | null; image?: string | null } | null; pendingCount?: number }) {
    const pathname = usePathname();

    return (
        <header className="public-nav-wrap sticky top-0 z-40">
            <div className="public-announcement border-b border-white/[.06] bg-[#09090b]/90 px-5 py-2 text-center text-[.68rem] tracking-[.02em] text-zinc-400 sm:px-8">
                <span className="public-announcement-dot" aria-hidden="true" />
                <span>Operação Discord mais simples, do primeiro clique ao painel</span>
                <Link href="/#beneficios" className="public-announcement-link">Conhecer recursos <span aria-hidden="true">↗</span></Link>
            </div>
            <div className="px-5 pt-4 sm:px-8 sm:pt-5">
              <div className="public-nav mx-auto flex h-[4.5rem] w-full max-w-7xl items-center justify-between gap-6">
                <Link href="/" aria-label="ZUROS — início" className="public-brand group inline-flex items-center gap-3">
                    <BrandLogo priority className="h-8 w-28 sm:h-9 sm:w-36" />
                    <span className="public-brand-sub hidden border-l border-white/15 pl-3 text-[9px] font-semibold uppercase tracking-[.22em] text-zinc-500 lg:inline">Control room<br />for communities</span>
                </Link>
                <nav aria-label="Navegação principal" className="public-nav-links hidden items-center gap-7 md:flex">
                    {NAV_ITEMS.map((item) => <Link key={item.label} href={item.href} className={`public-nav-link ${isActive(pathname, item.href) ? "is-active" : ""}`}>{item.label}</Link>)}
                </nav>
                <div className="flex items-center gap-3">
                    <Link href="/planos" className="public-nav-mobile-plan hidden rounded-full border border-white/15 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-[var(--accent)] hover:text-white sm:inline-flex md:hidden">Planos</Link>
                    {user ? <PublicAccountMenu name={user.name} image={user.image} pendingCount={pendingCount} /> : <Link href="/login" className="public-nav-cta">Entrar <span aria-hidden>↗</span></Link>}
                </div>
              </div>
            </div>
        </header>
    );
}
