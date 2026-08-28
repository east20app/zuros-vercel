import type { Metadata } from "next";
import { DashboardAppsGrid } from "@/components/DashboardAppsGrid";
import { Icon, type IconName } from "@/components/Icon";
import { Button, Card, PageHeader } from "@/components/ui";
import { listMyApps } from "@/lib/actions/apps.actions";
import { requireUser } from "@/lib/require-admin";
import { getRemainingLabel, isExpiring } from "@/lib/status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Meus Bots · ZUROS APP",
    description: "Gerencie seus bots e renove sua assinatura.",
};

export default async function DashboardPage() {
    const [user, apps] = await Promise.all([requireUser(), listMyApps()]);
    const activeCount = apps.filter((app) => app.status === "active" && !app.errorOnUpdate).length;
    const attentionCount = apps.filter((app) => app.status !== "active" || app.errorOnUpdate || isExpiring(app.expiresAt, app.lifetime)).length;
    const nextExpiration = apps
        .filter((app) => !app.lifetime && app.expiresAt)
        .sort((a, b) => new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime())[0];
    const summary: Array<{ label: string; value: string | number; hint: string; icon: IconName; tone: string }> = [
        { label: "Total de bots", value: apps.length, hint: "Aplicações vinculadas", icon: "apps", tone: "bg-violet-500/15 text-violet-300" },
        { label: "Online agora", value: activeCount, hint: "Funcionando normalmente", icon: "check", tone: "bg-emerald-500/10 text-emerald-300" },
        { label: "Próx. vencimento", value: nextExpiration ? getRemainingLabel(nextExpiration.expiresAt, false) : "—", hint: attentionCount ? "Confira os avisos" : "Tudo em ordem", icon: "alert", tone: "bg-cyan-500/10 text-cyan-300" },
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
        <main className="mx-auto min-w-0 max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
            <section className="relative overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.035] px-6 py-7 shadow-2xl shadow-black/20 backdrop-blur-xl sm:px-8">
                <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#7c3aed]/20 blur-3xl" />
                <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#949cf7]">Central de aplicações</p>
                        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Olá, {user.name || "usuário"}</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Acompanhe seus bots, abra configurações e resolva avisos importantes em um só lugar.</p>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                        <Button href="/dashboard/invoices" variant="secondary" className="w-full sm:w-auto">Ver faturas</Button>
                        <Button href="/planos" className="w-full sm:w-auto">Comprar app</Button>
                    </div>
                </div>
            </section>

            <section aria-label="Resumo das aplicações" className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                {summary.map((item) => (
                    <Card key={item.label} className="flex min-w-0 flex-col items-center gap-2 !p-3 text-center sm:flex-row sm:gap-4 sm:!p-5 sm:text-left">
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11 ${item.tone}`}><Icon name={item.icon} /></span>
                        <span className="min-w-0">
                            <span className="block truncate text-lg font-semibold tracking-tight text-white sm:text-2xl">{item.value}</span>
                            <b className="block truncate text-xs font-medium text-zinc-300">{item.label}</b>
                            <small className="hidden truncate text-[11px] text-zinc-600 sm:block">{item.hint}</small>
                        </span>
                    </Card>
                ))}
            </section>

            <div className="mt-8">
                <PageHeader title="Minhas aplicações" subtitle={apps.length ? "Selecione um bot para abrir o painel de gerenciamento." : "Adicione seu primeiro bot para começar."} />
            </div>

            <div className="mt-5">
                {sorted.length === 0 ? (
                    <div className="zuros-card border-dashed px-6 py-12 text-center">
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-2xl text-emerald-400">+</div>
                        <h2 className="mt-4 text-lg font-semibold text-white">Você ainda não possui aplicações</h2>
                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">Escolha um app no catálogo, selecione o plano e faça a configuração do seu bot.</p>
                        <Button href="/planos" className="mt-5">Comprar meu primeiro app</Button>
                    </div>
                ) : (
                    <DashboardAppsGrid apps={sorted} />
                )}
            </div>
        </main>
    );
}
