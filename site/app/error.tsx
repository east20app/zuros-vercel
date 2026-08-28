"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => { console.error("[PAGE] Falha ao renderizar página", { digest: error.digest }); }, [error]);
    return (
        <main className="grid min-h-[70vh] place-items-center px-5 py-12">
            <Card className="w-full max-w-lg text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-red-500/25 bg-red-500/10 text-2xl text-red-300">!</div>
                <h1 className="mt-5 text-xl font-semibold text-white">Não foi possível abrir esta página</h1>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Tente carregar novamente. Se o problema continuar, use o código abaixo ao falar com o suporte.</p>
                {error.digest ? <code className="mt-4 inline-block rounded-lg border border-white/[.08] bg-black/25 px-3 py-2 text-xs text-zinc-400">Código: {error.digest}</code> : null}
                <div className="mt-6 flex flex-wrap justify-center gap-2"><Button onClick={reset}>Tentar novamente</Button><Button href="/" variant="secondary">Página inicial</Button></div>
            </Card>
        </main>
    );
}
