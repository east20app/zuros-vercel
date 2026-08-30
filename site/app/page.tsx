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
import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { publicMetadata } from "@/lib/site-url";
import { PublicFooter } from "@/components/PublicFooter";

const features: Array<[ReactNode, string, string]> = [
    [<Icon key="payment" name="payment" className="h-5 w-5" />, "Venda sem fricção", "Catálogo, PIX, cupons e renovações dentro de um mesmo fluxo operacional."],
    [<Icon key="package" name="package" className="h-5 w-5" />, "Infraestrutura rastreável", "Publique versões, acompanhe consumo e identifique o que precisa de atenção."],
    [<Icon key="bot" name="bot" className="h-5 w-5" />, "Discord no centro", "Configure o DROX pelo navegador e mantenha bot, loja e aplicações sincronizados."],
];

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
    return publicMetadata("ZUROS APP · Operação para comunidades que crescem", "Uma camada de operação para vender, configurar e acompanhar suas aplicações Discord.", "/");
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

    return (
        <div className="home-shell relative min-h-screen overflow-x-clip text-white">
            <div className="zuros-backdrop" aria-hidden />
            <div className="zuros-grid" aria-hidden />
            <AnnouncementBar />
            <PublicNavbar user={user} pendingCount={pendingCount} />
            <main>
                <section className="home-hero mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-24 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:pb-32 lg:pt-28">
                    <div className="home-hero-copy animate-fade-up">
                        <p className="home-kicker"><span className="home-kicker-mark" />ZUROS / OPERAÇÃO DIGITAL</p>
                        <h1 className="home-title mt-7 max-w-4xl">Seu Discord não é só um servidor.<span>É uma operação.</span></h1>
                        <p className="home-lede mt-7 max-w-xl">Venda, configure e acompanhe suas aplicações com uma camada de controle feita para comunidades que já passaram da improvisação.</p>
                        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                            <Link href={user ? "/dashboard" : "/login"} className="home-primary-cta">{user ? "Abrir minhas aplicações" : "Começar pelo painel"}<span aria-hidden>↗</span></Link>
                            <Link href="#recursos" className="home-secondary-cta">Ver como funciona</Link>
                        </div>
                        <div className="home-proof-row mt-10">
                            <span><i />Operação em um só lugar</span>
                            <span><i />Acesso via Discord</span>
                            <span><i />Sem configuração manual</span>
                        </div>
                    </div>

                    <aside className="home-signal-wrap" aria-label="Resumo da operação ZUROS">
                        <div className="home-signal-panel animate-fade-up" style={{ animationDelay: "100ms" }}>
                            <div className="home-signal-topline"><span>LIVE / PLATFORM PULSE</span><span className="home-signal-live"><i />online</span></div>
                            <div className="home-signal-heading"><div><span className="home-signal-label">Seu centro de comando</span><strong>O que está acontecendo agora</strong></div><span className="home-signal-index">01</span></div>
                            <div className="home-signal-chart" aria-hidden="true"><span style={{ height: "28%" }} /><span style={{ height: "44%" }} /><span style={{ height: "36%" }} /><span style={{ height: "61%" }} /><span style={{ height: "52%" }} /><span style={{ height: "78%" }} /><span style={{ height: "69%" }} /><span style={{ height: "92%" }} /><span style={{ height: "82%" }} /><span style={{ height: "100%" }} /></div>
                            <div className="home-signal-stats">
                                <div><strong>{activeApps || "—"}</strong><span>apps ativos</span></div>
                                <div><strong>{stores || "—"}</strong><span>lojas conectadas</span></div>
                                <div><strong>{uptimeDays ? `${uptimeDays}d` : "OK"}</strong><span>infra estável</span></div>
                            </div>
                            <div className="home-signal-log"><span className="home-log-time">agora</span><span>checkout, bot e atualizações no mesmo pulso</span><span className="home-log-arrow">↗</span></div>
                        </div>
                        <div className="home-orbit home-orbit-one" aria-hidden="true" /><div className="home-orbit home-orbit-two" aria-hidden="true" />
                    </aside>
                </section>

                <section id="recursos" className="home-section home-catalog-section border-y border-white/[.07]">
                    <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
                        <div className="home-section-heading grid gap-6 lg:grid-cols-[.9fr_1.1fr] lg:items-end">
                            <div><p className="home-section-index">01 / APLICAÇÕES ZUROS</p><h2 className="home-section-title mt-4">Escolha o próximo módulo da sua operação.</h2></div>
                            <p className="home-section-note max-w-md lg:justify-self-end">Planos mensais com infraestrutura, atualizações e painel de configuração conectados desde o primeiro acesso.</p>
                        </div>
                        <div className="mt-12">{catalogs.length ? <PublicStoreCatalog stores={catalogs} canPurchase={!!user} /> : <div className="zuros-card border-dashed py-14 text-center text-sm text-zinc-500">Novos produtos serão publicados em breve.</div>}</div>
                    </div>
                </section>

                <section id="beneficios" className="home-section mx-auto w-full max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
                    <div className="grid gap-10 lg:grid-cols-[.78fr_1.22fr] lg:gap-20">
                        <div><p className="home-section-index">02 / O SISTEMA</p><h2 className="home-section-title mt-4">Menos abas abertas. Mais leitura do que importa.</h2><p className="home-section-note mt-5 max-w-md">As funções que antes ficavam espalhadas entre comandos, planilhas e mensagens agora trabalham na mesma direção.</p></div>
                        <div className="home-feature-grid">{features.map(([icon, title, description], index) => <article key={title} className="home-feature-card"><div className="home-feature-number">0{index + 1}</div><span className="home-feature-icon">{icon}</span><h3>{title}</h3><p>{description}</p><span className="home-feature-line" /></article>)}</div>
                    </div>
                </section>

                <section className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8 lg:pb-28"><div className="home-manifesto"><span className="home-manifesto-mark">ZU</span><div><p className="home-section-index">03 / A IDEIA</p><h2>O painel não precisa parecer um painel.</h2><p>Precisa dar contexto, mostrar o próximo passo e desaparecer quando tudo está funcionando.</p></div><Link href={user ? "/dashboard" : "/login"} className="home-manifesto-link">{user ? "Ir para o painel" : "Entrar com Discord"}<span>↗</span></Link></div></section>

                <section id="faq" className="home-section mx-auto w-full max-w-4xl px-5 py-20 sm:px-8 lg:py-24"><p className="home-section-index">04 / DÚVIDAS FREQUENTES</p><h2 className="home-section-title mt-4">Antes de ligar a operação.</h2><div className="mt-9"><FaqAccordion /></div></section>
            </main>
            <PublicFooter isAuthenticated={!!user} />
        </div>
    );
}
