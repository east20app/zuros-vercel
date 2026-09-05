import { notFound } from "next/navigation";
import { BotModuleEditor } from "@/components/BotModuleEditor";
import { BotConfigHeader } from "@/components/BotConfigHeader";
import { isBotConfigModule } from "@/lib/bot-config";
import { BOT_MODULE_META } from "@/lib/bot-config-meta";
export const dynamic = "force-dynamic";
export default async function ModulePage({ params }: { params: Promise<{ appId: string; modulo: string }> }) { const { appId, modulo } = await params; if (!isBotConfigModule(modulo)) notFound(); const meta = BOT_MODULE_META[modulo]; return <div className="mx-auto min-w-0 max-w-7xl px-5 py-8"><BotConfigHeader appId={appId} modulo={modulo} /><div className="sales-status-strip"><div className="sales-status-main"><span className="sales-status-dot" /><div><strong>{meta.name}</strong><small>{meta.description} · As alterações são publicadas para o seu bot pelo Discord.</small></div></div><span className="sales-status-chip"><i /> Painel do módulo</span></div><div className="sales-chart-wrap"><div className="sales-section-heading"><div><p className="home-section-index">01 / {meta.name.toUpperCase()}</p><h2>{meta.description}.</h2></div><span>Robô de configuração</span></div><div className="mt-4"><BotModuleEditor storeId={appId} modulo={modulo} /></div></div></div>; }
