"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ConfigError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => { console.error("[config-route-error]", error.digest || error.name); }, [error]);
    return <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-5 text-center"><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-400">Configuração temporariamente indisponível</p><h1 className="text-2xl font-semibold text-white">Não foi possível abrir este módulo.</h1><p className="text-sm text-zinc-400">O bot pode estar offline ou a conexão com o serviço demorou. Tente novamente sem perder suas configurações.</p><div className="flex flex-wrap justify-center gap-3"><button type="button" onClick={() => reset()} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Tentar novamente</button><Link href="/dashboard" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--foreground)]">Voltar ao dashboard</Link></div></main>;
}
