import Link from "next/link";
import { getSessionUser } from "@/lib/require-admin";
import { getRecentPublicSales, getUserPendingCount } from "@root/src/integration/public-dashboard";
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

const features: Array<[ReactNode, string, string]> = [
    [<Icon key="payment" name="payment" className="h-5 w-5" />, "Vendas e PIX automáticos", "Catálogo, pagamentos, cupons e renovações em um fluxo integrado, sem conferência manual."],
    [<Icon key="package" name="package" className="h-5 w-5" />, "Hospedagem e releases", "Publique versões validadas e acompanhe status, consumo e atividade de cada aplicação."],
    [<Icon key="bot" name="bot" className="h-5 w-5" />, "Gestão Discord conectada", "Configure sua operação pelo painel e mantenha bot, loja e aplicações sincronizados."],
];

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
    return publicMetadata("ZUROS APP · Bots Discord, vendas e hospedagem", "Hospede, venda e gerencie aplicações Discord em um só lugar.", "/");
}

export default async function HomePage() {
    const user = await getSessionUser();
    const [sales, pendingCount, catalogs, activeApps, stores] = await Promise.all([
        getRecentPublicSales(),
        user ? getUserPendingCount(user.discordId) : Promise.resolve(0),
        listStoreCatalogs(),
        databases.applications.countDocuments({ status: "active" }),
        databases.stores.countDocuments({}),
    ]);
    const telemetry = getPlatformTelemetry({ limit: 0 });
    const uptimeDays = Math.floor(telemetry.uptimeSeconds / 86400);

    return <div className="relative min-h-screen text-white">
        <div className="zuros-backdrop" aria-hidden />
        <div className="zuros-grid" aria-hidden />
        <AnnouncementBar />
        <PublicNavbar user={user} pendingCount={pendingCount} />
        <main>
            <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 pb-16 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[1fr_.72fr] lg:pb-24">
                <div className="animate-fade-up">
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/[.10] px-3 py-1.5 text-xs font-medium text-emerald-300"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />Administração e automação conectadas</span>
                    <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-[-.045em] sm:text-6xl">Sua operação Discord,<span className="block bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">em um só lugar.</span></h1>
                    <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">Do primeiro pagamento à publicação de uma nova versão, o ZUROS mantém bot, loja e aplicações trabalhando juntos.</p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href={user ? "/dashboard" : "/login"} className="rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-600 px-6 py-3 text-center text-sm font-semibold text-black shadow-[0_12px_30px_-10px_rgba(16,185,129,.6)] transition hover:-translate-y-px hover:from-emerald-300 hover:to-emerald-500">{user ? "Ir para o Dashboard" : "Entrar na plataforma"}</Link><Link href="/planos" className="rounded-lg border border-zinc-700 px-6 py-3 text-center text-sm font-semibold text-zinc-300 transition hover:border-emerald-500/40 hover:bg-emerald-500/[.06] hover:text-emerald-300">Ver produtos e planos</Link></div>
                </div>
                <div className="relative hidden min-h-[330px] xl:block">
                    <div className="zuros-card zuros-card-lit absolute inset-x-6 top-0 p-5"><p className="text-xs text-zinc-500">Visão geral da operação</p><div className="mt-4 grid grid-cols-3 gap-3">{["Bots", "Loja", "Releases"].map((label, i) => <div key={label} className="rounded-xl border border-white/[.06] bg-black/30 p-3"><span className="text-[10px] text-zinc-600">{label}</span><b className="mt-1 block text-lg text-emerald-400">{i === 0 ? "Online" : i === 1 ? "PIX" : "v1.0"}</b></div>)}</div></div>
                    {sales.slice(0, 2).map((sale, index) => <div key={sale.id} className="zuros-card absolute right-0 top-[150px] w-[88%] p-4" style={{transform:`translate(${index * -28}px, ${index * 82}px)`,opacity:1-index*.22}}><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400"><Icon name="check" className="h-5 w-5" /></span><div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-zinc-600">Venda confirmada</p><p className="truncate text-sm font-medium">{sale.description}</p></div></div></div>)}
                </div>
            </section>
            <section id="recursos" className="border-y border-zinc-900/80 bg-[#07070a]/70"><div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6"><p className="text-xs font-semibold uppercase tracking-[.22em] text-emerald-400">Produtos ZUROS</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Produtos disponíveis.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">Veja os produtos mensais disponibilizados pelas lojas.</p><div className="mt-10">{catalogs.length ? <PublicStoreCatalog stores={catalogs} canPurchase={!!user} /> : <div className="zuros-card border-dashed py-14 text-center text-sm text-zinc-600">Nenhum produto disponível no momento.</div>}</div></div></section>
            <section id="beneficios" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6"><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Menos tarefas manuais. Mais controle.</h2><p className="mt-3 max-w-xl text-zinc-500">Tudo o que hoje vive em mensagens e planilhas passa a viver em um painel só.</p><div className="mt-9 grid gap-4 md:grid-cols-3">{features.map(([icon,title,text]) => <article key={title} className="zuros-card zuros-card-lit zuros-lift p-6"><span className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">{icon}</span><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p></article>)}</div></section>
            <section aria-label="Telemetria da plataforma" className="mx-auto grid w-full max-w-6xl gap-3 px-4 pb-10 sm:grid-cols-3 sm:px-6"><div className="zuros-card p-5"><b className="text-3xl text-emerald-400">{activeApps}</b><p className="mt-1 text-sm text-zinc-400">aplicações ativas</p></div><div className="zuros-card p-5"><b className="text-3xl text-emerald-400">{stores}</b><p className="mt-1 text-sm text-zinc-400">lojas atendidas</p></div><div className="zuros-card p-5"><b className="text-3xl text-emerald-400">{uptimeDays ? `${uptimeDays}d` : "Online"}</b><p className="mt-1 text-sm text-zinc-400">uptime do processo atual</p></div></section>
            <section id="faq" className="mx-auto w-full max-w-4xl px-4 py-20 sm:px-6"><p className="text-xs font-semibold uppercase tracking-[.22em] text-emerald-400">Dúvidas frequentes</p><h2 className="mb-8 mt-3 text-3xl font-semibold">Antes de começar</h2><FaqAccordion /></section>
        </main>
        <footer id="suporte" className="border-t border-zinc-900/80 bg-[#07070a]/50"><div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:px-6"><span>© 2026 ZUROS APP · Applications</span><nav aria-label="Links do rodapé" className="flex flex-wrap gap-5"><Link href="/planos" className="hover:text-white">Produtos</Link><Link href="/termos" className="hover:text-white">Termos</Link><Link href="/privacidade" className="hover:text-white">Privacidade</Link><Link href={user ? "/dashboard" : "/login"} className="hover:text-emerald-300">Acessar a plataforma</Link></nav></div></footer>
    </div>;
}
