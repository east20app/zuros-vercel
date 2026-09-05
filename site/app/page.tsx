import Link from "next/link";
import { getSessionUser } from "@/lib/require-admin";
import { getUserPendingCount } from "@root/src/integration/public-dashboard";
import { listStoreCatalogs } from "@root/src/integration/purchases";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicStoreCatalog } from "@/components/PublicStoreCatalog";
import { FaqAccordion } from "@/components/FaqAccordion";
import databases from "@root/src/databases";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { publicMetadata } from "@/lib/site-url";
import { PublicFooter } from "@/components/PublicFooter";

const features: Array<[ReactNode, string, string]> = [
    [<Icon key="payment" name="payment" className="h-5 w-5" />, "Alta conversão", "Checkout com PIX e confirmação automática, sem atrito entre o clique e a aprovação."],
    [<Icon key="settings" name="settings" className="h-5 w-5" />, "Setup em minutos", "Infraestrutura pronta no primeiro acesso. Sem VPS, sem painel para configurar à mão."],
    [<Icon key="shield" name="shield" className="h-5 w-5" />, "Privacidade da operação", "Aplicações protegidas e acesso gerenciado via Discord. Você no controle de cada usuário."],
    [<Icon key="help" name="help" className="h-5 w-5" />, "Suporte direto", "Comunidade ativa e canal de ajuda para resolver qualquer problema da operação."],
    [<Icon key="apps" name="apps" className="h-5 w-5" />, "Discord + painel web", "Bot e painel sincronizados no mesmo ambiente: vender, configurar e acompanhar em um só lugar."],
    [<Icon key="dashboard" name="dashboard" className="h-5 w-5" />, "Controle financeiro total", "Vendas, renovações e consumo acompanhados no mesmo painel, sem planilha."],
];

const financeRows = [
    { time: "AGORA", label: "Pagamento PIX confirmado", value: "R$ 79,90", tone: "ok" },
    { time: "HOJE", label: "Renovação automática", value: "R$ 39,90", tone: "ok" },
    { time: "HOJE", label: "Aguardando confirmação", value: "R$ 49,90", tone: "wait" },
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

    const clientNames = Array.from(new Set(catalogs.map((catalog) => catalog.name))).slice(0, 5);

    return (
        <div className="reference-home min-h-screen overflow-x-clip text-white">
            <AnnouncementBar />
            <PublicNavbar user={user} pendingCount={pendingCount} />
            <main>
                <section className="reference-hero mx-auto flex w-full max-w-7xl flex-col items-center px-5 pb-16 pt-20 text-center sm:px-8 sm:pt-24">
                    <div className="reference-hero-copy animate-fade-up">
                        <p className="home-kicker"><span className="home-kicker-mark" />ZUROS / OPERAÇÃO DIGITAL</p>
                        <h1 className="home-title mt-7 max-w-4xl">Aqui você <span>vende e controla.</span></h1>
                        <p className="home-lede mt-7 max-w-xl">Bot, loja e painel conectados para comunidades que querem vender no Discord com infraestrutura séria.</p>
                        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                            <Link href={user ? "/dashboard" : "/login"} className="home-primary-cta">{user ? "Abrir minhas aplicações" : "Começar pelo painel"}<span aria-hidden>↗</span></Link>
                            <Link href="#recursos" className="home-secondary-cta">Ver como funciona</Link>
                        </div>
                        <div className="home-proof-row mt-10">
                            <span><i />Operação em um só lugar</span>
                            <span><i />Acesso via Discord</span>
                            <span><i />Confirmação automática</span>
                        </div>
                    </div>

                    <div className="reference-dashboard-mock mt-14 animate-fade-up" style={{ animationDelay: "120ms" }} aria-label="Preview do painel ZUROS">
                        <div className="reference-mock-bar">
                            <span className="reference-mock-dots"><i /><i /><i /></span>
                            <span className="reference-mock-url">app.zuros.app / dashboard</span>
                            <span className="reference-mock-live"><i />sistemas ativos</span>
                        </div>
                        <div className="reference-mock-body">
                            <aside className="reference-mock-nav">
                                <span className="reference-mock-brand">ZUROS <small>APP</small></span>
                                <nav aria-hidden="true">
                                    <a className="is-active">Painel</a>
                                    <a>Vendas</a>
                                    <a>Produtos</a>
                                    <a>Aplicações</a>
                                    <a>Configurações</a>
                                </nav>
                            </aside>
                            <div className="reference-mock-main">
                                <div className="reference-mock-heading">
                                    <div><p>CONTROLE FINANCEIRO TOTAL</p><strong>O essencial da operação</strong></div>
                                    <span>hoje</span>
                                </div>
                                <div className="reference-mock-kpis">
                                    <div><span>aplicações ativas</span><strong>{activeApps || "—"}</strong></div>
                                    <div><span>lojas conectadas</span><strong>{stores || "—"}</strong></div>
                                    <div><span>produtos ativos</span><strong>{catalogs.length || "—"}</strong></div>
                                </div>
                                <div className="reference-mock-chart" aria-hidden="true">
                                    {[38, 55, 42, 70, 58, 84, 66, 96].map((height, index) => <i key={index} style={{ height: `${height}%` }} className={index === 5 || index === 7 ? "is-alt" : ""} />)}
                                </div>
                                <div className="reference-mock-sales">
                                    {financeRows.map((row) => <div key={`${row.time}-${row.label}`}><span className="reference-mock-time">{row.time}</span><span className={`reference-mock-dot ${row.tone}`} /><b>{row.label}</b><em>{row.value}</em></div>)}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {clientNames.length > 0 && (
                    <section className="reference-clients border-y border-white/[.06]">
                        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-6 px-5 py-12 sm:px-8 lg:flex-row lg:justify-between">
                            <p className="home-section-index">NOSSOS CLIENTES</p>
                            <div className="reference-clients-list flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
                                {clientNames.map((name) => <span key={name}>{name}</span>)}
                                <strong>+{stores || 0} lojas confiando na plataforma</strong>
                            </div>
                        </div>
                    </section>
                )}

                <section id="recursos" className="home-section home-catalog-section border-y border-white/[.07]">
                    <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
                        <div className="home-section-heading grid gap-6 lg:grid-cols-[.9fr_1.1fr] lg:items-end">
                            <div><p className="home-section-index">PRODUTOS</p><h2 className="home-section-title mt-4">Escolha o que sua operação precisa.</h2></div>
                            <p className="home-section-note max-w-md lg:justify-self-end">Planos mensais com infraestrutura, atualizações e painel de configuração conectados desde o primeiro acesso.</p>
                        </div>
                        <div className="mt-12">{catalogs.length ? <PublicStoreCatalog stores={catalogs} canPurchase={!!user} /> : <div className="zuros-card border-dashed py-14 text-center text-sm text-zinc-500">Novos produtos serão publicados em breve.</div>}</div>
                    </div>
                </section>

                <section id="beneficios" className="mx-auto w-full max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
                    <div className="home-section-heading mx-auto max-w-2xl text-center">
                        <p className="home-section-index">POR QUE ESCOLHER A ZUROS?</p>
                        <h2 className="home-section-title mt-4">Tudo o que você precisa. <span className="reference-inline-accent">Nada do que não serve.</span></h2>
                    </div>
                    <div className="reference-feature-grid mt-14">{features.map(([icon, title, description]) => <article key={title} className="reference-feature"><span className="reference-feature-icon">{icon}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
                </section>

                <section className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8 lg:pb-28">
                    <div className="reference-cta-band">
                        <div className="reference-cta-copy"><p className="home-section-index">PRONTO PARA COMEÇAR?</p><h2>Monitore e venda suas aplicações em minutos.</h2></div>
                        <Link href={user ? "/dashboard" : "/login"} className="reference-cta-link">{user ? "Ir para o painel" : "Entrar com Discord"}<span aria-hidden>↗</span></Link>
                    </div>
                </section>

                <section id="faq" className="home-section mx-auto w-full max-w-4xl px-5 py-20 sm:px-8 lg:py-24"><p className="home-section-index">DÚVIDAS</p><h2 className="home-section-title mt-4">Antes de ligar a operação.</h2><div className="mt-9"><FaqAccordion /></div></section>
            </main>
            <PublicFooter isAuthenticated={!!user} />
        </div>
    );
}