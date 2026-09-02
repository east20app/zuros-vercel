import type { Metadata } from "next";
import { DashboardAppsGrid } from "@/components/DashboardAppsGrid";
import { Button } from "@/components/ui";
import { listMyApps } from "@/lib/actions/apps.actions";
import { requireUser } from "@/lib/require-admin";
import { isExpiring } from "@/lib/status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Visão geral · ZUROS APP",
    description: "Acompanhe a operação das suas aplicações ZUROS.",
};

export default async function DashboardPage() {
    await requireUser();
    const apps = await listMyApps();
    const sorted = [...apps].sort((a, b) => {
        const rank = (app: (typeof apps)[number]) => {
            let value = 0;
            if (app.errorOnUpdate) value += 1000;
            if (isExpiring(app.expiresAt, app.lifetime)) value += 500;
            if (app.status !== "active") value += 200;
            return value;
        };
        const difference = rank(b) - rank(a);
        if (difference !== 0) return difference;
        const aTime = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
        const bTime = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
        return aTime - bTime;
    });

    return (
        <main className="dashboard-home dashboard-home-v2 mx-auto min-w-0 max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
            <section className="dashboard-command-hero dashboard-command-hero-simple">
                <div className="dashboard-command-copy">
                    <p className="home-kicker"><span className="home-kicker-mark" />PAINEL</p>
                    <h1>Aplicações</h1>
                    <p className="dashboard-command-lede">Escolha uma aplicação para continuar.</p>
                </div>
                <Button href="/planos" className="dashboard-action-primary">Adicionar aplicação <span aria-hidden="true">↗</span></Button>
            </section>

            <section className="dashboard-apps-section" aria-labelledby="dashboard-apps-heading">
                <div className="dashboard-apps-heading">
                    <div><p className="home-section-index">APLICAÇÕES</p><h2 id="dashboard-apps-heading">Suas aplicações</h2></div>
                    <div className="dashboard-apps-count"><strong>{String(apps.length).padStart(2, "0")}</strong><span>{apps.length === 1 ? "aplicação conectada" : "aplicações conectadas"}</span></div>
                </div>
                <div className="dashboard-apps-list">{sorted.length === 0 ? <div className="dashboard-empty dashboard-empty-v2"><div className="dashboard-empty-mark">+</div><p className="dashboard-eyebrow">PRIMEIRO MOVIMENTO</p><h2>Comece pelo que você quer colocar no ar.</h2><p>Escolha uma aplicação no catálogo e conecte sua primeira operação ao painel.</p><Button href="/planos" className="mt-5">Conhecer aplicações <span aria-hidden="true">↗</span></Button></div> : <DashboardAppsGrid apps={sorted} />}</div>
            </section>
        </main>
    );
}
