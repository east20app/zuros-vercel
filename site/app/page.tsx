import Link from "next/link";
import { getSessionUser } from "@/lib/require-admin";
import { getUserPendingCount } from "@root/src/integration/public-dashboard";
import { listStoreCatalogs } from "@root/src/integration/purchases";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicStoreCatalog } from "@/components/PublicStoreCatalog";
import { FaqAccordion } from "@/components/FaqAccordion";
import { getPlatformTelemetry } from "@root/src/integration/telemetry";
import databases from "@root/src/databases";
import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import type { ReactNode } from "react";
import { publicMetadata } from "@/lib/site-url";
import { PublicFooter } from "@/components/PublicFooter";

const features: Array<[ReactNode, string, string]> = [
    [<Icon key="payment" name="payment" className="h-5 w-5" />, "Vendas e PIX automáticos", "Catálogo, pagamentos, cupons e renovações em um fluxo integrado, sem conferência manual."],
    [<Icon key="package" name="package" className="h-5 w-5" />, "Infraestrutura e versões", "Publique versões validadas e acompanhe status, consumo e atividade de cada aplicação."],
    [<Icon key="bot" name="bot" className="h-5 w-5" />, "Gestão Discord conectada", "Configure sua operação pelo painel e mantenha bot, loja e aplicações sincronizados."],
];

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
    return publicMetadata("ZUROS APP · Bots Discord, vendas e infraestrutura gerenciada", "Publique, venda e gerencie aplicações Discord em um só lugar.", "/");
}

export default async function HomePage() {
    const userPromise = getSessionUser();
    const catalogsPromise = listStoreCatalogs();
    const activeAppsPromise = databases.applications.countDocuments({ status: "active" });
    const storesPromise = databases.stores.countDocuments({});
    const user = await userPromise;
    const [pendingCount, catalogs, activeApps, stores] = await Promise.all([
        user ? getUserPendingCount(user.discordId) : Promise.resolve(0),
        catalogsPromise,
        activeAppsPromise,
        storesPromise,
    ]);
    const telemetry = getPlatformTelemetry({ limit: 0 });
    const uptimeDays = Math.floor(telemetry.uptimeSeconds / 86400);

    return <div className="relative min-h-screen text-white">
        <div className="zuros-backdrop" aria-hidden />
        <div className="zuros-grid" aria-hidden />
        <AnnouncementBar />
        <PublicNavbar user={user} pendingCount={pendingCount} />
        <main>
            <section className="mx-auto flex min-h-[620px] w-full max-w-6xl flex-col items-center justify-center px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
                <div className="animate-fade-up">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/[.08] bg-white/[.035] px-3.5 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,.9)]" />Plataforma completa para Discord</span>
                    <h1 className="mx-auto mt-7 max-w-5xl text-5xl font-semibold leading-[.98] tracking-[-.055em] text-white sm:text-7xl lg:text-[5.5rem]">Seu bot, sua loja e suas vendas.<span className="mt-2 block bg-gradient-to-r from-violet-300 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">Tudo conectado.</span></h1>
                    <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">Configure o DROX pelo navegador, automatize pagamentos e acompanhe suas aplicações em um painel rápido, seguro e fácil de usar.</p>
                    <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><Link href={user ? "/dashboard" : "/login"} className="rounded-xl bg-violet-600 px-7 py-3.5 text-center text-sm font-semibold text-white shadow-[0_14px_38px_-14px_rgba(124,58,237,.8)] transition hover:-translate-y-px hover:bg-violet-500">{user ? "Abrir minhas aplicações" : "Começar agora"}</Link><Link href="#recursos" className="rounded-xl border border-white/[.09] bg-white/[.035] px-7 py-3.5 text-center text-sm font-semibold text-zinc-200 backdrop-blur transition hover:border-white/[.16] hover:bg-white/[.065]">Explorar produtos</Link></div>
                </div>
                <div className="mt-16 grid w-full max-w-4xl gap-3 sm:grid-cols-3">
                    {[{label:"Aplicações",value:activeApps || "Online"},{label:"Lojas conectadas",value:stores || "Disponível"},{label:"Infraestrutura",value:uptimeDays ? `${uptimeDays} dias` : "Estável"}].map((item) => <div key={item.label} className="rounded-2xl border border-white/[.065] bg-white/[.025] px-5 py-4 backdrop-blur-xl"><b className="block text-xl font-semibold text-white">{item.value}</b><span className="mt-1 block text-xs text-zinc-500">{item.label}</span></div>)}
                </div>
            </section>
            <section id="recursos" className="border-y border-white/[.055] bg-black/25"><div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-400">Aplicações ZUROS</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Escolha o que sua comunidade precisa.</h2></div><p className="max-w-md text-sm leading-6 text-zinc-500">Planos mensais com infraestrutura, atualizações e painel de configuração integrados.</p></div><div className="mt-10">{catalogs.length ? <PublicStoreCatalog stores={catalogs} canPurchase={!!user} /> : <div className="zuros-card border-dashed py-14 text-center text-sm text-zinc-500">Novos produtos serão publicados em breve.</div>}</div></div></section>
            <section id="beneficios" className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-400">Uma operação mais simples</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Tudo que você precisa para administrar seu bot.</h2><p className="mt-4 leading-7 text-zinc-500">As funções que antes dependiam de comandos também ficam disponíveis em uma experiência visual completa.</p></div><div className="mt-10 grid gap-4 md:grid-cols-3">{features.map(([icon,title,description], index) => <article key={title} className="zuros-card zuros-lift min-h-56 p-6"><span className="text-xs font-medium text-zinc-600">0{index + 1}</span><span className="mt-8 grid h-11 w-11 place-items-center rounded-xl border border-violet-500/20 bg-violet-500/[.09] text-violet-300">{icon}</span><h3 className="mt-5 font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p></article>)}</div></section>
            <section className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6"><div className="zuros-card flex flex-col items-center px-6 py-14 text-center sm:px-10"><span className="zuros-pill">Painel DROX conectado</span><h2 className="mt-5 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Gerencie sua comunidade sem sair do navegador.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-zinc-500">Produtos, estoque, automações, proteção, mensagens, sorteios e configurações reunidos em um só lugar.</p><Link href={user ? "/dashboard" : "/login"} className="mt-7 rounded-xl bg-violet-600 px-7 py-3 text-sm font-semibold text-white hover:bg-violet-500">{user ? "Ir para o painel" : "Entrar com Discord"}</Link></div></section>
            <section id="faq" className="mx-auto w-full max-w-4xl px-4 py-20 sm:px-6"><p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-400">Dúvidas frequentes</p><h2 className="mb-8 mt-3 text-3xl font-semibold">Antes de começar</h2><FaqAccordion /></section>
        </main>        <PublicFooter isAuthenticated={!!user} />
    </div>;
}
