import { InvoicesTable } from "@/components/InvoicesTable";
import { PageHeader } from "@/components/ui";
import { RenewalAlerts } from "@/components/RenewalAlerts";
import { getRenewPrices, listMyApps, listMyInvoices } from "@/lib/actions/apps.actions";
import { isExpiring } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
    const [invoices, apps] = await Promise.all([listMyInvoices(), listMyApps()]);
    const expiringApps = apps.filter((app) => isExpiring(app.expiresAt, app.lifetime));
    const renewalEntries = (await Promise.all(expiringApps.map(async (app) => {
        try {
            const result = await getRenewPrices(app.id);
            return { app, prices: result.prices };
        } catch {
            return null;
        }
    }))).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    return <main className="mx-auto max-w-6xl px-5 py-10">
        <PageHeader title="Faturas" subtitle="Histórico unificado de compras e renovações da sua conta." />

        <div className="sales-status-strip">
            <div className="sales-status-main">
                <span className={`sales-status-dot ${renewalEntries.length ? "is-offline" : ""}`} />
                <div>
                    <strong>{renewalEntries.length ? "Alguns planos precisam de renovação" : "Todas as faturas em dia"}</strong>
                    <small>Renovações, compras e pagamentos da sua conta em um só lugar.</small>
                </div>
            </div>
            <span className="sales-status-chip"><i /> {renewalEntries.length} em renovação</span>
        </div>

        <div className="sales-chart-wrap">
            <div className="sales-section-heading">
                <div>
                    <p className="home-section-index">01 / FATURAMENTO</p>
                    <h2>Histórico de pagamentos e renovações.</h2>
                </div>
                <span>{invoices.length} registro(s)</span>
            </div>
            <div className="mt-4"><RenewalAlerts entries={renewalEntries} /></div>
            <section className="zuros-card zuros-card-lit mt-4 p-5 sm:p-6"><InvoicesTable invoices={invoices} /></section>
        </div>
    </main>;
}
