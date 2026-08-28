"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBotConfigOverview } from "@/lib/actions/bot-config.actions";
import type { BotConfigModule } from "@/lib/bot-config";
import { Icon, type IconName } from "./Icon";

type PanelOption = { label: string; description: string; icon: IconName; module?: BotConfigModule; path?: "vendas" };

// Mesma ordem e mesmas entradas de commands/admin/painel.py do DROX.
const PANEL_OPTIONS: PanelOption[] = [
    { label: "Configurar Loja", description: "Produtos, estoque, categorias e cupons", icon: "store", module: "loja" },
    { label: "Gerenciar Ticket", description: "Painéis, categorias, mensagens e equipe", icon: "ticket", module: "tickets" },
    { label: "Ver Rendimento", description: "Vendas, pedidos, carrinhos e clientes do bot", icon: "dashboard", path: "vendas" },
    { label: "Personalização", description: "Cores, perfil, status e modo de exibição", icon: "bot", module: "customizacao" },
    { label: "Automações", description: "Boas-vindas, contadores, respostas e integrações", icon: "settings", module: "automacoes" },
    { label: "DROX Cloud", description: "OAuth2, verificação, tarefas e presentes", icon: "apps", module: "cloud" },
    { label: "Mensagens", description: "Anúncios, mensagens diretas e modelos", icon: "bell", module: "mensagens" },
    { label: "Proteção do Servidor", description: "Anti-raid, privatizações e monitoramento", icon: "shield", module: "protecao" },
    { label: "Sorteios", description: "Mensagens e regras de participação", icon: "coupon", module: "giveaways" },
    { label: "Configurações", description: "Cargos, canais, pagamentos, anti-fake e blacklist", icon: "settings", module: "configuracoes" },
];

export function BotConfigIndex({ storeId: appId }: { storeId: string }) {
    const [status, setStatus] = useState<Partial<Record<BotConfigModule, string>>>({});
    useEffect(() => {
        let active = true;
        void getBotConfigOverview(appId).then((overview) => {
            if (!active) return;
            setStatus(Object.fromEntries(Object.entries(overview).map(([module, state]) => [
                module,
                !state.available ? "Indisponível no momento" : state.total ? `${state.active}/${state.total} recursos ativos` : "Abrir configuração",
            ])));
        }).catch(() => {
            if (!active) return;
            const modules = PANEL_OPTIONS.flatMap((option) => option.module ? [option.module] : []);
            setStatus(Object.fromEntries(modules.map((module) => [module, "Indisponível no momento"])));
        });        return () => { active = false; };
    }, [appId]);

    return (
        <section className="zuros-card overflow-hidden rounded-2xl">
            <div className="border-b border-white/[.06] bg-white/[.025] px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-[#7c3aed] text-white"><Icon name="bot" /></span>
                    <div>
                        <h2 className="font-semibold text-white">Painel de controle</h2>
                        <p className="mt-0.5 text-sm text-[#b5bac1]">Gerencie seu bot como no comando <code className="rounded bg-black/20 px-1.5 py-0.5 text-[#dbdee1]">/painel</code> do DROX.</p>
                    </div>
                </div>
            </div>
            <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-5">
                {PANEL_OPTIONS.map((option) => {
                    const href = option.path ? `/dashboard/${appId}/${option.path}` : `/dashboard/${appId}/config/${option.module}`;
                    const state = option.module ? status[option.module] : "Abrir rendimentos";
                    return (
                        <Link key={option.label} href={href} className="group flex min-w-0 items-center gap-3 rounded-xl border border-white/[.055] bg-white/[.025] p-4 transition hover:-translate-y-px hover:border-violet-500/35 hover:bg-violet-500/[.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#7c3aed]/15 text-[#949cf7] transition group-hover:bg-[#7c3aed] group-hover:text-white"><Icon name={option.icon} /></span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-[#f2f3f5]">{option.label}</span>
                                <span className="mt-0.5 block truncate text-xs text-[#949ba4]">{option.description}</span>
                                <span className={`mt-1 block text-[11px] ${state === "Indisponível no momento" ? "text-red-400" : "text-[#23a559]"}`}>{state || "Carregando..."}</span>
                            </span>
                            <Icon name="arrow-right" className="h-4 w-4 text-[#6d6f78] transition group-hover:translate-x-0.5 group-hover:text-white" />
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
