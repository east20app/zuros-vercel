"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

const steps = [
    { title: "Suas aplicações", text: "Aqui você acompanha todos os seus bots, o estado de cada aplicação e os avisos importantes." },
    { title: "Renovar plano", text: "Acompanhe a validade e renove o plano do seu bot sem interromper o serviço." },
    { title: "Configurar bot", text: "Altere token, nome, servidor principal e os controles da aplicação." },
    { title: "Token do bot", text: "Configure o token do seu próprio bot para ativar os recursos do painel." },
    { title: "Proteção", text: "Ative as proteções do servidor: anti-fake, bloqueios, privatizações e monitoramento." },
    { title: "Canais", text: "Defina os canais usados em logs, vendas, verificações e mensagens do servidor." },
    { title: "Cargos", text: "Escolha os cargos utilizados pelo bot diretamente da lista do seu servidor." },
    { title: "Boas-vindas", text: "Personalize a mensagem recebida pelos novos membros do servidor." },
    { title: "Automações", text: "Configure mensagens, reações, repostagens e outras ações automáticas do bot." },
] as const;

export function DashboardOnboarding() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [step, setStep] = useState<number | null>(null);
    useEffect(() => {
        const purchased = sessionStorage.getItem("zuros-new-purchase-tour") === "pending";
        if (purchased) sessionStorage.removeItem("zuros-new-purchase-tour");
        if (purchased || searchParams.get("tour") === "1") setStep(0);
    }, [searchParams]);
    if (step === null) return null;
    const current = steps[step];
    const close = () => { localStorage.setItem("zuros-dashboard-tour-v1", "done"); setStep(null); };
    return <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="zuros-tour-title">
        <div className="dashboard-tour fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] mx-auto max-w-xl p-5 sm:bottom-8 sm:p-6">
            <button onClick={close} className="absolute right-4 top-3 text-2xl text-zinc-500 hover:text-white" aria-label="Fechar tutorial">×</button>
            <p className="home-section-index mb-2">Conheça o painel ZUROS</p>
            <h2 id="zuros-tour-title" className="pr-8 text-xl font-bold text-white">{current.title}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{current.text}</p>
            <div className="mt-6 flex items-center justify-between gap-3"><span className="text-sm text-zinc-600">{step + 1} de {steps.length}</span><div className="flex gap-2"><button disabled={step === 0} onClick={() => setStep((value) => Math.max(0, (value ?? 0) - 1))} className="dashboard-tour-back">← Voltar</button>{step < steps.length - 1 ? <button onClick={() => setStep((value) => Math.min(steps.length - 1, (value ?? 0) + 1))} className="dashboard-tour-next">Próximo <span>→</span></button> : <button onClick={close} className="dashboard-tour-next">Concluir <span>↗</span></button>}</div></div>
            {pathname === "/dashboard" && step === 2 ? <Link onClick={close} href="/dashboard" className="mt-4 block text-xs text-[var(--accent-strong)] underline">Abrir minhas aplicações</Link> : null}
        </div>
    </div>;
}

export function MobileDashboardNav({ onOpenMenu }: { onOpenMenu?: () => void } = {}) {
    const pathname = usePathname();
    const applicationId = pathname.match(/^\/dashboard\/(?!account(?:\/|$)|invoices(?:\/|$)|store(?:\/|$)|auth(?:\/|$))([^/]+)(?:\/|$)/)?.[1];
    const shortcuts = applicationId ? [
        { href: `/dashboard/${applicationId}`, label: "Início", icon: "dashboard" as const, active: pathname === `/dashboard/${applicationId}` },
        { href: `/dashboard/${applicationId}/vendas`, label: "Loja", icon: "payment" as const, active: pathname.startsWith(`/dashboard/${applicationId}/vendas`) },
        { href: `/dashboard/${applicationId}/config`, label: "Configurar", icon: "settings" as const, active: pathname.startsWith(`/dashboard/${applicationId}/config`) },
    ] : [
        { href: "/dashboard", label: "Aplicações", icon: "apps" as const, active: pathname === "/dashboard" },
        { href: "/dashboard/invoices", label: "Faturas", icon: "invoice" as const, active: pathname.startsWith("/dashboard/invoices") },
        { href: "/dashboard/account", label: "Conta", icon: "user" as const, active: pathname.startsWith("/dashboard/account") },
    ];
    return <nav className="mobile-dashboard-nav fixed inset-x-0 bottom-0 z-50 pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Navegação principal">
        <div className="mx-auto grid h-16 max-w-lg grid-cols-4 items-stretch px-2">
            {shortcuts.map((item) => <Link key={item.href} href={item.href} className={`mobile-nav-link ${item.active ? "is-active" : ""}`}><Icon name={item.icon} className="h-[18px] w-[18px]" /><span>{item.label}</span></Link>)}
            <button type="button" onClick={onOpenMenu} className="mobile-nav-link"><Icon name="menu" className="h-[18px] w-[18px]" /><span>Menu</span></button>
        </div>
    </nav>;
}
