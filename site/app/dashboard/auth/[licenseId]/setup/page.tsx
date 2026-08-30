import { notFound, redirect } from "next/navigation";
import { getMyAuthLicense } from "@/lib/actions/apps.actions";
import AuthSetupWizard from "@/components/AuthSetupWizard";

export const dynamic = "force-dynamic";

export default async function AuthSetupPage({ params }: { params: Promise<{ licenseId: string }> }) {
  const resolvedParams = await params;
  const license = await getMyAuthLicense(resolvedParams.licenseId).catch(() => null);
  if (!license) notFound();
  if (license.configured) redirect(`/dashboard/auth/${resolvedParams.licenseId}`);

  return <main className="auth-setup-page mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
    <section className="auth-setup-intro"><div><p className="auth-kicker"><span /> ZUROS AUTH / PRIMEIRO ACESSO</p><h1>Coloque sua autenticação no ar.</h1><p>Conecte a aplicação do Discord, escolha o servidor e deixe a camada de entrada pronta para operar.</p></div><div className="auth-setup-steps"><span className="is-current">01</span><i /><span>02</span><i /><span>03</span><small>validar · escolher · ativar</small></div></section>
    <section className="auth-setup-trust"><span>CAMADA PROTEGIDA</span><p>Os dados sensíveis são enviados ao backend do ZUROS Auth e armazenados de forma segura. Nada é exibido publicamente no painel.</p></section>
    <div className="auth-setup-wizard"><AuthSetupWizard licenseId={resolvedParams.licenseId} /></div>
  </main>;
}
