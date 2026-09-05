import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppControls } from "@/components/AppControls";
import { AppTabs } from "@/components/AppTabs";
import { BotConfigHeader } from "@/components/BotConfigHeader";
import { BotConfigIndex } from "@/components/BotConfigIndex";
import { BotPageHero } from "@/components/BotPageHero";
import { CopyButton } from "@/components/CopyButton";
import { SalesDashboard } from "@/components/SalesDashboard";
import { Badge, Button, Card, Empty, Stat } from "@/components/ui";
import { getAppDetail, listAppExtracts } from "@/lib/actions/apps.actions";
import { getSalesOverview } from "@/lib/actions/vendas.actions";
import { ActionError } from "@/lib/actions/context";
import { formatDate, formatMoney, formatUptime, getRemainingLabel, getRemainingTone } from "@/lib/status";
import { requireUser } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ appId: string }> }): Promise<Metadata> {
    const resolvedParams = await params;
    try {
        const app = await getAppDetail(resolvedParams.appId);
        return {
            title: `${app.name} · ZUROS APP`,
            description: `Detalhes, status e renovação do bot ${app.name}.`,
        };
    } catch {
        return { title: "Detalhes do bot · ZUROS APP" };
    }
}

export default async function AppDetailPage({ params }: { params: Promise<{ appId: string }> }) { const resolvedParams = await params;
    await requireUser();

    let app;
    try {
        app = await getAppDetail(resolvedParams.appId);
    } catch (error) {
        if (error instanceof ActionError) {
            notFound();
        }
        throw error;
    }

    const extracts = await listAppExtracts(resolvedParams.appId);
    const overview = await getSalesOverview(resolvedParams.appId, "7d");
    const routeId = app.botId || app.id;
    const tone = getRemainingTone(app.expiresAt, app.lifetime);

    const statusInfo = (
        <Card className="flex flex-col gap-3 text-sm">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-white">
                <span className="h-4 w-1 rounded-full bg-[var(--accent)]" />
                Informações
            </h3>
            <div className="divide-y divide-white/[.04]">
                <div className="flex justify-between py-2 text-zinc-400">
                    <span>Produto</span>
                    <span className="font-medium text-zinc-200">{app.productName}</span>
                </div>
                <div className="flex justify-between py-2 text-zinc-400">
                    <span>Versão</span>
                    <span className="font-medium text-zinc-200">v{app.version}</span>
                </div>
                <div className="flex justify-between py-2 text-zinc-400">
                    <span>Status</span>
                    <span className="font-medium text-zinc-200">{app.status === "active" ? "Ativo" : "Carência"}</span>
                </div>
            </div>
        </Card>
    );

    const controls = (
        <Card className="flex flex-col gap-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-white">
                <span className="h-4 w-1 rounded-full bg-[var(--accent)]" />
                Controles da aplicação
            </h3>
            <p className="text-sm text-zinc-400">
                Inicie, pause ou reinicie o bot, ou altere nome, token e servidor principal.
            </p>
            <AppControls appId={app.id} botId={app.botId} status={app.status} online={app.online} />
        </Card>
    );

    const droxConfig = (
        <div>
            <BotConfigHeader appId={routeId} />
            <BotConfigIndex storeId={app.id} />
        </div>
    );

    const tabContent = {
        informacoes: (
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="flex flex-col gap-4 lg:col-span-2">
                    <Card className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            {app.online ? <Badge tone="green"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Online</Badge> : <Badge tone="red"><i className="h-1.5 w-1.5 rounded-full bg-red-400" /> Offline</Badge>}
                            {app.status === "active" ? <Badge tone="green">Status: Ativo</Badge> : <Badge tone="amber">Período de carência</Badge>}
                            {app.needsUpdate && !app.errorOnUpdate && <Badge tone="amber">Atualização pendente</Badge>}
                            {app.errorOnUpdate && <Badge tone="red">Erro ao atualizar</Badge>}
                        </div>

                        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[.05] bg-white/[.04] sm:grid-cols-4">
                            <div className="flex flex-col gap-0.5 bg-background p-3.5">
                                <span className="text-[11px] uppercase tracking-wide text-zinc-500">Memória</span>
                                <span className="font-medium text-white">
                                    {app.memoryUsedMB !== null ? `${app.memoryUsedMB} MB` : "N/A"}
                                    {app.memoryMB ? ` / ${app.memoryMB} MB` : ""}
                                </span>
                            </div>
                            <div className="flex flex-col gap-0.5 bg-background p-3.5">
                                <span className="text-[11px] uppercase tracking-wide text-zinc-500">Uptime</span>
                                <span className="font-medium text-white">{formatUptime(app.uptime)}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 bg-background p-3.5">
                                <span className="text-[11px] uppercase tracking-wide text-zinc-500">Validade</span>
                                <span className={tone === "red" ? "font-medium text-red-400" : tone === "amber" ? "font-medium text-amber-400" : "font-medium text-white"}>
                                    {getRemainingLabel(app.expiresAt, app.lifetime)}
                                </span>
                            </div>
                            <div className="flex flex-col gap-0.5 bg-background p-3.5">
                                <span className="text-[11px] uppercase tracking-wide text-zinc-500">Expira em</span>
                                <span className="font-medium text-white">{formatDate(app.expiresAt)}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/70 px-3 py-2.5 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,.03)]">
                            <span className="min-w-0">
                                <span className="text-zinc-500">Bot ID: </span>
                                <code className="break-all text-zinc-200">{app.botId || "—"}</code>
                            </span>
                            {app.botId && <CopyButton text={app.botId} label="Copiar" />}
                        </div>
                    </Card>

                    <Card className="flex flex-col gap-3">
                        <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-white">
                            <span className="h-4 w-1 rounded-full bg-[var(--accent)]" />
                            Histórico de renovações
                        </h3>
                        {extracts.length === 0 ? (
                            <Empty text="Nenhuma renovação registrada." />
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-white/[.05]">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs uppercase tracking-wide text-zinc-500">
                                            <th className="py-3 pl-4 pr-4">Data</th>
                                            <th className="py-3 pr-4">Plano</th>
                                            <th className="py-3 pr-4">Preço</th>
                                            <th className="py-3 pr-4">Final</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {extracts.map((e) => (
                                            <tr key={e.id} className="border-b border-zinc-900 text-zinc-300 transition last:border-0 hover:bg-zinc-900/40">
                                                <td className="py-3 pl-4 pr-4">{formatDate(e.createdAt)}</td>
                                                <td className="py-3 pr-4">
                                                    {e.lifetime ? "Vitalício" : `${e.days} dias`}
                                                </td>
                                                <td className="py-3 pr-4">{formatMoney(e.price)}</td>
                                                <td className="py-3 pr-4 font-medium text-emerald-300">{formatMoney(e.finalPrice)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>

                <div className="flex flex-col gap-4">{statusInfo}</div>
            </div>
        ),
        controles: controls,
        "configurar-drox": droxConfig,
    };

    return (
        <main className="app-detail-page mx-auto min-w-0 max-w-6xl px-5 py-8">
            <div className="mb-6">
                <Link href="/dashboard" className="group inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-[var(--accent-strong)]">
                    <span className="transition group-hover:-translate-x-0.5">←</span> Voltar
                </Link>
                <div className="mt-4">
                    <BotPageHero
                        eyebrow="PAINEL / VISÃO GERAL"
                        title={app.name}
                        description={`${app.productName} · v${app.version}`}
                        actions={<Button href={`/dashboard/${routeId}/vendas`}>Painel de vendas</Button>}
                    />
                </div>
            </div>

            {app.errorOnUpdate && (
                <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 shadow-[0_0_24px_-12px_rgba(239,68,68,.5)]">
                    <span className="font-semibold">Falha na atualização:</span>{" "}
                    {app.errorOnUpdateMessage || "Não foi possível aplicar a última atualização automaticamente."}
                </div>
            )}

            <section className="bot-home-resumo" aria-label="Resumo operacional do bot">
                <div className="sales-status-strip">
                    <div className="sales-status-main">
                        <span className={`sales-status-dot ${app.online ? "" : "is-offline"}`} />
                        <div>
                            <strong>{app.online ? "Bot online" : "Bot offline"}</strong>
                            <small>Controle a energia da sua aplicação · {app.name}</small>
                        </div>
                    </div>
                    <div className="bot-power-controls">
                        <AppControls appId={app.id} botId={app.botId} status={app.status} online={app.online} variant="quick" />
                    </div>
                </div>

                <div className="sales-summary">
                    <Stat label="Receita · 7 dias" value={formatMoney(overview.total)} hint={`${overview.ordersCount} ${overview.ordersCount === 1 ? "pedido" : "pedidos"}`} />
                    <Stat label="Ticket médio" value={formatMoney(overview.averageTicket)} />
                    <Stat label="Hoje" value={formatMoney(overview.today)} hint={overview.todayCount ? `${overview.todayCount} venda(s)` : "Sem vendas hoje"} />
                    <article className="sales-pending-stat">
                        <span>AGUARDANDO PAGAMENTO</span>
                        <strong>{overview.pendingCount}</strong>
                        <small>Pedidos em aberto</small>
                    </article>
                </div>

                <div className="sales-chart-wrap">
                    <div className="sales-section-heading">
                        <div>
                            <p className="home-section-index">01 / OPERAÇÃO</p>
                            <h2>O que está acontecendo agora.</h2>
                        </div>
                        <span>Atualização sob demanda no seletor de período</span>
                    </div>
                    <SalesDashboard appId={resolvedParams.appId} productName={app.productName} initial={overview} />
                </div>

                {overview.recent.length > 0 && (
                    <Card className="sales-recent-card flex flex-col gap-3">
                        <div className="sales-section-title">
                            <div>
                                <p>02 / ATIVIDADE</p>
                                <h2>Últimas vendas</h2>
                            </div>
                            <span>{overview.recent.length} registros</span>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-white/[.05]">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs uppercase tracking-wide text-zinc-500">
                                        <th className="py-3 pl-4 pr-4">Data</th>
                                        <th className="py-3 pr-4">Tipo</th>
                                        <th className="py-3 pr-4">Item</th>
                                        <th className="py-3 pr-4">Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {overview.recent.map((sale) => (
                                        <tr key={`${sale.type}-${sale.id}`} className="border-b border-zinc-900 text-zinc-300 transition last:border-0 hover:bg-zinc-900/40">
                                            <td className="whitespace-nowrap py-3 pl-4 pr-4">{new Date(sale.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                                            <td className="py-3 pr-4"><span className={`sales-type-badge ${sale.type === "renew" ? "is-renew" : "is-purchase"}`}>{sale.type === "renew" ? "Renovação" : "Compra"}</span></td>
                                            <td className="py-3 pr-4">{sale.itemName}</td>
                                            <td className="py-3 pr-4 font-medium text-[var(--accent)]">{formatMoney(sale.finalPrice)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end">
                            <Button href={`/dashboard/${routeId}/vendas/pedidos`} variant="secondary" size="sm">Ver todos os pedidos</Button>
                        </div>
                    </Card>
                )}
            </section>

            <hr className="bot-home-divider" />

            <div className="bot-home-manage-heading">
                <div>
                    <p className="home-section-index">02 / GESTÃO DA APLICAÇÃO</p>
                    <h2>Informações, controles e configuração do bot.</h2>
                </div>
                <span>Renovação, energia e configurações avançadas</span>
            </div>

            <AppTabs
                tabs={[
                    { id: "informacoes", label: "Informações", content: tabContent.informacoes },
                    { id: "controles", label: "Controles", content: tabContent.controles },
                    { id: "configurar-drox", label: "Configurar DROX", content: tabContent["configurar-drox"] },
                ]}
            />
        </main>
    );
}
