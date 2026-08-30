import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getMyAuthLicense } from "@/lib/actions/apps.actions";
import { Badge, Card } from "@/components/ui";
import AuthOverview from "@/components/auth/AuthOverview";
import AuthServers from "@/components/auth/AuthServers";
import AuthMessage from "@/components/auth/AuthMessage";
import AuthVerified from "@/components/auth/AuthVerified";
import AuthRecovery from "@/components/auth/AuthRecovery";
import AuthGifts from "@/components/auth/AuthGifts";
import AuthSettings from "@/components/auth/AuthSettings";
import AuthTeam from "@/components/auth/AuthTeam";
import AuthCredentials from "@/components/auth/AuthCredentials";
import AuthIntegration from "@/components/auth/AuthIntegration";
import AuthLogs from "@/components/auth/AuthLogs";
import AuthTasks from "@/components/auth/AuthTasks";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = { basic: "Auth", cloud: "Bot + Auth", pro: "Completo" };
const SECTIONS = [
    { id: "overview", label: "Visão geral", kicker: "01 / SINAL", description: "O pulso da sua autenticação.", component: AuthOverview },
    { id: "servers", label: "Servidores", kicker: "02 / DESTINOS", description: "Onde o acesso acontece.", component: AuthServers },
    { id: "message", label: "Mensagem", kicker: "03 / EXPERIÊNCIA", description: "A primeira impressão de quem entra.", component: AuthMessage },
    { id: "verified", label: "Verificados", kicker: "04 / PESSOAS", description: "Membros que já passaram pelo fluxo.", component: AuthVerified },
    { id: "recovery", label: "Recuperação", kicker: "05 / CONTINUIDADE", description: "Tarefas que mantêm tudo em dia.", component: AuthRecovery },
    { id: "gifts", label: "Gifts", kicker: "06 / ACESSOS", description: "Códigos e convites sob controle.", component: AuthGifts },
    { id: "settings", label: "Configurações", kicker: "07 / REGRAS", description: "Como o seu Auth deve operar.", component: AuthSettings },
    { id: "team", label: "Equipe", kicker: "08 / PESSOAS", description: "Quem pode cuidar do sistema.", component: AuthTeam },
    { id: "credentials", label: "Credenciais", kicker: "09 / SEGURANÇA", description: "Chaves e acesso à integração.", component: AuthCredentials },
    { id: "integration", label: "Integração", kicker: "10 / CONEXÃO", description: "Dados para conectar o seu bot.", component: AuthIntegration },
    { id: "logs", label: "Logs", kicker: "11 / HISTÓRICO", description: "Tudo que aconteceu, em contexto.", component: AuthLogs },
    { id: "tasks", label: "Tarefas", kicker: "12 / PROCESSOS", description: "Trabalhos em segundo plano.", component: AuthTasks },
];

export async function generateMetadata({ params }: { params: Promise<{ licenseId: string }> }): Promise<Metadata> {
    const resolvedParams = await params;
    const license = await getMyAuthLicense(resolvedParams.licenseId).catch(() => null);
    return { title: license ? `${license.name} · ZUROS Auth` : "ZUROS Auth · ZUROS APP", description: "Gerencie a operação ZUROS Auth." };
}

export default async function AuthDashboardPage({ params }: { params: Promise<{ licenseId: string }> }) {
    const resolvedParams = await params;
    const license = await getMyAuthLicense(resolvedParams.licenseId).catch(() => null);
    if (!license) notFound();
    if (!license.configured) redirect(`/dashboard/auth/${resolvedParams.licenseId}/setup`);

    const planLabel = labels[license.plan] || license.plan;
    const isActive = license.status === "active";

    return <main id="top" className="auth-dashboard mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="auth-hero-v2">
            <div className="auth-hero-v2-main">
                <p className="auth-kicker"><span /> ZUROS AUTH / OPERATION LAYER</p>
                <div className="auth-hero-v2-heading"><div><h1>{license.name}</h1><p>Seu ponto de controle para autenticação, acesso e confiança dentro da comunidade.</p></div><span className="auth-hero-v2-mark" aria-hidden="true">Z</span></div>
                <div className="auth-hero-v2-footer"><span><i className={isActive ? "is-live" : ""} /> {isActive ? "Serviço operando" : "Atenção necessária"}</span><span>Último acesso protegido agora</span><span>Plano {planLabel}</span></div>
            </div>
            <div className="auth-hero-v2-status"><span className="auth-status-label">SINAL DO SISTEMA</span><strong>{isActive ? "Tudo em ordem" : "Revisar operação"}</strong><Badge tone={license.status === "active" ? "green" : license.status === "error" ? "red" : "amber"}>{isActive ? "ATIVO" : license.status}</Badge><small>Monitoramento contínuo do fluxo de entrada.</small></div>
        </section>

        <section className="auth-command-bar" aria-label="Resumo da operação">
            <div className="auth-command-intro"><span>PAINEL DE COMANDO</span><strong>O que precisa da sua atenção?</strong><small>Comece pelo sinal geral ou salte direto para uma área.</small></div>
            <div className="auth-command-metrics"><div><span>MEMBROS VERIFICADOS</span><strong>{license.verifiedUsers.toLocaleString("pt-BR")}</strong></div><div><span>SERVIDORES CONECTADOS</span><strong>{license.servers}</strong></div><div><span>ACESSO</span><strong className={isActive ? "is-good" : "is-warning"}>{isActive ? "Estável" : "Revisar"}</strong></div></div>
        </section>

        <nav className="auth-section-nav" aria-label="Áreas do ZUROS Auth">
            <div className="auth-section-nav-label"><span>ÍNDICE</span><small>12 áreas conectadas</small></div>
            <div className="auth-section-nav-links">{SECTIONS.map(({ id, label, kicker }) => <a key={id} href={`#${id}`}><span>{kicker.split(" /")[0]}</span>{label}</a>)}</div>
        </nav>

        <div className="auth-sections">{SECTIONS.map(({ id, label, kicker, description, component: Component }) => <section key={id} id={id} className="auth-section scroll-mt-24"><header className="auth-section-heading-v2"><div><p>{kicker}</p><h2>{label}</h2><span>{description}</span></div><a href="#top" aria-label="Voltar ao início">↑</a></header><Card><Component licenseId={resolvedParams.licenseId} /></Card></section>)}</div>
        <div className="auth-footer-note"><span>↗</span><p><strong>Camada segura.</strong> Você permanece em app.zuros.site; a comunicação com o serviço Auth acontece pelo backend protegido.</p></div>
    </main>;
}
