import Link from "next/link";
import { BrandLogo } from "./BrandLogo";

type PublicFooterProps = {
    isAuthenticated: boolean;
};

const platformLinks = [
    { href: "/#recursos", label: "Produtos" },
    { href: "/#beneficios", label: "O sistema" },
    { href: "/planos", label: "Planos" },
    { href: "/#faq", label: "Dúvidas" },
];

export function PublicFooter({ isAuthenticated }: PublicFooterProps) {
    const accountHref = isAuthenticated ? "/dashboard" : "/login";

    return (
        <footer id="suporte" className="public-footer relative overflow-hidden">
            <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
                <section className="footer-cta">
                    <div className="footer-cta-copy"><p className="home-section-index">05 / PRÓXIMO PASSO</p><h2>A operação começa quando você enxerga tudo.</h2><p>Entre no painel e tire seu projeto do improviso.</p></div>
                    <div className="footer-cta-actions"><Link href={accountHref} className="home-primary-cta">{isAuthenticated ? "Abrir dashboard" : "Entrar na plataforma"}<span aria-hidden>↗</span></Link><Link href="/planos" className="home-secondary-cta">Conhecer produtos</Link></div>
                </section>

                <div className="footer-grid">
                    <div className="footer-brand-block"><Link href="/" aria-label="ZUROS — página inicial" className="inline-flex"><BrandLogo className="h-9 w-36" /></Link><p>Gestão, vendas e aplicações Discord conectadas em uma única experiência.</p><span className="footer-status"><i />Plataforma operacional</span></div>
                    <nav aria-label="Plataforma"><h3>Plataforma</h3><ul>{platformLinks.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul></nav>
                    <nav aria-label="Conta"><h3>Conta</h3><ul><li><Link href={accountHref}>{isAuthenticated ? "Dashboard" : "Entrar"}</Link></li><li><Link href="/dashboard/store">Loja</Link></li><li><Link href="/dashboard/invoices">Faturas</Link></li></ul></nav>
                    <nav aria-label="Informações legais"><h3>Legal</h3><ul><li><Link href="/termos">Termos de uso</Link></li><li><Link href="/privacidade">Privacidade</Link></li><li><a href="mailto:suporte@zuros.app">Suporte</a></li></ul></nav>
                </div>

                <div className="footer-bottom"><p>© 2026 ZUROS APP. Todos os direitos reservados.</p><p><span aria-hidden>◈</span> Ambiente protegido e acesso seguro</p></div>
            </div>
        </footer>
    );
}
