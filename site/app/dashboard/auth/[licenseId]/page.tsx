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
    { id: "overview", label: "Overview", component: AuthOverview },
    { id: "servers", label: "Servidores", component: AuthServers },
    { id: "message", label: "Mensagem", component: AuthMessage },
    { id: "verified", label: "Verificados", component: AuthVerified },
    { id: "recovery", label: "Recovery", component: AuthRecovery },
    { id: "gifts", label: "Gifts", component: AuthGifts },
    { id: "settings", label: "Configurações", component: AuthSettings },
    { id: "team", label: "Equipe", component: AuthTeam },
    { id: "credentials", label: "Credenciais", component: AuthCredentials },
    { id: "integration", label: "Key de integração", component: AuthIntegration },
    { id: "logs", label: "Logs", component: AuthLogs },
    { id: "tasks", label: "Tasks", component: AuthTasks },
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

    return <main className="auth-dashboard mx-auto max-w-6xl px-4 py-7 sm:px-6">
        <section className="auth-hero"><div><p className="home-kicker"><span className="home-kicker-mark" />ZUROS AUTH / CONTROL ROOM</p><h1>{license.name}</h1><p>Gerencie autenticação, servidores e sinais de acesso sem sair do painel ZUROS.</p></div><div className="auth-hero-status"><span>ESTADO DO PRODUTO</span><Badge tone={license.status === "active" ? "green" : license.status === "error" ? "red" : "amber"}>{license.status === "active" ? "Ativo" : license.status}</Badge><small>Plano {labels[license.plan] || license.plan}</small></div></section>
        <section className="auth-summary" aria-label="Resumo do ZUROS Auth"><article><span>PLANO</span><strong>{labels[license.plan] || license.plan}</strong></article><article><span>SERVIDORES</span><strong>{license.servers}</strong></article><article><span>VERIFICADOS</span><strong>{license.verifiedUsers.toLocaleString("pt-BR")}</strong></article><article><span>STATUS</span><strong className={license.status === "active" ? "is-good" : "is-warning"}>{license.status === "active" ? "Operando" : "Revisar"}</strong></article></section>
        <div className="auth-sections">{SECTIONS.map(({ id, label, component: Component }, index) => <section key={id} id={id} className="auth-section scroll-mt-24"><div className="auth-section-heading"><span>0{index + 1}</span><h2>{label}</h2></div><Card><Component licenseId={resolvedParams.licenseId} /></Card></section>)}</div>
        <div className="auth-footer-note"><span>↗</span><p><strong>Camada segura.</strong> Você permanece em app.zuros.site; a comunicação com o serviço Auth acontece pelo backend protegido.</p></div>
    </main>;
}
