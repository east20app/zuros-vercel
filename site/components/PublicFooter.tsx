import Link from "next/link";
import { BrandLogo } from "./BrandLogo";

type PublicFooterProps = {
    isAuthenticated: boolean;
};

const platformLinks = [
    { href: "/#recursos", label: "Produtos" },
    { href: "/#beneficios", label: "Benefícios" },
    { href: "/planos", label: "Planos" },
    { href: "/#faq", label: "Dúvidas frequentes" },
];

export function PublicFooter({ isAuthenticated }: PublicFooterProps) {
    const accountHref = isAuthenticated ? "/dashboard" : "/login";

    return (
        <footer id="suporte" className="relative overflow-hidden border-t border-white/[.06] bg-[#030409]">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,.16),transparent_68%)]" />
            <div className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
                <section className="overflow-hidden rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/[.16] via-[#0d1020] to-[#080a12] p-7 shadow-[0_24px_80px_-36px_rgba(124,58,237,.65)] sm:p-10">
                    <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
                        <div className="max-w-2xl">
                            <span className="zuros-pill">Pronto para começar?</span>
                            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Sua operação mais simples começa aqui.</h2>
                            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">Centralize vendas, configurações e aplicações Discord em uma plataforma criada para crescer com o seu negócio.</p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                            <Link href={accountHref} className="zuros-btn-glow rounded-xl bg-indigo-500 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-400">
                                {isAuthenticated ? "Abrir dashboard" : "Entrar na plataforma"}
                            </Link>
                            <Link href="/planos" className="rounded-xl border border-white/10 bg-white/[.04] px-6 py-3 text-center text-sm font-semibold text-zinc-200 hover:border-white/20 hover:bg-white/[.07]">
                                Conhecer produtos
                            </Link>
                        </div>
                    </div>
                </section>

                <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.45fr_1fr_1fr_1fr]">
                    <div className="max-w-sm">
                        <Link href="/" aria-label="ZUROS — página inicial" className="inline-flex">
                            <BrandLogo className="h-10 w-40" />
                        </Link>
                        <p className="mt-5 text-sm leading-6 text-zinc-500">Gestão, vendas e aplicações Discord conectadas em uma única experiência.</p>
                        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/[.06] px-3 py-1.5 text-xs font-medium text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.9)]" />
                            Plataforma operacional
                        </div>
                    </div>

                    <nav aria-label="Plataforma">
                        <h3 className="text-xs font-semibold uppercase tracking-[.18em] text-zinc-300">Plataforma</h3>
                        <ul className="mt-5 space-y-3">
                            {platformLinks.map((link) => <li key={link.href}><Link href={link.href} className="text-sm text-zinc-500 hover:text-white">{link.label}</Link></li>)}
                        </ul>
                    </nav>

                    <nav aria-label="Minha conta">
                        <h3 className="text-xs font-semibold uppercase tracking-[.18em] text-zinc-300">Minha conta</h3>
                        <ul className="mt-5 space-y-3">
                            <li><Link href={accountHref} className="text-sm text-zinc-500 hover:text-white">{isAuthenticated ? "Dashboard" : "Entrar"}</Link></li>
                            <li><Link href="/dashboard/store" className="text-sm text-zinc-500 hover:text-white">Loja</Link></li>
                            <li><Link href="/dashboard/invoices" className="text-sm text-zinc-500 hover:text-white">Faturas</Link></li>
                        </ul>
                    </nav>

                    <nav aria-label="Informações legais">
                        <h3 className="text-xs font-semibold uppercase tracking-[.18em] text-zinc-300">Legal</h3>
                        <ul className="mt-5 space-y-3">
                            <li><Link href="/termos" className="text-sm text-zinc-500 hover:text-white">Termos de uso</Link></li>
                            <li><Link href="/privacidade" className="text-sm text-zinc-500 hover:text-white">Política de privacidade</Link></li>
                        </ul>
                    </nav>
                </div>

                <div className="flex flex-col gap-4 border-t border-white/[.06] pt-6 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
                    <p>© 2026 ZUROS APP. Todos os direitos reservados.</p>
                    <p className="inline-flex items-center gap-2"><span aria-hidden>◈</span> Ambiente protegido e acesso seguro</p>
                </div>
            </div>
        </footer>
    );
}