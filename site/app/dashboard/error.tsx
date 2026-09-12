"use client";

import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    console.error("[dashboard] Falha ao renderizar Server Component", { digest: error.digest });
    return (
        <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
            <p className="home-section-index">DASHBOARD / ERRO TEMPORÁRIO</p>
            <h1 className="mt-3 text-2xl font-semibold text-white">Não foi possível carregar o painel</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-400">Uma consulta do painel falhou. Tente novamente; nenhum dado foi alterado.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => reset()} className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] transition hover:brightness-110">Tentar novamente</button>
                <Link href="/dashboard" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/[.06]">Voltar ao início</Link>
            </div>
        </main>
    );
}
