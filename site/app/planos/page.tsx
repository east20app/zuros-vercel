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

    return <div className="reference-plans min-h-screen overflow-x-clip text-white"><AnnouncementBar /><PublicNavbar user={user} pendingCount={pendingCount} />
        <main>
            <section className="reference-plans-intro mx-auto w-full max-w-6xl px-5 pb-10 pt-20 text-center sm:px-8 sm:pt-24">
                <h1>Busque um plano para potencializar seus projetos.</h1>
                <p>De startups de estágio inicial a empresas em crescimento, a ZUROS tem planos para todos.</p>
            </section>
            <section className="reference-plans-catalog mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-10">{catalogs.length ? <PublicStoreCatalog stores={catalogs} canPurchase={!!user} /> : <div className="zuros-card border-dashed py-16 text-center text-sm text-zinc-500">Nenhum produto disponível no momento.</div>}<p className="plans-catalog-disclaimer">Atenção: os preços acima estão sujeitos a alterações sem aviso prévio, assim como a disponibilidade das unidades.</p></section>
        </main>
        <PublicFooter isAuthenticated={!!user} />
    </div>;
}
