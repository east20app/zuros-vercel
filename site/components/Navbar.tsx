import Link from "next/link";
import { getSessionUser } from "@/lib/require-admin";
import { getStoresForUser } from "@/lib/actions/context";
import { SignOutButton } from "./SignOutButton";
import Image from "next/image";
import { BrandLogo } from "./BrandLogo";

export async function Navbar() {
    const user = await getSessionUser();
    const hasStores = user ? (await getStoresForUser(user.discordId)).length > 0 : false;

    return (
        <header className="sticky top-0 z-40 border-b border-zinc-900/80 bg-black/80 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-12">
                <Link href={user ? "/dashboard" : "/"} aria-label="ZUROS" className="inline-flex">
                    <BrandLogo priority className="h-9 w-36" />
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
                                        className="h-5 w-5 rounded-full ring-1 ring-violet-500/40"
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
