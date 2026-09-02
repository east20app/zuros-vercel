import Link from "next/link";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/require-admin";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { publicMetadata } from "@/lib/site-url";

export const metadata: Metadata = publicMetadata("Sobre - ZUROS", "Conheça a plataforma ZUROS.", "/sobre");

export default async function AboutPage() {
    const user = await getSessionUser();
    return (
        <div className="reference-public-page min-h-screen overflow-x-clip text-white">
            <PublicNavbar user={user} />
            <main className="mx-auto flex w-full max-w-6xl flex-col items-center px-5 py-24 text-center sm:px-8 sm:py-32">
                <p className="home-kicker"><span className="home-kicker-mark" />ZUROS / SOBRE</p>
                <h1 className="reference-public-title">Automação para <span>servidores profissionais.</span></h1>
                <p className="reference-public-lede">Sistemas completos de vendas, tickets e gestão. Automatize cada detalhe do seu servidor e foque no seu crescimento.</p>
                <Link href="/planos" className="home-primary-cta mt-8">Ver Planos <span aria-hidden>↗</span></Link>
            </main>
            <PublicFooter isAuthenticated={!!user} />
        </div>
    );
}
