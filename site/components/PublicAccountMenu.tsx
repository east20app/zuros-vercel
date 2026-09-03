"use client";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
export function PublicAccountMenu({ name, image, pendingCount }: { name?: string | null; image?: string | null; pendingCount: number }) {
    const [open, setOpen] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setAvatarFailed(false); }, [image]);

    useEffect(() => {
        if (!open) return;
        function onPointerDown(event: MouseEvent | TouchEvent) {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        }
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("touchstart", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("touchstart", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    return <div className="relative" ref={rootRef}><button type="button" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open} aria-label="Menu da conta" className="flex h-11 items-center gap-2 rounded-full border border-white/[.08] bg-zinc-950 p-1.5 pr-3 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,.03)] transition hover:border-zinc-700">{image && !avatarFailed ? <Image unoptimized priority referrerPolicy="no-referrer" src={image} width={30} height={30} alt={`Avatar de ${name || "usuário"}`} className="h-[30px] w-[30px] shrink-0 rounded-full object-cover ring-2 ring-[var(--accent)]/25" onError={() => setAvatarFailed(true)} /> : <span aria-hidden className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[var(--accent)] font-bold text-white">{(name || "Z")[0].toUpperCase()}</span>}{pendingCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-1 text-[10px] font-bold text-black shadow-[0_0_12px_-2px_rgba(245,158,11,.7)]">{pendingCount}</span>}<span className="text-zinc-500">⌄</span></button>{open && <div role="menu" aria-label="Menu da conta" className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-zinc-800/80 bg-zinc-950 p-1.5 shadow-2xl animate-fade-up"><Link href="/dashboard" role="menuitem" onClick={() => setOpen(false)} className="flex min-h-10 items-center rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-white">Ir para dashboard</Link><button role="menuitem" onClick={() => signOut({callbackUrl:"/"})} className="flex min-h-10 w-full items-center rounded-lg px-3 py-2 text-left text-sm text-red-400 transition hover:bg-red-500/10">Sair</button></div>}</div>;
}
