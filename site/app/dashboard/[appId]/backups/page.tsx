import { notFound } from "next/navigation";
import { BackupsPanel } from "@/components/BackupsPanel";
import { BotConfigHeader } from "@/components/BotConfigHeader";
import { getBotBackups } from "@/lib/actions/backups.actions";

export const dynamic = "force-dynamic";

export default async function BackupsPage({ params }: { params: Promise<{ appId: string }> }) {
    const { appId } = await params;
    let data;
    try {
        data = await getBotBackups(appId);
    } catch {
        notFound();
    }
    return (
        <div className="mx-auto min-w-0 max-w-7xl px-5 py-8">
            <BotConfigHeader appId={appId} />
            <div className="sales-status-strip">
                <div className="sales-status-main">
                    <span className="sales-status-dot" />
                    <div>
                        <strong>Backups do servidor</strong>
                        <small>Liste, crie, restaure e apague backups do seu bot pela fila espelhada no MongoDB.</small>
                    </div>
                </div>
                <span className="sales-status-chip"><i /> Sincronizado via Mongo</span>
            </div>
            <div className="sales-chart-wrap">
                <div className="sales-section-heading">
                    <div>
                        <p className="home-section-index">01 / BACKUPS</p>
                        <h2>Segurança dos seus dados, no mesmo lugar.</h2>
                    </div>
                    <span>Assistente de backup</span>
                </div>
                <div className="mt-4">
                    <BackupsPanel appId={appId} initial={data.backups} auto={data.auto} />
                </div>
            </div>
        </div>
    );
}