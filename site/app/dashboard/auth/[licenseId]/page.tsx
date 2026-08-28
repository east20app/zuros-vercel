import { notFound, redirect } from "next/navigation";
import { getMyAuthLicense } from "@/lib/actions/apps.actions";
import { Badge, Card, PageHeader } from "@/components/ui";
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

export default async function AuthDashboardPage({ params }: { params: Promise<{ licenseId: string }> }) { const resolvedParams = await params;
  const license = await getMyAuthLicense(resolvedParams.licenseId).catch(() => null);
  if (!license) notFound();
  if (!license.configured) redirect(`/dashboard/auth/${resolvedParams.licenseId}/setup`);

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
      <PageHeader title={license.name} subtitle="Gerencie o ZUROS Auth sem sair do painel ZUROS." />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wider text-zinc-500">Status</p>
          <div className="mt-3">
            <Badge tone={license.status === "active" ? "green" : license.status === "error" ? "red" : "amber"}>
              {license.status === "active" ? "Ativo" : license.status}
            </Badge>
          </div>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-zinc-500">Plano</p>
          <p className="mt-3 text-xl font-semibold text-white">{labels[license.plan] || license.plan}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-zinc-500">Servidores</p>
          <p className="mt-3 text-xl font-semibold text-white">{license.servers}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-zinc-500">Usuários verificados</p>
          <p className="mt-3 text-xl font-semibold text-white">{license.verifiedUsers.toLocaleString("pt-BR")}</p>
        </Card>
      </div>

      <div className="mt-8 space-y-8">
        {SECTIONS.map(({ id, label, component: Component }) => (
          <section key={id} id={id} className="scroll-mt-24">
            <h2 className="mb-4 text-lg font-semibold text-white">{label}</h2>
            <Card>
              <Component licenseId={resolvedParams.licenseId} />
            </Card>
          </section>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm text-violet-200">
        Painel unificado: você permanece em app.zuros.site. A comunicação com o serviço Auth acontece pelo backend seguro.
      </div>
    </main>
  );
}
