import { notFound } from "next/navigation";
import { BotModuleEditor } from "@/components/BotModuleEditor";
import { isBotConfigModule } from "@/lib/bot-config";
import { BOT_MODULE_META } from "@/lib/bot-config-meta";
export const dynamic = "force-dynamic";
export default async function ModulePage({ params }: { params: Promise<{ appId: string; modulo: string }> }) {
    const { appId, modulo } = await params;
    if (!isBotConfigModule(modulo)) notFound();
    const meta = BOT_MODULE_META[modulo];
    if (modulo === "tickets") return <main className="ticket-config-page"><BotModuleEditor storeId={appId} modulo={modulo} /></main>;
    return (
        <main className="module-config-page">
            <header className="module-config-heading">
                <p>CONFIGURAÇÃO DO BOT</p>
                <h1>{meta.name}</h1>
                <span>{meta.description}.</span>
            </header>
            <BotModuleEditor storeId={appId} modulo={modulo} />
        </main>
    );
}
