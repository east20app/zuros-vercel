"use client";

import { useEffect } from "react";
import { Button } from "./ui";

export function LoadingState() {
    return (
        <div className="mx-auto max-w-7xl px-5 py-10" aria-label="Carregando">
            <div className="space-y-2">
                <div className="skeleton h-8 w-56 rounded-lg" />
                <div className="skeleton h-4 w-80 max-w-full rounded-lg" />
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="zuros-card zuros-card-lit flex flex-col gap-3 p-5">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-start gap-3">
                                <span className="skeleton h-11 w-11 rounded-xl" />
                                <div className="flex-1 space-y-2">
                                    <div className="skeleton h-4 w-3/5 rounded-lg" />
                                    <div className="skeleton h-3 w-4/5 rounded-lg" />
                                </div>
                            </div>
                            <span className="skeleton h-5 w-14 rounded-full" />
                        </div>
                        <div className="skeleton h-16 rounded-xl" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ErrorState({
    error,
    reset,
    message = "Ocorreu um erro inesperado ao carregar esta página.",
}: {
    error?: Error & { digest?: string };
    reset?: () => void;
    message?: string;
}) {
    useEffect(() => {
        if (error) console.error(error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <h2 className="text-lg font-semibold text-white">Algo deu errado.</h2>
            <p className="text-sm text-zinc-500">{message}</p>
            {reset && (
                <Button variant="outline" onClick={reset}>
                    Tentar novamente
                </Button>
            )}
        </div>
    );
}
