import Link from "next/link";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/require-admin";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { publicMetadata } from "@/lib/site-url";

export const metadata: Metadata = publicMetadata("Status - ZUROS", "Status dos serviços ZUROS.", "/status");

export default async function StatusPage() {
    const user = await getSessionUser();
    return (
        <div className="reference-public-page min-h-screen overflow-x-clip text-white">
            <PublicNavbar user={user} />
            <main className="mx-auto w-full max-w-5xl px-5 py-20 sm:px-8 sm:py-28">
                <header className="mb-12 text-center">
                    <p className="home-kicker"><span className="home-kicker-mark" />ZUROS / STATUS</p>
                    <h1 className="reference-public-title">Status dos <span>serviços.</span></h1>
                    <p className="reference-public-lede mx-auto">Acompanhe a disponibilidade dos serviços da plataforma.</p>
                </header>
                <section className="reference-status-panel" aria-label="Status da plataforma">
                    <div className="reference-status-row"><span className="reference-status-dot" /> Plataforma ZUROS <strong>Operacional</strong></div>
                    <div className="reference-status-row"><span className="reference-status-dot" /> Aplicações e bots <strong>Operacional</strong></div>
                    <div className="reference-status-row"><span className="reference-status-dot" /> Pagamentos <strong>Operacional</strong></div>
                </section>
                <div className="mt-8 text-center"><Link href="/" className="text-sm text-zinc-500 hover:text-white">Voltar ao início</Link></div>
            </main>
            <PublicFooter isAuthenticated={!!user} />
        </div>
    );
}
