"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const PIX_POLLING_INTERVAL_MS = 3000;
export const PIX_POLLING_TIMEOUT_MS = 15 * 60 * 1000;

export interface PixPollState {
    status: string;
    step: string;
}

/**
 * Polls a PIX payment cart until it is confirmed, cancelled/expired or times
 * out. Shared by PurchasePaymentPanel and RenewPanel so both flows behave the
 * same (the purchase flow previously never stopped polling and never handled
 * cancelled/expired carts).
 *
 * - `isConfirmed`: return true when the cart reaches a confirmed state.
 * - `isTerminal`: return true when the cart is cancelled/expired.
 * - `onConfirmed` / `onTerminal` / `onTimeout`: called exactly once per poll
 *   session; the caller should stop showing the "waiting" UI there.
 */
export function usePixPolling({
    active,
    poll,
    isConfirmed,
    isTerminal,
    onConfirmed,
    onTerminal,
    onTimeout,
    intervalMs = PIX_POLLING_INTERVAL_MS,
    timeoutMs = PIX_POLLING_TIMEOUT_MS,
}: {
    active: boolean;
    poll: () => Promise<PixPollState | null>;
    isConfirmed: (state: PixPollState) => boolean;
    isTerminal: (state: PixPollState) => boolean;
    onConfirmed: () => void;
    onTerminal: (state: PixPollState) => void;
    onTimeout: () => void;
    intervalMs?: number;
    timeoutMs?: number;
}) {
    const pollRef = useRef(poll);
    const isConfirmedRef = useRef(isConfirmed);
    const isTerminalRef = useRef(isTerminal);
    const onConfirmedRef = useRef(onConfirmed);
    const onTerminalRef = useRef(onTerminal);
    const onTimeoutRef = useRef(onTimeout);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        pollRef.current = poll;
        isConfirmedRef.current = isConfirmed;
        isTerminalRef.current = isTerminal;
        onConfirmedRef.current = onConfirmed;
        onTerminalRef.current = onTerminal;
        onTimeoutRef.current = onTimeout;
    });

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!active) return;
        let disposed = false;

        stopPolling();

        const tick = async () => {
            try {
                const state = await pollRef.current();
                if (disposed || !state) return;
                if (isConfirmedRef.current(state)) {
                    stopPolling();
                    onConfirmedRef.current();
                } else if (isTerminalRef.current(state)) {
                    stopPolling();
                    onTerminalRef.current(state);
                }
            } catch {
                // erros transitórios: tenta novamente no próximo tick
            }
        };

        void tick();
        intervalRef.current = setInterval(tick, intervalMs);
        timeoutRef.current = setTimeout(() => {
            if (disposed) return;
            stopPolling();
            onTimeoutRef.current();
        }, timeoutMs);

        return () => {
            disposed = true;
            stopPolling();
        };
    }, [active, intervalMs, timeoutMs, stopPolling]);

    return { stopPolling };
}

/** Copia o código PIX e controla o estado "copiado" com mensagem temporária. */
export function useCopyPixCode() {
    const [copied, setCopied] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const copy = useCallback(async (code: string) => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), 2000);
    }, []);

    return { copied, copy };
}
