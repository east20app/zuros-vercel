import { notFound } from "next/navigation";
import { BotModuleEditor } from "@/components/BotModuleEditor";
import { BotConfigHeader } from "@/components/BotConfigHeader";
import { isBotConfigModule } from "@/lib/bot-config";
export const dynamic = "force-dynamic";
export default async function ModulePage({ params }: { params: Promise<{ appId: string; modulo: string }> }) { const { appId, modulo } = await params; if (!isBotConfigModule(modulo)) notFound(); return <div className="mx-auto min-w-0 max-w-7xl px-5 py-8"><BotConfigHeader appId={appId} modulo={modulo} /><div className="mt-6"><BotModuleEditor storeId={appId} modulo={modulo} /></div></div>; }
