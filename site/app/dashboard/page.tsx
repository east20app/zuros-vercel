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
        <main className="dashboard-home dashboard-home-clean mx-auto min-w-0 max-w-6xl px-5 py-8 sm:px-8 lg:px-10">
            <header className="dashboard-page-header">
                <div>
                    <h1>Minhas aplicações</h1>
                    <p>Selecione uma aplicação para abrir o painel.</p>
                </div>
                <Button href="/planos" className="dashboard-action-primary">Adquirir aplicação</Button>
            </header>

            <section className="dashboard-apps-section dashboard-apps-section-clean" aria-labelledby="dashboard-apps-heading">
                <div className="dashboard-apps-heading">
                    <h2 id="dashboard-apps-heading">Aplicações</h2>
                </div>
                <div className="dashboard-apps-list">{sorted.length === 0 ? <div className="dashboard-empty dashboard-empty-clean"><h2>Nenhuma aplicação</h2><p>Adquira uma aplicação para começar.</p><Button href="/planos" className="mt-5">Adquirir aplicação</Button></div> : <DashboardAppsGrid apps={sorted} />}</div>
            </section>
        </main>
    );
}
