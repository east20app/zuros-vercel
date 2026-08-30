import Link from "next/link";
import { getBotIdentity } from "@/lib/actions/apps.actions";
import { BOT_MODULE_META } from "@/lib/bot-config-meta";
import { isBotConfigModule } from "@/lib/bot-config";

export async function BotConfigHeader({ appId, modulo }: { appId: string; modulo?: string }) {
    let bot = null;
    try {
        bot = await getBotIdentity(appId);
    } catch {
        // Sem identidade (ex.: aplicação removida) o header só exibe o breadcrumb.
    }

    const moduleMeta = modulo && isBotConfigModule(modulo) ? BOT_MODULE_META[modulo] : null;

    return <div className="bot-config-header">
        <nav aria-label="Breadcrumb" className="bot-breadcrumb"><Link href="/dashboard">Painel</Link><span aria-hidden>/</span><Link href="/dashboard">Meus Bots</Link><span aria-hidden>/</span>{bot ? <Link href={`/dashboard/${bot.id}`} className="max-w-40 truncate">{bot.name}</Link> : <span>Configurações</span>}{moduleMeta && <><span aria-hidden>/</span><Link href={`/dashboard/${appId}/config`}>Config</Link><span aria-hidden>/</span><span aria-current="page" className="truncate text-zinc-300">{moduleMeta.name}</span></>}</nav>
        <div className="bot-identity"><span className="bot-identity-mark">{bot ? bot.name.charAt(0).toUpperCase() : "?"}</span><div className="min-w-0"><p className="bot-identity-kicker">CONFIGURAÇÃO / {moduleMeta ? moduleMeta.name : "VISÃO GERAL"}</p><h1>{bot ? bot.name : "Configurações do Bot"}</h1><p>{bot ? bot.productName : "Gerencie os recursos da sua instância DROX."}</p></div></div>
    </div>;
}
