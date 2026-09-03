"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "./ui";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

export function DeviceNotificationSettings() {
    const { push } = useToast();
    const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
    const [installable, setInstallable] = useState(false);
    const [standalone, setStandalone] = useState(false);
    const [ios, setIos] = useState(false);

    useEffect(() => {
        setPermission("Notification" in window ? Notification.permission : "unsupported");
        setStandalone(window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
        setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
        const refresh = () => setInstallable(Boolean(window.zurosInstallPrompt));
        refresh();
        window.addEventListener("zuros-install-ready", refresh);
        return () => window.removeEventListener("zuros-install-ready", refresh);
    }, []);

    async function enableNotifications() {
        if (!("Notification" in window) || !("serviceWorker" in navigator)) return push("Este navegador não oferece notificações web.", "error");
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result !== "granted") return push("Permissão de notificações não concedida.", "error");
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification("Notificações ZUROS ativadas", { body: "Este aparelho poderá receber alertas do painel.", icon: "/brand-logo.png", tag: "zuros-enabled" });
        push("Notificações ativadas neste aparelho.");
    }

    async function install() {
        const prompt = window.zurosInstallPrompt;
        if (!prompt) return;
        await prompt.prompt();
        const choice = await prompt.userChoice;
        window.zurosInstallPrompt = undefined;
        setInstallable(false);
        if (choice.outcome === "accepted") push("Aplicativo ZUROS instalado.");
    }

    return (
        <div className="grid gap-4 md:grid-cols-2">
            <Card className="flex flex-col">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon name="apps" /></span>
                <h2 className="mt-4 text-lg font-semibold text-white">Aplicativo ZUROS</h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-zinc-400">Instale o painel no celular para abrir em tela cheia, como um aplicativo.</p>
                {standalone ? <p className="mt-5 text-sm font-medium text-[var(--success)]">✓ Aplicativo instalado neste aparelho</p> : installable ? <Button className="mt-5" onClick={() => void install()}>Instalar aplicativo</Button> : ios ? <div className="mt-5 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-soft)] p-3 text-sm text-zinc-300">No Safari, toque em Compartilhar e depois em <b>Adicionar à Tela de Início</b>.</div> : <p className="mt-5 text-xs text-zinc-500">Abra esta página no Chrome ou Edge para instalar.</p>}
            </Card>
            <Card className="flex flex-col">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><Icon name="bell" /></span>
                <h2 className="mt-4 text-lg font-semibold text-white">Notificações do aparelho</h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-zinc-400">Receba alertas do painel no Android, computador e em iPhones com o app adicionado à tela inicial.</p>
                {permission === "granted" ? <p className="mt-5 text-sm font-medium text-emerald-400">✓ Notificações permitidas</p> : <Button className="mt-5" onClick={() => void enableNotifications()} disabled={permission === "unsupported"}>Ativar notificações</Button>}
            </Card>
        </div>
    );
}