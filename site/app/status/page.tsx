import Link from "next/link";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/require-admin";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { publicMetadata } from "@/lib/site-url";
import { getPublicServiceStatus } from "@/lib/public-status";

export const metadata: Metadata = publicMetadata("Status - ZUROS", "Status dos serviços ZUROS.", "/status");

const labels = { operational: "Operacional", degraded: "Instabilidade", unknown: "Não verificado" } as const;
const tones = { operational: "reference-status-dot is-good", degraded: "reference-status-dot is-warning", unknown: "reference-status-dot is-unknown" } as const;

export default async function StatusPage() {
    let user = null;
    try { user = await getSessionUser(); } catch { /* A página continua útil sem sessão/banco. */ }
    const services = await getPublicServiceStatus();
    const checkedAt = services[0]?.checkedAt ? new Date(services[0].checkedAt).toLocaleString("pt-BR") : "agora";
    return (
        <div className="reference-public-page min-h-screen overflow-x-clip text-white">
            <PublicNavbar user={user} />
            <main className="mx-auto w-full max-w-5xl px-5 py-20 sm:px-8 sm:py-28">
                <header className="mb-12 text-center">
                    <p className="home-kicker"><span className="home-kicker-mark" />ZUROS / STATUS</p>
                    <h1 className="reference-public-title">Status dos <span>serviços.</span></h1>
                    <p className="reference-public-lede mx-auto">Verificações independentes, com horário e explicação para cada estado.</p>
                </header>
                <section className="reference-status-panel" aria-label="Status da plataforma">
                    {services.map((service) => <div key={service.label} className="reference-status-row"><span className={tones[service.state]} /> <span className="min-w-0 flex-1"><b className="block">{service.label}</b><small className="text-zinc-500">{service.detail}</small></span><strong>{labels[service.state]}</strong></div>)}
                </section>
                <p className="mt-4 text-center text-xs text-zinc-500">Última verificação: {checkedAt}. “Não verificado” significa que não há evidência suficiente nesta consulta.</p>
                <div className="mt-8 text-center"><Link href="/" className="text-sm text-zinc-500 hover:text-white">Voltar ao início</Link></div>
            </main>
            <PublicFooter isAuthenticated={!!user} />
        </div>
    );
}
