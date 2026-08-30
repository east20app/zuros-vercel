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

    return <div className="home-shell relative min-h-screen overflow-x-clip text-white"><div className="zuros-backdrop" aria-hidden /><div className="zuros-grid" aria-hidden /><AnnouncementBar /><PublicNavbar user={user} pendingCount={pendingCount} />
        <main>
            <section className="mx-auto grid w-full max-w-7xl gap-10 px-5 pb-14 pt-20 sm:px-8 sm:pt-28 lg:grid-cols-[.8fr_1.2fr] lg:items-end lg:gap-20"><div><p className="home-kicker"><span className="home-kicker-mark" />ZUROS / PLANOS</p><h1 className="home-section-title mt-6 max-w-2xl !text-[clamp(3.2rem,7vw,6.6rem)]">Escolha a camada certa para sua operação.</h1></div><p className="home-lede max-w-md lg:justify-self-end">Do primeiro checkout ao painel completo: módulos mensais para comunidades que querem crescer com contexto.</p></section>
            <section className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:py-14">{catalogs.length ? <PublicStoreCatalog stores={catalogs} canPurchase={!!user} /> : <div className="zuros-card border-dashed py-16 text-center text-sm text-zinc-500">Nenhum produto mensal disponível no momento.</div>}<p className="mt-8 text-center text-xs leading-5 text-zinc-600">Os preços e a disponibilidade podem sofrer alterações sem aviso prévio.</p></section>
        </main>
        <PublicFooter isAuthenticated={!!user} />
    </div>;
}
