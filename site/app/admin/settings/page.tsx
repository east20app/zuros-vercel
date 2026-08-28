import { Card } from "@/components/ui";
import { BotIdentityForm, CamposTokenForm, PaymentForm } from "@/components/SettingsForms";
import { getBotIdentity, getSettingsView } from "@/lib/actions/admin.actions";
import { CertificateUploader } from "@/components/CertificateUploader";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
    const [settings, identity] = await Promise.all([
        getSettingsView(),
        getBotIdentity().catch(() => null),
    ]);

    return (
        <div className="flex flex-col gap-6">
            <div>
                <div className="flex items-center gap-2.5">
                    <span className="h-6 w-1 rounded-full bg-gradient-to-b from-violet-400 to-purple-600" />
                    <h1 className="text-2xl font-bold tracking-tight text-white">Configurações</h1>
                </div>
                <p className="mt-1.5 text-sm text-zinc-500">Pagamentos e identidade do bot.</p>
            </div>
            <Card className="flex flex-col gap-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-white"><span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-purple-600" />Certificado EFI</h2><p className="text-xs text-zinc-500">Equivalente ao comando /enviarcertificado. Aceita .p12, .pfx e .pem até 5 MB.</p><CertificateUploader /></Card>

            {identity ? (
                <Card className="flex flex-col gap-4 border-indigo-500/15">
                    <div>
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><span className="h-4 w-1 rounded-full bg-gradient-to-b from-indigo-400 to-violet-600" />Integração da infraestrutura</h2>
                        <p className="mt-1.5 text-xs leading-5 text-zinc-500">Gerencie a chave usada para criar, consultar e atualizar as aplicações dos clientes.</p>
                    </div>
                    <CamposTokenForm configured={settings.tokenCamposConfigured} masked={settings.tokenCamposMasked} />
                </Card>
            ) : null}
            <div className="grid gap-6">
                <Card className="flex flex-col gap-4">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-purple-600" />Pagamento</h2>
                    <p className="text-xs text-zinc-500">
                        Gateway usado nas vendas e renovações PIX.
                    </p>
                    <PaymentForm settings={settings} />
                </Card>
            </div>

            {identity ? (
                <Card className="flex flex-col gap-4">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-purple-600" />Identidade do bot no Discord</h2>
                    <p className="text-xs text-zinc-500">
                        Sincroniza a biografia e as presenças usadas pelo bot. Disponível apenas para o proprietário.
                    </p>
                    <BotIdentityForm identity={identity} />
                </Card>
            ) : null}

            <Card className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-purple-600" />Suas lojas</h2>
                <div className="flex flex-wrap gap-2">
                    {settings.stores.map((store) => (
                        <span key={store.id} className="rounded-lg border border-zinc-800/80 bg-black/30 px-3 py-1.5 text-sm text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,.02)]">
                            {store.name}
                        </span>
                    ))}
                    {settings.stores.length === 0 && (
                        <span className="text-sm text-zinc-500">
                            Nenhuma loja criada ainda.
                        </span>
                    )}
                </div>
            </Card>
        </div>
    );
}
