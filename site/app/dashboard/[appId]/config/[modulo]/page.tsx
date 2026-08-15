import { notFound } from "next/navigation";
import { BotModuleEditor } from "@/components/BotModuleEditor";
import { BotConfigHeader } from "@/components/BotConfigHeader";
import { isBotConfigModule } from "@/lib/bot-config";
export const dynamic = "force-dynamic";
export default function ModulePage({ params }: { params: { appId: string; modulo: string } }) { if (!isBotConfigModule(params.modulo)) notFound(); return <div className="mx-auto min-w-0 max-w-7xl px-5 py-8"><BotConfigHeader appId={params.appId} modulo={params.modulo} /><div className="mt-6"><BotModuleEditor storeId={params.appId} modulo={params.modulo} /></div></div>; }
