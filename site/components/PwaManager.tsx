"use client";

import { useEffect } from "react";

declare global {
    interface Window { zurosInstallPrompt?: Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }; }
}

export default function PwaManager() {
    useEffect(() => {
        if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const capture = (event: Event) => {
            window.zurosInstallPrompt = event as Window["zurosInstallPrompt"];
            window.dispatchEvent(new Event("zuros-install-ready"));
        };
        window.addEventListener("beforeinstallprompt", capture);
        return () => window.removeEventListener("beforeinstallprompt", capture);
    }, []);
    return null;
}