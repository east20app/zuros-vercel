import type { Metadata } from "next";
import { DashboardAppsGrid } from "@/components/DashboardAppsGrid";
import { Icon, type IconName } from "@/components/Icon";
import { Button } from "@/components/ui";
import { listMyApps } from "@/lib/actions/apps.actions";
import { requireUser } from "@/lib/require-admin";
import { getRemainingLabel, isExpiring } from "@/lib/status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Visão geral · ZUROS APP",
    description: "Acompanhe a operação das suas aplicações ZUROS.",
};

type SummaryTone = "lime" | "green" | "coral";

type SummaryItem = {
    label: string;
    value: string | number;
    hint: string;
    icon: IconName;
    tone: SummaryTone;
};

export default async function DashboardPage() {
    const [user, apps] = await Promise.all([requireUser(), listMyApps()]);
    const activeCount = apps.filter((app) => app.status === "active" && !app.errorOnUpdate).length;
    const attentionApps = apps.filter((app) => app.status !== "active" || app.errorOnUpdate || isExpiring(app.expiresAt, app.lifetime));
    const nextExpiration = apps
        .filter((app) => !app.lifetime && app.expiresAt)
        .sort((a, b) => new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime())[0];
    const storeCount = new Set(apps.map((app) => app.storeName).filter(Boolean)).size;
    const authApps = apps.filter((app) => app.kind === "auth");
    const authCount = authApps.length;
    const healthPercent = apps.length ? Math.round((activeCount / apps.length) * 100) : 0;
    const operationState = apps.length === 0 ? "Pronta para começar" : attentionApps.length === 0 ? "Tudo em ordem" : activeCount > 0 ? "Pede uma olhada" : "Precisa de atenção";
    const operationDetail = apps.length === 0 ? "Conecte sua primeira aplicação" : `${activeCount} de ${apps.length} ${apps.length === 1 ? "aplicação está" : "aplicações estão"} operando normalmente`;
    const firstName = user.name?.trim().split(/\s+/)[0] || "operador";

    const summary: SummaryItem[] = [
        { label: "Aplicações", value: apps.length, hint: storeCount ? `${storeCount} ${storeCount === 1 ? "loja conectada" : "lojas conectadas"}` : "Nenhuma conexão ainda", icon: "apps", tone: "lime" },
        { label: "Em operação", value: activeCount, hint: apps.length ? `${healthPercent}% do seu ambiente` : "Aguardando seu primeiro app", icon: "check", tone: "green" },
        { label: "Próximo marco", value: nextExpiration ? getRemainingLabel(nextExpiration.expiresAt, false) : "Livre", hint: nextExpiration ? "Renovação mais próxima" : "Sem vencimentos próximos", icon: "alert", tone: attentionApps.length ? "coral" : "lime" },
    ];

    const sorted = [...apps].sort((a, b) => {
        const rank = (app: (typeof apps)[number]) => {
            let value = 0;
            if (app.errorOnUpdate) value += 1000;
            if (isExpiring(app.expiresAt, app.lifetime)) value += 500;
            if (app.status !== "active") value += 200;
            return value;
        };
        const difference = rank(b) - rank(a);
        if (difference !== 0) return difference;
        const aTime = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
        const bTime = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
        return aTime - bTime;
    });

    return (
        <main className="dashboard-home dashboard-home-v2 mx-auto min-w-0 max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
            <section className="dashboard-command-hero">
                <div className="dashboard-command-copy">
                    <p className="home-kicker"><span className="home-kicker-mark" />PAINEL / VISÃO GERAL</p>
                    <h1>Olá, {firstName}.<br /><span>Vamos operar.</span></h1>
                    <p className="dashboard-command-lede">Um lugar para enxergar o que está funcionando, resolver o que importa e manter sua comunidade em movimento.</p>
                </div>
                <div className="dashboard-command-aside" aria-label="Estado da operação">
                    <div className="dashboard-command-state">
                        <span className="dashboard-eyebrow">Estado da operação</span>
                        <strong>{operationState}</strong>
                        <small>{operationDetail}</small>
                    </div>
                    <div className="dashboard-command-signal" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /></div>
                    <span className="dashboard-command-time">LIVE / SEU AMBIENTE</span>
                </div>
                <div className="dashboard-command-actions">
                    <Button href="/planos" className="dashboard-action-primary">Adicionar aplicação <span aria-hidden="true">↗</span></Button>
                    <Button href="/dashboard/invoices" variant="secondary" className="dashboard-action-secondary">Acompanhar faturas <span aria-hidden="true">↗</span></Button>
                </div>
                <div className="dashboard-command-footnote"><span><i />Acesso proprietário</span><span><i />Dados organizados por contexto</span><span><i />Sem configuração manual</span></div>
            </section>

            <section aria-label="Resumo da operação" className="dashboard-overview-strip">
                {summary.map((item) => (
                    <article key={item.label} className={`dashboard-overview-card dashboard-overview-card-${item.tone}`}>
                        <span className="dashboard-overview-icon"><Icon name={item.icon} /></span>
                        <div className="dashboard-overview-copy"><span>{item.label}</span><strong>{item.value}</strong><small>{item.hint}</small></div>
                    </article>
                ))}
            </section>

            <section className="dashboard-reading-grid" aria-label="Leitura da operação">
                <article className="dashboard-reading-card dashboard-reading-card-health">
                    <div className="dashboard-reading-heading"><div><p className="dashboard-eyebrow">LEITURA RÁPIDA</p><h2>Como está o seu ambiente.</h2></div><span className="dashboard-reading-index">01</span></div>
                    <div className="dashboard-health-line"><span>Operação saudável</span><strong>{healthPercent}%</strong></div>
                    <div className="dashboard-health-track"><span style={{ width: `${healthPercent}%` }} /></div>
                    <p>{apps.length ? (attentionApps.length ? "Há itens que merecem uma revisão antes de virarem interrupção." : "Nenhum alerta aberto. Você pode seguir para o próximo passo.") : "Assim que você conectar uma aplicação, este espaço passa a mostrar a saúde da sua operação."}</p>
                </article>
                <article className={`dashboard-reading-card dashboard-reading-card-attention ${attentionApps.length ? "has-attention" : "is-clear"}`}>
                    <div className="dashboard-reading-heading"><div><p className="dashboard-eyebrow">PRÓXIMO PASSO</p><h2>{attentionApps.length ? "O que merece sua atenção." : "Nada pedindo atenção."}</h2></div><span className="dashboard-reading-icon"><Icon name={attentionApps.length ? "alert" : "check"} /></span></div>
                    {attentionApps.length ? <div className="dashboard-attention-list">{attentionApps.slice(0, 2).map((app) => <div key={app.id} className="dashboard-attention-item"><span className="dashboard-status-marker" /><div><strong>{app.name}</strong><small>{app.errorOnUpdate ? "Atualização com problema" : app.status !== "active" ? "Aplicação em carência" : "Renovação se aproximando"}</small></div><span className="dashboard-attention-arrow">↗</span></div>)}{attentionApps.length > 2 && <span className="dashboard-attention-more">+ {attentionApps.length - 2} outros itens na sua lista</span>}</div> : <p className="dashboard-clear-copy">Sua operação está limpa. Use este momento para configurar, vender ou acompanhar novidades.</p>}
                </article>
                <article className="dashboard-reading-card dashboard-reading-card-shortcuts">
                    <div className="dashboard-reading-heading"><div><p className="dashboard-eyebrow">ATALHOS</p><h2>Continue de onde parou.</h2></div><span className="dashboard-reading-index">03</span></div>
                    <div className="dashboard-shortcut-list">
                        <Button href="/dashboard/account" variant="ghost" className="dashboard-shortcut"><span className="dashboard-shortcut-icon"><Icon name="user" /></span><span><strong>Minha conta</strong><small>Perfil e preferências</small></span><span aria-hidden="true">↗</span></Button>
                        <Button href="/dashboard/invoices" variant="ghost" className="dashboard-shortcut"><span className="dashboard-shortcut-icon"><Icon name="invoice" /></span><span><strong>Faturas</strong><small>Pagamentos e histórico</small></span><span aria-hidden="true">↗</span></Button>
                        {authCount > 0 ? <Button href={`/dashboard/auth/${authApps[0].id}`} variant="ghost" className="dashboard-shortcut"><span className="dashboard-shortcut-icon"><Icon name="shield" /></span><span><strong>ZUROS Auth</strong><small>{authCount} {authCount === 1 ? "licença ativa" : "licenças ativas"}</small></span><span aria-hidden="true">↗</span></Button> : null}
                    </div>
                </article>
            </section>

            <section className="dashboard-apps-section" aria-labelledby="dashboard-apps-heading">
                <div className="dashboard-apps-heading">
                    <div><p className="home-section-index">01 / APLICAÇÕES</p><h2 id="dashboard-apps-heading">Seu espaço de operação.</h2><p>Abra uma aplicação para entrar no contexto certo — sem procurar por identificadores ou códigos.</p></div>
                    <div className="dashboard-apps-count"><strong>{String(apps.length).padStart(2, "0")}</strong><span>{apps.length === 1 ? "aplicação conectada" : "aplicações conectadas"}</span></div>
                </div>
                <div className="dashboard-apps-list">{sorted.length === 0 ? <div className="dashboard-empty dashboard-empty-v2"><div className="dashboard-empty-mark">+</div><p className="dashboard-eyebrow">PRIMEIRO MOVIMENTO</p><h2>Comece pelo que você quer colocar no ar.</h2><p>Escolha uma aplicação no catálogo e conecte sua primeira operação ao painel.</p><Button href="/planos" className="mt-5">Conhecer aplicações <span aria-hidden="true">↗</span></Button></div> : <DashboardAppsGrid apps={sorted} />}</div>
            </section>
        </main>
    );
}
