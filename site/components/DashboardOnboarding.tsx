"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

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
    <div className="fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] mx-auto max-w-xl rounded-2xl border border-violet-500/55 bg-[#0d0d10] p-5 shadow-[0_24px_80px_rgba(0,0,0,.8),0_0_36px_rgba(124,58,237,.12)] sm:bottom-8 sm:p-6">
      <button onClick={close} className="absolute right-4 top-3 text-2xl text-zinc-500 hover:text-white" aria-label="Fechar tutorial">×</button>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.2em] text-violet-400">Conheça o painel ZUROS</p>
      <h2 id="zuros-tour-title" className="pr-8 text-xl font-bold text-white">{current.title}</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-400">{current.text}</p>
      <div className="mt-6 flex items-center justify-between gap-3">
        <span className="text-sm text-zinc-600">{step + 1} de {steps.length}</span>
        <div className="flex gap-2">
          <button disabled={step === 0} onClick={() => setStep((value) => Math.max(0, (value ?? 0) - 1))} className="rounded-xl border border-violet-500/30 bg-violet-950/50 px-4 py-2.5 text-sm font-semibold text-violet-200 disabled:opacity-35">← Voltar</button>
          {step < steps.length - 1 ? <button onClick={() => setStep((value) => Math.min(steps.length - 1, (value ?? 0) + 1))} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/50 hover:bg-violet-500">Próximo →</button> : <button onClick={close} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500">Concluir</button>}
        </div>
      </div>
      {pathname === "/dashboard" && step === 2 ? <Link onClick={close} href="/dashboard" className="mt-4 block text-xs text-violet-400 underline">Abrir minhas aplicações</Link> : null}
    </div>
  </div>;
}

export function MobileDashboardNav({ onOpenMenu }: { onOpenMenu?: () => void } = {}) {
  const pathname = usePathname();
  return <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[.08] bg-black/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Navegação principal">
    <div className="mx-auto grid h-20 max-w-md grid-cols-3 items-center px-8">
      <Link href="/dashboard" className={`flex flex-col items-center gap-1 text-xs ${pathname === "/dashboard" ? "text-violet-400" : "text-zinc-500"}`}><span className="text-2xl">⌂</span>Meus bots</Link>
      <Link href="/dashboard" aria-label="Aplicações" className="mx-auto grid h-16 w-16 -translate-y-3 place-items-center rounded-full border border-violet-400/30 bg-violet-600 text-2xl text-white shadow-[0_0_30px_rgba(124,58,237,.45)]">⌁</Link>
      <button type="button" onClick={onOpenMenu} className={`flex flex-col items-center gap-1 text-xs ${pathname.startsWith("/dashboard/account") ? "text-violet-400" : "text-zinc-500"}`}><span className="text-2xl">☰</span>Menu</button>
    </div>
  </nav>;
}