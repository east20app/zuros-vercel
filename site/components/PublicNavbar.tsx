"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PillTabs } from "./ui";
import { PublicAccountMenu } from "./PublicAccountMenu";

const NAV_ITEMS = [
    { label: "Início", href: "/" },
    { label: "Planos", href: "/planos" },
    { label: "Recursos", href: "/#beneficios" },
    { label: "Suporte", href: "/#suporte" },
];

function isActive(pathname: string, href: string): boolean {
    if (href === "/") return pathname === "/";
    if (href.startsWith("/#")) return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicNavbar({ user, pendingCount = 0 }: { user?: { name?: string | null; image?: string | null } | null; pendingCount?: number }) {
    const pathname = usePathname();
    return <header className="sticky top-0 z-40 border-b border-zinc-800/60 bg-[#030305]/80 backdrop-blur-xl"><div className="mx-auto grid h-16 max-w-6xl grid-cols-2 items-center px-4 sm:px-6 md:grid-cols-3"><Link href="/" className="group flex items-center gap-2.5 text-sm font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-500/25 bg-emerald-500/[.10] text-emerald-400 shadow-[0_0_20px_-7px_rgba(16,185,129,.8)]">Z</span><span className="hidden sm:block">ZUROS APP<small className="block text-[9px] font-normal tracking-widest text-zinc-600">APPLICATIONS</small></span></Link><PillTabs className="hidden justify-self-center md:inline-flex" items={NAV_ITEMS.map((item) => ({ ...item, active: isActive(pathname, item.href) }))} /><div className="justify-self-end">{user ? <PublicAccountMenu name={user.name} image={user.image} pendingCount={pendingCount} /> : <Link href="/login" className="rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-600 px-5 py-2 text-sm font-semibold text-black shadow-[0_8px_22px_-10px_rgba(16,185,129,.65)] transition hover:-translate-y-px hover:from-emerald-300 hover:to-emerald-500">Entrar</Link>}</div></div></header>;
}
