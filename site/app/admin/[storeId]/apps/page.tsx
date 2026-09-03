import { Badge, Empty } from "@/components/ui";
import { listStoreApps } from "@/lib/actions/admin.actions";
import { formatDate, getRemainingLabel, getRemainingTone } from "@/lib/status";
import { DeleteApplicationButton } from "@/components/DeleteApplicationButton";
import { AdminApplicationActions } from "@/components/AdminApplicationActions";

export const dynamic = "force-dynamic";

export default async function StoreAppsPage({ params }: { params: Promise<{ storeId: string }> }) { const resolvedParams = await params;
    const apps = await listStoreApps(resolvedParams.storeId);

    return (
        <div className="flex flex-col gap-4">
            <div>
                <div className="flex items-center gap-2.5">
                    <span className="h-6 w-1 rounded-full bg-[var(--accent)]" />
                    <h1 className="text-2xl font-bold tracking-tight text-white">Aplicações</h1>
                </div>
                <p className="mt-1.5 text-sm text-zinc-500">{apps.length} aplicação(ões) nesta loja.</p>
            </div>

            {apps.length === 0 ? (
                <Empty text="Nenhuma aplicação nesta loja." />
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-zinc-800/80">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-800 bg-zinc-950/80 text-left text-xs uppercase tracking-wide text-zinc-500">
                                <th className="py-3 pl-4 pr-4">Nome</th>
                                <th className="py-3 pr-4">Produto</th>
                                <th className="py-3 pr-4">Status</th>
                                <th className="py-3 pr-4">Versão</th>
                                <th className="py-3 pr-4">Validade</th>
                                <th className="py-3 pr-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {apps.map((app) => (
                                <tr key={app.id} className="border-b border-zinc-900 text-zinc-300 transition last:border-0 hover:bg-zinc-900/40">
                                    <td className="py-3 pl-4 pr-4 font-medium text-white">{app.name}</td>
                                    <td className="py-3 pr-4">{app.productName}</td>
                                    <td className="py-3 pr-4">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {app.status === "active" ? (
                                                <Badge tone="green">Ativo</Badge>
                                            ) : (
                                                <Badge tone="amber">Carência</Badge>
                                            )}
                                            {app.errorOnUpdate && <Badge tone="red">Erro</Badge>}
                                        </div>
                                    </td>
                                    <td className="py-3 pr-4">v{app.version}</td>
                                    <td className="py-3 pr-4">
                                        {app.lifetime ? (
                                            <span className="font-medium text-emerald-400">Vitalício</span>
                                        ) : (
                                            <span
                                                className={
                                                    getRemainingTone(app.expiresAt, false) === "red"
                                                        ? "font-medium text-red-400"
                                                        : getRemainingTone(app.expiresAt, false) === "amber"
                                                          ? "font-medium text-amber-400"
                                                          : ""
                                                }
                                            >
                                                {getRemainingLabel(app.expiresAt, false)}
                                            </span>
                                        )}
                                        <span className="block text-xs text-zinc-600">{formatDate(app.expiresAt)}</span>
                                    </td>
                                    <td className="py-3 pr-4 text-right"><div className="flex flex-col items-end gap-2"><AdminApplicationActions appId={app.id} name={app.name} ownerId={app.ownerId || ""} botId={app.botId || ""} /><DeleteApplicationButton appId={app.id} appName={app.name} /></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
