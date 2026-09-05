import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { BotConfigHeader } from "@/components/BotConfigHeader";
import { BotPageHero } from "@/components/BotPageHero";
import { Card } from "@/components/ui";
import { ServerManager } from "@/components/ServerManager";
import { getBotIdentity, listBotGuilds } from "@/lib/actions/apps.actions";
import { ActionError } from "@/lib/actions/context";
import { requireUser } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Servidores · ZUROS APP" };

export default async function BotServersPage({ params }: { params: Promise<{ appId: string }> }) { const resolvedParams = await params;
    await requireUser();
    let bot;
    let guilds;
    try {
        [bot, guilds] = await Promise.all([getBotIdentity(resolvedParams.appId), listBotGuilds(resolvedParams.appId)]);
    } catch (error) {
        if (error instanceof ActionError) notFound();
        throw error;
    }

    return (
        <main className="mx-auto min-w-0 max-w-6xl px-5 py-8 sm:px-8">
            <BotConfigHeader appId={resolvedParams.appId} />
            <BotPageHero
                eyebrow="GERENCIAMENTO / PRESENÇA"
                title="Servidores"
                description={`${bot.name} está presente em ${guilds.length} servidor(es).`}
                meta={<span className="bot-page-hero-meta"><span>Servidores</span><strong>{guilds.length}</strong><small>Autorizados pelo Discord</small></span>}
            />
            <div className="mt-6"><ServerManager appId={resolvedParams.appId} botId={bot.botId} guilds={guilds} /></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {guilds.map((guild) => (
                    <Card key={guild.id} className="group flex items-center gap-4 transition hover:border-[#7c3aed]/40">
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#7c3aed]/15 text-[#949cf7]">
                            <Icon name="apps" />
                        </span>
                        <span className="min-w-0">
                            <b className="block truncate text-sm text-white">{guild.name}</b>
                            <code className="mt-1 block truncate text-xs text-zinc-500">{guild.id}</code>
                        </span>
                    </Card>
                ))}
            </div>
            {guilds.length === 0 ? (
                <Card className="mt-6 border-dashed py-12 text-center">
                    <p className="text-sm font-medium text-zinc-300">Nenhum servidor encontrado</p>
                    <p className="mt-1 text-xs text-zinc-500">Adicione o bot a um servidor e atualize esta página.</p>
                </Card>
            ) : null}
        </main>
    );
}
