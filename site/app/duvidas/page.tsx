import type { Metadata } from "next";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { FaqAccordion } from "@/components/FaqAccordion";
import { getSessionUser } from "@/lib/require-admin";
import TileBackground from "@/components/TileBackground";

export const metadata: Metadata = {
    title: "Dúvidas frequentes · ZUROS APP",
    description: "Respostas sobre planos, configuração, bots e suporte da ZUROS.",
};

export default async function QuestionsPage() {
    const user = await getSessionUser();
    return (
        <div className="reference-public-page min-h-screen overflow-x-clip text-white">
            <TileBackground />
            <PublicNavbar user={user} />
            <main className="mx-auto w-full max-w-4xl px-5 py-20 sm:px-8 sm:py-28">
                <header className="mb-12 text-center">
                    <p className="home-kicker"><span className="home-kicker-mark" />ZUROS / DÚVIDAS</p>
                    <h1 className="reference-public-title">Respostas para começar <span>com clareza.</span></h1>
                    <p className="reference-public-lede mx-auto">Planos, configuração, pagamentos, suporte e operação dos seus bots em um só lugar.</p>
                </header>
                <section aria-label="Perguntas frequentes" className="zuros-card p-5 sm:p-8"><FaqAccordion /></section>
            </main>
            <PublicFooter isAuthenticated={!!user} />
        </div>
    );
}
