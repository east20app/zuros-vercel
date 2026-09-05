"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { reorderProduct, setProductStorefront } from "@/lib/actions/admin.actions";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "./Toast";

export function ProductStorefrontControls({
    productId,
    featured,
    comingSoon,
    isFirst,
    isLast,
}: {
    productId: string;
    featured: boolean;
    comingSoon: boolean;
    isFirst: boolean;
    isLast: boolean;
}) {
    const router = useRouter();
    const { push } = useToast();
    const [pending, startTransition] = useTransition();

    function run(action: () => Promise<unknown>, message: string) {
        startTransition(async () => {
            try {
                await action();
                push(message);
                router.refresh();
            } catch (error) {
                push(getErrorMessage(error, "Não foi possível atualizar a vitrine."), "error");
            }
        });
    }

    const arrow = "grid h-7 w-7 place-items-center rounded-md border border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--accent)]/40 hover:bg-[var(--accent-soft)] hover:text-white disabled:cursor-not-allowed disabled:opacity-30";

    return (
        <span className="inline-flex items-center gap-1.5">
            <button
                type="button"
                title="Mover para cima"
                aria-label="Mover para cima"
                className={arrow}
                disabled={isFirst || pending}
                onClick={() => run(() => reorderProduct(productId, "up"), "Produto movido para cima.")}
            >
                ↑
            </button>
            <button
                type="button"
                title="Mover para baixo"
                aria-label="Mover para baixo"
                className={arrow}
                disabled={isLast || pending}
                onClick={() => run(() => reorderProduct(productId, "down"), "Produto movido para baixo.")}
            >
                ↓
            </button>
            <button
                type="button"
                title="Marcar como destaque (posição central na página de planos)"
                aria-label="Alternar destaque"
                className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    featured
                        ? "border-[var(--accent)]/50 bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                        : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-white"
                }`}
                disabled={pending}
                onClick={() => run(() => setProductStorefront(productId, { featured: !featured }), featured ? "Destaque removido." : "Produto em destaque.")}
            >
                ★ Destaque
            </button>
            <button
                type="button"
                title="Marcar como 'Em breve' (aparece na página de planos sem compra)"
                aria-label="Alternar em breve"
                className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    comingSoon
                        ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                        : "border-[var(--border)] text-[var(--muted)] hover:border-amber-400/40 hover:text-amber-300"
                }`}
                disabled={pending}
                onClick={() => run(() => setProductStorefront(productId, { comingSoon: !comingSoon }), comingSoon ? "Em breve removido." : "Produto marcado como em breve.")}
            >
                Em breve
            </button>
        </span>
    );
}