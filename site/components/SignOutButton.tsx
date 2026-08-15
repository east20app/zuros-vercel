"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
    return (
        <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-900/70 hover:text-white"
        >
            Sair
        </button>
    );
}
