import { Badge, Button, Card, Empty, PageHeader } from "@/components/ui";
import { ReleaseUploader } from "@/components/ReleaseUploader";
import { getProductReleases } from "@/lib/actions/admin.actions";
import { SetCurrentReleaseButton } from "@/components/SetCurrentReleaseButton";
import { ReleaseActions } from "@/components/ReleaseActions";
import { ReleaseDeploymentActions } from "@/components/ReleaseDeploymentActions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const statusLabel = {
    uploading: "Processando",
    published: "Publicada",
    failed: "Falhou",
} as const;

function releaseNotePreview(notes: string) {
    const isHtml = /<(!doctype\s+html|html\b|table\b|body\b|div\b)/i.test(notes);
    const plain = notes.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return { isHtml, plain: (plain || notes).slice(0, 180) };
}

export default async function ProductReleasesPage({ params }: { params: Promise<{ storeId: string; productId: string }> }) {
    const { storeId, productId } = await params;
    const product = await getProductReleases(storeId, productId);
    const isUpdating = product.pendingApplications > 0;

    return <div className="space-y-6">
        <PageHeader
            title={"Releases · " + product.productName}
            subtitle="Publique versões e acompanhe a distribuição para todos os bots."
            actions={<div className="flex flex-wrap gap-2">
                <Button href={"/admin/" + storeId + "/releases"} variant="secondary">Voltar</Button>
                <ReleaseDeploymentActions productId={product.productId} applicationsCount={product.applicationsCount} disabled={!product.currentVersion} />
            </div>}
        />

        <section aria-label="Resumo das atualizações" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Release atual</p><p className="mt-2 font-mono text-2xl font-semibold text-emerald-400">{product.currentVersion ? "v" + product.currentVersion : "Não definida"}</p></Card>
            <Card className="p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Bots vinculados</p><p className="mt-2 text-2xl font-semibold text-white">{product.applicationsCount}</p></Card>
            <Card className="p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Na fila</p><p className="mt-2 text-2xl font-semibold text-amber-400">{product.pendingApplications}</p></Card>
            <Card className="p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Com erro</p><p className={"mt-2 text-2xl font-semibold " + (product.errorApplications ? "text-red-400" : "text-zinc-300")}>{product.errorApplications}</p></Card>
        </section>

        {isUpdating ? <div className="rounded-xl border border-amber-500/20 bg-amber-500/[.06] px-4 py-3 text-sm text-amber-200">A atualização está em andamento. Os bots são processados com segurança pela fila.</div> : null}
        {product.errorApplications > 0 ? <div className="rounded-xl border border-red-500/20 bg-red-500/[.06] px-4 py-3 text-sm text-red-200">Existem bots com erro. Use “Atualizar todos os bots” para reenviar a release atual preservando os arquivos protegidos.</div> : null}

        <Card>
            <div className="mb-4"><h2 className="flex items-center gap-2 font-semibold text-white"><span className="h-4 w-1 rounded-full bg-[var(--accent)]" />Enviar nova release</h2><p className="mt-1 text-sm text-zinc-500">ZIP de até 50 MB. O arquivo é validado e recebe uma versão automaticamente.</p></div>
            <ReleaseUploader storeId={storeId} productId={product.productId} disabled={product.used >= product.limit} />
            {product.used >= product.limit ? <p className="mt-2 text-sm text-amber-400">Remova uma versão antiga antes de enviar outra release.</p> : null}
        </Card>

        <section>
            <div className="mb-4"><h2 className="text-lg font-semibold text-white">Histórico de versões</h2><p className="mt-1 text-sm text-zinc-500">{product.used} de {product.limit} releases armazenadas</p></div>
            {product.releases.length === 0 ? <Empty text="Nenhuma release enviada." /> : <div className="space-y-3">
                {[...product.releases].reverse().map((release) => {
                    const note = release.notes ? releaseNotePreview(release.notes) : null;
                    return <Card key={release.version} className={"overflow-hidden p-0 " + (release.isCurrent ? "border-emerald-500/25" : release.status === "failed" ? "border-red-500/25" : "")}>
                        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between lg:p-5">
                            <div className="flex min-w-0 items-start gap-3">
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-zinc-800 bg-black/40 font-mono text-xs text-emerald-400">ZIP</span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2"><p className="font-mono text-sm font-semibold text-white">v{release.version}</p>{release.isCurrent ? <Badge tone="green">Em produção</Badge> : null}<Badge tone={release.status === "failed" ? "red" : release.status === "uploading" ? "amber" : "zinc"}>{statusLabel[release.status]}</Badge>{note?.isHtml ? <Badge tone="zinc">Template HTML</Badge> : null}</div>
                                    <p className="mt-1 text-xs text-zinc-500">Criada em {new Date(release.date).toLocaleString("pt-BR")}</p>
                                    {note ? <details className="mt-3 max-w-3xl rounded-xl border border-zinc-800/80 bg-black/20">
                                        <summary className="cursor-pointer list-none px-3 py-2 text-xs text-zinc-400 marker:hidden"><span className="mr-2 text-emerald-400">▸</span>{note.isHtml ? "Ver template HTML do e-mail" : "Ver notas da atualização"}<span className="ml-2 text-zinc-600">{note.plain}{note.plain.length >= 180 ? "…" : ""}</span></summary>
                                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-zinc-800/80 px-3 py-3 font-mono text-[11px] leading-relaxed text-zinc-500">{release.notes}</pre>
                                    </details> : null}
                                    {release.sha256 ? <p className="mt-2 truncate font-mono text-[10px] text-zinc-600" title={release.sha256}>SHA-256: {release.sha256}</p> : null}
                                    {release.errorMessage ? <p className="mt-2 text-xs text-red-300">{release.errorMessage}</p> : null}
                                </div>
                            </div>
                            <div className="flex w-full flex-wrap items-center gap-2 border-t border-zinc-800/70 pt-3 lg:w-auto lg:max-w-[520px] lg:justify-end lg:border-t-0 lg:pt-0">{release.status === "published" && !release.isCurrent ? <SetCurrentReleaseButton productId={product.productId} version={release.version} /> : null}<ReleaseActions storeId={storeId} productId={product.productId} version={release.version} status={release.status} /></div>
                        </div>
                    </Card>;
                })}
            </div>}
        </section>
    </div>;
}
