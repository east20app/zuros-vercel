"use client";

import { useEffect } from "react";

const RELOAD_KEY = "zuros:chunk-recovery";
const RELOAD_WINDOW_MS = 30_000;

function isOutdatedAssetError(value: unknown) {
    const error = value instanceof Error ? value : null;
    const message = error ? `${error.name} ${error.message}\n${error.stack || ""}` : String(value ?? "");
    return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|stylesheet.*(?:failed|not found)|Cannot find module.*(?:vendor-chunks|\.next-dev)|Cannot read properties of undefined \(reading ['"]call['"]\)|options\.factory/i.test(message);
}

export default function ChunkRecovery() {
    useEffect(() => {
        const reloadOnce = (reason: unknown) => {
            if (!isOutdatedAssetError(reason)) return;
            const previousReload = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
            if (Date.now() - previousReload < RELOAD_WINDOW_MS) return;
            sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
            // A cache-busting query prevents the browser from reusing the HTML
            // that points at the stale development module graph.
            const url = new URL(window.location.href);
            url.searchParams.set("__chunk_recovery", String(Date.now()));
            window.location.replace(url);
        };

        const onError = (event: ErrorEvent) => reloadOnce(event.error || event.message);
        const onRejection = (event: PromiseRejectionEvent) => reloadOnce(event.reason);
        window.addEventListener("error", onError);
        window.addEventListener("unhandledrejection", onRejection);
        return () => {
            window.removeEventListener("error", onError);
            window.removeEventListener("unhandledrejection", onRejection);
        };
    }, []);

    return null;
}
