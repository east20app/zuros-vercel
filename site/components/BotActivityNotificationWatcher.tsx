"use client";
import { useEffect } from "react";
import { getBotActivityNotifications } from "@/lib/actions/notifications.actions";

const STORAGE_KEY = "zuros-seen-bot-activity-v1";
export function BotActivityNotificationWatcher() {
    useEffect(() => {
        let active = true;
        async function poll() {
            try {
                const items = await getBotActivityNotifications(); if (!active) return;
                const saved = localStorage.getItem(STORAGE_KEY); const seen = new Set<string>(saved ? JSON.parse(saved) as string[] : []);
                if (!saved) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map((item)=>item.id).slice(0,300))); return; }
                const fresh = items.filter((item)=>!seen.has(item.id)).sort((a,b)=>a.createdAt-b.createdAt);
                for (const item of fresh) {
                    seen.add(item.id);
                    if (Notification.permission === "granted") {
                        const registration = await navigator.serviceWorker?.ready.catch(()=>null);
                        if (registration) await registration.showNotification(item.title, { body: item.body, icon: "/brand-mark.webp", badge: "/brand-mark.webp", tag: item.id, data: { url: item.href } });
                        else new Notification(item.title, { body: item.body, icon: "/brand-mark.webp", tag: item.id });
                    }
                    window.dispatchEvent(new CustomEvent("zuros:bot-activity", { detail: item }));
                }
                localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(seen).slice(-300)));
            } catch { /* polling volta a tentar; não interrompe o painel */ }
        }
        void poll(); const timer = window.setInterval(()=>void poll(), 20_000);
        const onVisible = () => { if (document.visibilityState === "visible") void poll(); };
        document.addEventListener("visibilitychange", onVisible);
        return () => { active=false; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
    }, []);
    return null;
}