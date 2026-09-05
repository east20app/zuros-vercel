import { Empty } from "@/components/ui";

export default function AffiliatesPage() {
    return (
        <main className="account-page mx-auto max-w-6xl px-5 py-8 sm:px-8">
            <section className="account-heading"><div><p className="home-kicker"><span className="home-kicker-mark" />CONTA / AFILIADOS</p><h1>Suas indicações.</h1><p>Gere convites e acompanhe suas recompensas em um só lugar.</p></div><span className="account-heading-code">ACCOUNT / AFF</span></section>

            <div className="sales-status-strip">
                <div className="sales-status-main">
                    <span className="sales-status-dot" />
                    <div>
                        <strong>Programa em preparação</strong>
                        <small>Em breve você acompanha indicações, conversões e recompensas por aqui.</small>
                    </div>
                </div>
                <span className="sales-status-chip"><i /> Em breve</span>
            </div>

            <div className="sales-chart-wrap">
                <div className="sales-section-heading">
                    <div>
                        <p className="home-section-index">01 / INDICAÇÕES</p>
                        <h2>Suas missões de afiliado.</h2>
                    </div>
                    <span>Disponível em breve</span>
                </div>
                <Empty icon={<span className="text-2xl">↗</span>} title="Programa de afiliados" text="Em breve você poderá acompanhar suas indicações e recompensas por aqui." />
            </div>
        </main>
    );
}