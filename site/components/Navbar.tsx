import Link from "next/link";
import { getSessionUser } from "@/lib/require-admin";
import { getStoresForUser } from "@/lib/actions/context";
import { SignOutButton } from "./SignOutButton";
import Image from "next/image";

export async function Navbar() {
    const user = await getSessionUser();
    const hasStores = user ? (await getStoresForUser(user.discordId)).length > 0 : false;

    return (
        <header className="sticky top-0 z-40 border-b border-zinc-900/80 bg-black/80 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-12">
                <Link href={user ? "/dashboard" : "/"} className="group flex items-center gap-2 text-sm font-bold tracking-tight">
                    <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/20 to-transparent text-emerald-400 shadow-[0_0_20px_-6px_rgba(16,185,129,.6)] transition group-hover:shadow-[0_0_26px_-4px_rgba(16,185,129,.8)]">Z</span> ZUROS <span className="text-zinc-500">APP</span>
                </Link>

                <div className="flex items-center gap-2">
                    {user ? (
                        <>
                            {hasStores && (
                                <Link
                                    href="/admin"
                                    className="rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900/70 hover:text-white"
                                >
                                    Admin
                                </Link>
                            )}
                            <Link
                                href="/dashboard"
                                className="rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900/70 hover:text-white"
                            >
                                Dashboard
                            </Link>
                            <div className="flex items-center gap-2 rounded-lg bg-zinc-900/80 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
                                {user.image && (
                                    <Image
                                        src={user.image}
                                        alt={`Avatar de ${user.name || "usuário"}`}
                                        width={20}
                                        height={20}
                                        unoptimized
                                        className="h-5 w-5 rounded-full ring-1 ring-emerald-500/30"
                                        referrerPolicy="no-referrer"
                                    />
                                )}
                                <span className="text-sm text-zinc-300">{user.name}</span>
                            </div>
                            <SignOutButton />
                        </>
                    ) : (
                        <Link
                            href="/login"
                            className="rounded-full bg-gradient-to-b from-white to-zinc-300 px-5 py-2 text-sm font-semibold text-black shadow-[0_8px_22px_-10px_rgba(255,255,255,.5)] transition hover:brightness-95 hover:-translate-y-px"
                        >
                            Entrar
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
