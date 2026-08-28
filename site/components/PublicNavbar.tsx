"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PillTabs } from "./ui";
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
    return <header className="sticky top-0 z-40 px-3 py-3 sm:px-5"><div className="relative mx-auto grid h-16 max-w-5xl grid-cols-2 items-center rounded-2xl border border-white/[.07] bg-black/75 px-4 shadow-[0_20px_60px_-30px_rgba(0,0,0,.95)] backdrop-blur-2xl sm:px-5 md:grid-cols-3"><span aria-hidden className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" /><span aria-hidden className="pointer-events-none absolute inset-x-20 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-500/70 to-transparent" /><Link href="/" aria-label="ZUROS — início" className="relative inline-flex"><BrandLogo priority className="h-9 w-28 sm:w-36" /></Link><PillTabs className="relative hidden justify-self-center border-0 bg-white/[.035] md:inline-flex" items={NAV_ITEMS.map((item) => ({ ...item, active: isActive(pathname, item.href) }))} /><div className="relative flex items-center gap-2 justify-self-end"><Link href="/planos" className="inline-flex h-10 items-center rounded-lg border border-white/[.08] bg-white/[.035] px-3 text-xs font-medium text-zinc-300 hover:bg-white/[.07] hover:text-white md:hidden">Planos</Link>{user ? <PublicAccountMenu name={user.name} image={user.image} pendingCount={pendingCount} /> : <Link href="/login" className="inline-flex h-10 items-center rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white shadow-[0_8px_22px_-10px_rgba(124,58,237,.65)] transition hover:-translate-y-px hover:bg-violet-500">Entrar</Link>}</div></div></header>
}
