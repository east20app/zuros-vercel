import type { Metadata } from "next";
import { getSessionUser } from "@/lib/require-admin";
import { getUserPendingCount } from "@root/src/integration/public-dashboard";
import { listStoreCatalogs } from "@root/src/integration/purchases";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicStoreCatalog } from "@/components/PublicStoreCatalog";
import { PublicFooter } from "@/components/PublicFooter";
import { publicMetadata } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const metadata: Metadata = publicMetadata("Planos e preços · ZUROS APP", "Planos mensais para potencializar seus projetos e comunidades.", "/planos");

export default async function PlansPage() {
    const userPromise = getSessionUser();
    const catalogsPromise = listStoreCatalogs();
    const user = await userPromise;
    const [catalogs, pendingCount] = await Promise.all([catalogsPromise, user ? getUserPendingCount(user.discordId) : Promise.resolve(0)]);

    return <div className="home-shell plans-page-shell relative min-h-screen overflow-x-clip text-white"><div className="zuros-backdrop" aria-hidden /><div className="zuros-grid" aria-hidden /><AnnouncementBar /><PublicNavbar user={user} pendingCount={pendingCount} />
        <main>
            <section className="plans-intro-section mx-auto w-full max-w-7xl px-5 pb-12 pt-20 sm:px-8 sm:pt-28">
                <div className="plans-intro-copy"><p className="home-kicker"><span className="home-kicker-mark" />ZUROS / PLANOS</p><h1 className="plans-intro-title">Escolha o que<br /><span>coloca você no ar.</span></h1><p className="home-lede">Produtos prontos para operar, vender e crescer — com o contexto técnico traduzido em uma experiência simples.</p></div>
                <div className="plans-intro-note"><span className="plans-intro-note-number">01</span><span><b>COMECE PELO ESSENCIAL</b><small>O Zuros Bot reúne automação, operação e monitoramento em uma única camada.</small></span></div>
            </section>
            <section className="plans-catalog-section mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:py-12"><div className="plans-catalog-heading"><div><p className="home-section-index">01 / CATÁLOGO</p><h2>Uma escolha.<br /><span>Um ambiente inteiro.</span></h2></div><p>Sem planos escondidos, sem instalação confusa. Escolha o produto, conecte sua operação e acompanhe tudo pelo painel.</p></div>{catalogs.length ? <PublicStoreCatalog stores={catalogs} canPurchase={!!user} /> : <div className="zuros-card border-dashed py-16 text-center text-sm text-zinc-500">Nenhum produto mensal disponível no momento.</div>}<p className="plans-catalog-disclaimer">Os preços e a disponibilidade podem sofrer alterações sem aviso prévio.</p></section>
        </main>
        <PublicFooter isAuthenticated={!!user} />
    </div>;
}
