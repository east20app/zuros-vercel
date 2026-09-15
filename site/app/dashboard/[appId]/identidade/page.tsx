import { notFound } from "next/navigation";
import { AppIdentityPanel } from "@/components/AppIdentityPanel";
import { getAppDetail } from "@/lib/actions/apps.actions";
import { ActionError } from "@/lib/actions/context";

export default async function IdentityPage({ params }: { params: Promise<{ appId: string }> }) {
    const { appId } = await params;
    try {
        const app = await getAppDetail(appId);
        return <main className="mx-auto w-full max-w-6xl space-y-6 px-5 py-6"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--accent)]">Configurações do bot</p><h1 className="mt-2 text-2xl font-semibold text-white">Identidade e acesso</h1><p className="mt-2 max-w-2xl text-sm text-zinc-400">Gerencie o nome e substitua o token do bot com validação de propriedade e sem exibir o segredo atual.</p></div><AppIdentityPanel appId={appId} currentName={app.name} botId={app.botId} /></main>;
    } catch (error) {
        if (error instanceof ActionError) notFound();
        throw error;
    }
}
