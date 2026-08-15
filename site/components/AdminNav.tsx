"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StoreView } from "@/lib/types";

const tabs = [
    { href: "", label: "Visão geral" },
    { href: "/apps", label: "Aplicações" },
    { href: "/products", label: "Produtos" },
    { href: "/coupons", label: "Cupons" },
    { href: "/carts", label: "Carrinhos abertos" },
    { href: "/payments", label: "Pagamentos" },
    { href: "/extracts", label: "Extrato" },
    { href: "/releases", label: "Enviar release" },
    { href: "/settings", label: "Configurações da loja" },
];

export function AdminNav({ stores, storeId }: { stores: StoreView[]; storeId: string }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Loja</span>
                <div className="flex flex-wrap gap-1.5">
                    {stores.map((store) => (
                        <Link
                            key={store.id}
                            href={`/admin/${store.id}`}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium shadow-[inset_0_1px_0_rgba(255,255,255,.06)] transition ${
                                store.id === storeId
                                    ? "bg-gradient-to-b from-emerald-400 to-emerald-600 text-black shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)]"
                                    : "bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800"
                            }`}
                        >
                            {store.name}
                        </Link>
                    ))}
                </div>
                <Link
                    href="/admin/settings"
                    className="ml-auto rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-900/70 hover:text-white"
                >
                    Configurações
                </Link>
            </div>

            <nav className="flex flex-wrap gap-1 border-b border-zinc-800/80">
                {tabs.map((tab) => {
                    const href = `/admin/${storeId}${tab.href}`;
                    const active = pathname === href || (tab.href !== "" && pathname.startsWith(href));
                    return (
                        <Link
                            key={tab.href}
                            href={href}
                            className={`border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
                                active
                                    ? "border-emerald-400 text-white shadow-[inset_0_-8px_12px_-10px_rgba(16,185,129,.6)]"
                                    : "border-transparent text-zinc-500 hover:text-zinc-200"
                            }`}
                        >
                            {tab.label}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
