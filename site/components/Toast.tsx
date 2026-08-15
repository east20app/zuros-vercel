"use client";

import { createContext, useCallback, useContext, useState, useRef } from "react";
import { Icon } from "./Icon";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
    id: number;
    message: string;
    kind: ToastKind;
}

interface ToastContextValue {
    push: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue>({ push: () => {} });

export const useToast = () => useContext(ToastContext);

const DISMISS_MS: Record<ToastKind, number> = {
    success: 4000,
    info: 4000,
    error: 8000,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const counter = useRef(0);

    const dismiss = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const push = useCallback((message: string, kind: ToastKind = "success") => {
        const id = ++counter.current;
        setToasts((prev) => [...prev, { id, message, kind }]);
        setTimeout(() => dismiss(id), DISMISS_MS[kind]);
    }, [dismiss]);

    return (
        <ToastContext.Provider value={{ push }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        role={toast.kind === "error" ? "alert" : "status"}
                        className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-[0_20px_60px_-20px_rgba(0,0,0,.9)] backdrop-blur animate-toast-in ${
                            toast.kind === "success"
                                ? "border-emerald-500/40 bg-emerald-950/85 text-emerald-200"
                                : toast.kind === "error"
                                  ? "border-red-500/40 bg-red-950/85 text-red-200"
                                  : "border-zinc-600 bg-zinc-900/90 text-zinc-200"
                        }`}
                    >
                        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${toast.kind === "success" ? "bg-emerald-500/20 text-emerald-300" : toast.kind === "error" ? "bg-red-500/20 text-red-300" : "bg-zinc-600/30 text-zinc-300"}`}><Icon name={toast.kind === "success" ? "check" : toast.kind === "error" ? "alert" : "info"} className="h-3 w-3" /></span>
                        <span className="min-w-0 flex-1">{toast.message}</span>
                        <button
                            type="button"
                            onClick={() => dismiss(toast.id)}
                            aria-label="Fechar notificação"
                            className="shrink-0 grid h-5 w-5 place-items-center rounded-full text-current opacity-60 transition hover:bg-white/10 hover:opacity-100"
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
