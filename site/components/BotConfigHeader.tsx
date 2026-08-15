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

    return (
        <div className="mb-6 flex flex-col gap-4">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                <Link href="/dashboard" className="transition hover:text-emerald-300">Painel</Link>
                <span aria-hidden className="text-zinc-700">/</span>
                <Link href="/dashboard" className="transition hover:text-emerald-300">Meus Bots</Link>
                <span aria-hidden className="text-zinc-700">/</span>
                {bot ? (
                    <Link href={`/dashboard/${bot.id}`} className="max-w-40 truncate transition hover:text-emerald-300">{bot.name}</Link>
                ) : (
                    <span>Configurações</span>
                )}
                {moduleMeta && (
                    <>
                        <span aria-hidden className="text-zinc-700">/</span>
                        <Link href={`/dashboard/${appId}/config`} className="transition hover:text-emerald-300">Config</Link>
                        <span aria-hidden className="text-zinc-700">/</span>
                        <span aria-current="page" className="truncate text-zinc-300">{moduleMeta.name}</span>
                    </>
                )}
            </nav>

            <div className="flex flex-wrap items-center gap-3.5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/20 to-transparent text-lg font-bold text-emerald-300 shadow-[0_0_22px_-8px_rgba(16,185,129,.55)]">
                    {bot ? bot.name.charAt(0).toUpperCase() : "?"}
                </span>
                <div className="min-w-0">
                    <h1 className="truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                        {bot ? bot.name : "Configurações do Bot"}
                    </h1>
                    <p className="mt-0.5 truncate text-sm text-[#949ba4]">
                        {bot ? bot.productName : "Gerencie os recursos da sua instância DROX."}
                        {moduleMeta ? ` · ${moduleMeta.name}` : ""}
                    </p>
                </div>
            </div>
        </div>
    );
}
