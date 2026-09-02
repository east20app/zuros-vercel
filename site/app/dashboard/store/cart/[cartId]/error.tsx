"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function PaymentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error("Erro no checkout ZUROS", { message: error.message, digest: error.digest });
    }, [error]);

    return (
        <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 py-16 text-center">
            <div className="mb-6 grid h-12 w-12 place-items-center rounded-full border border-red-500/30 bg-red-500/10 text-red-300">!</div>
            <h1 className="text-2xl font-semibold text-white">Não foi possível abrir o pagamento</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">O carrinho não pôde ser carregado. Tente novamente ou volte aos planos para criar um novo pagamento.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => reset()} className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500">Tentar novamente</button>
                <Link href="/planos" className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:border-white/30">Voltar aos planos</Link>
            </div>
        </main>
    );
}
