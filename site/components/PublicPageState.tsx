import Link from "next/link";

export function PublicPageLoading() {
    return <main className="relative grid min-h-screen place-items-center px-5 text-center" aria-busy="true" aria-live="polite"><div className="zuros-backdrop" aria-hidden /><div className="relative"><span className="mx-auto block h-10 w-10 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-400" aria-hidden /><p className="mt-4 text-sm text-zinc-400">Carregando conteúdo…</p></div></main>;
}

export function PublicPageError({ reset }: { reset: () => void }) {
    return <main className="relative grid min-h-screen place-items-center px-5 text-center"><div className="zuros-backdrop" aria-hidden /><div className="zuros-card relative max-w-md p-8"><h1 className="text-2xl font-semibold text-white">Não foi possível carregar esta página</h1><p className="mt-3 text-sm leading-6 text-zinc-400">Tente novamente. Se o problema continuar, volte ao início ou fale com o suporte.</p><div className="mt-6 flex justify-center gap-3"><button type="button" onClick={reset} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black">Tentar novamente</button><Link href="/" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300">Ir ao início</Link></div></div></main>;
}
