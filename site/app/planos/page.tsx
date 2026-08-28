import Link from "next/link";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/require-admin";
import { getUserPendingCount } from "@root/src/integration/public-dashboard";
import { listStoreCatalogs } from "@root/src/integration/purchases";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicStoreCatalog } from "@/components/PublicStoreCatalog";
import { BrandLogo } from "@/components/BrandLogo";
import { publicMetadata } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const metadata: Metadata = publicMetadata("Planos e preços · ZUROS APP", "Planos mensais para potencializar seus projetos e comunidades.", "/planos");

export default async function PlansPage() {
    const userPromise = getSessionUser();
    const catalogsPromise = listStoreCatalogs();
    const user = await userPromise;
    const [catalogs, pendingCount] = await Promise.all([catalogsPromise, user ? getUserPendingCount(user.discordId) : Promise.resolve(0)]);
    return <div className="relative min-h-screen text-white"><div className="zuros-backdrop" aria-hidden /><div className="zuros-grid" aria-hidden /><AnnouncementBar /><PublicNavbar user={user} pendingCount={pendingCount} />
        <main><section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-16 text-center sm:px-6 sm:pt-24"><span className="inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">Planos mensais</span><h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-[-.035em] sm:text-6xl">Busque um plano para <span className="text-emerald-400">potencializar seus projetos.</span></h1><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-zinc-500 sm:text-lg">De projetos em estágio inicial a comunidades em crescimento, a ZUROS tem soluções profissionais para sua operação.</p></section>
        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">{catalogs.length ? <PublicStoreCatalog stores={catalogs} canPurchase={!!user} /> : <div className="zuros-card border-dashed py-16 text-center text-sm text-zinc-600">Nenhum produto mensal disponível no momento.</div>}<p className="mt-8 text-center text-xs leading-5 text-zinc-600">Atenção: os preços acima estão sujeitos a alterações sem aviso prévio, assim como a disponibilidade das unidades.</p></section></main>
        <footer id="suporte" className="mt-16 border-t border-zinc-900/80 bg-[#060609]/85"><div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.6fr_1fr_1fr_1fr]"><div><Link href="/" aria-label="ZUROS — início" className="inline-flex"><BrandLogo className="h-10 w-40" /></Link><p className="mt-4 max-w-sm text-sm leading-6 text-zinc-500">Plataforma para criação, venda e gerenciamento de aplicações Discord. Simplifique sua operação com ferramentas profissionais.</p></div><div><h2 className="text-sm font-semibold">Produto</h2><nav className="mt-4 space-y-3 text-sm text-zinc-500"><Link className="block hover:text-white" href="/planos">Planos e preços</Link><Link className="block hover:text-white" href="/#beneficios">Recursos</Link></nav></div><div><h2 className="text-sm font-semibold">Suporte</h2><nav className="mt-4 space-y-3 text-sm text-zinc-500"><a className="block hover:text-white" href="#suporte">FAQ</a><a className="block hover:text-white" href="#suporte">Comunidade Discord</a><a className="block hover:text-white" href="mailto:suporte@zuros.app">Suporte por e-mail</a></nav></div><div><h2 className="text-sm font-semibold">Legal</h2><nav className="mt-4 space-y-3 text-sm text-zinc-500"><Link className="block hover:text-white" href="/termos">Termos de uso</Link><Link className="block hover:text-white" href="/privacidade">Política de privacidade</Link></nav></div></div><div className="border-t border-zinc-900/80"><div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-zinc-600 sm:flex-row sm:justify-between sm:px-6"><span>© 2026 ZUROS APP. Todos os direitos reservados.</span><span>Aplicações · Discord · Automação</span></div></div></footer>
    </div>;
}
