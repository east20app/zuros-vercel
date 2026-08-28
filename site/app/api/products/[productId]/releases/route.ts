import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { assertProductReleaseUploadAccess, getReleaseArchive, MAX_RELEASE_FILE_SIZE, publishProductRelease, RELEASE_FILE_TOO_LARGE_MESSAGE, removeProductRelease } from "@root/src/integration/releases";
import { releaseUploadSchema } from "@root/src/integration/dtos";
import { assembleReleaseUpload, cleanupExpiredReleaseUploads, discardReleaseUpload, saveReleaseUploadChunk } from "@root/src/functions/release-storage";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
    const session = await getServerSession(authOptions);
    const requesterId = session?.user?.discordId;
    if (!requesterId) return Response.json({ error: "Não autenticado." }, { status: 401 });
    const url = new URL(request.url);
    if (url.searchParams.get("chunk") === "1") {
        try {
            const storeId = url.searchParams.get("storeId") || "";
            const uploadId = url.searchParams.get("uploadId") || "";
            const index = Number(url.searchParams.get("index"));
            const total = Number(url.searchParams.get("total"));
            const ids = releaseUploadSchema.parse({ storeId, productId: (await params).productId });
            await assertProductReleaseUploadAccess({ requesterId, storeId: ids.storeId, productId: ids.productId });
            if (!/^[a-zA-Z0-9-]{16,80}$/.test(uploadId) || !Number.isInteger(index) || !Number.isInteger(total) || index < 0 || total < 1 || total > 20 || index >= total) throw new Error("Upload inválido.");
            const chunk = Buffer.from(await request.arrayBuffer());
            if (!chunk.length || chunk.length > 3 * 1024 * 1024) throw new Error("Parte do arquivo inválida.");
            if (index === 0) await cleanupExpiredReleaseUploads().catch(() => 0);
            await saveReleaseUploadChunk(uploadId, index, chunk);
            if (index < total - 1) return Response.json({ received: index + 1 });
            const fileBuffer = await assembleReleaseUpload(uploadId, total);
            if (fileBuffer.length > MAX_RELEASE_FILE_SIZE) throw new Error(RELEASE_FILE_TOO_LARGE_MESSAGE);
            const result = await publishProductRelease({ requesterId, storeId: ids.storeId, productId: ids.productId, fileBuffer, fileSize: fileBuffer.length });
            revalidatePath(`/admin/${ids.storeId}/products`);
            revalidatePath(`/admin/${ids.storeId}/products/${ids.productId}/releases`);
            return Response.json({ version: result.version });
        } catch (error) {
            const failedUploadId = url.searchParams.get("uploadId") || "";
            if (/^[a-zA-Z0-9-]{16,80}$/.test(failedUploadId)) await discardReleaseUpload(failedUploadId).catch(() => undefined);
            return Response.json({ error: error instanceof Error ? error.message : "Não foi possível enviar a release." }, { status: 400 });
        }
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_RELEASE_FILE_SIZE) return Response.json({ error: RELEASE_FILE_TOO_LARGE_MESSAGE }, { status: 400 });
    try {
        const form = await request.formData();
        const file = form.get("file");
        const storeId = form.get("storeId");
        const ids = releaseUploadSchema.parse({ storeId, productId: (await params).productId });
        if (!(file instanceof File)) throw new Error("Arquivo não informado!");
        if (typeof storeId !== "string" || !storeId) throw new Error("Loja não informada!");
        if (file.size > MAX_RELEASE_FILE_SIZE) throw new Error(RELEASE_FILE_TOO_LARGE_MESSAGE);
        if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("Envie um arquivo .zip válido.");
        const result = await publishProductRelease({ requesterId, storeId: ids.storeId, productId: ids.productId, fileBuffer: Buffer.from(await file.arrayBuffer()), fileSize: file.size });
        revalidatePath(`/admin/${ids.storeId}/products`);
        revalidatePath(`/admin/${ids.storeId}/products/${ids.productId}/releases`);
        return Response.json({ version: result.version });
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Não foi possível enviar a release." }, { status: 400 });
    }
}

export async function GET(request: Request, { params }: { params: Promise<{ productId: string }> }) {
    const session = await getServerSession(authOptions); const requesterId = session?.user?.discordId;
    if (!requesterId) return Response.json({ error: "Não autenticado." }, { status: 401 });
    const url = new URL(request.url); const storeId = url.searchParams.get("storeId") || ""; const version = url.searchParams.get("version") || "";
    try { const release = await getReleaseArchive({ requesterId, storeId, productId: (await params).productId, version });
        if (url.searchParams.get("mode") === "files") return Response.json({ files: release.files });
        return new Response(new Uint8Array(release.buffer), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="release-${version}.zip"` } });
    } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Release indisponível." }, { status: 400 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ productId: string }> }) {
    const session = await getServerSession(authOptions); const requesterId = session?.user?.discordId;
    if (!requesterId) return Response.json({ error: "Não autenticado." }, { status: 401 });
    const body = await request.json().catch(() => ({})) as { storeId?: string; version?: string };
    try { await removeProductRelease({ requesterId, storeId: body.storeId || "", productId: (await params).productId, version: body.version || "" }); return Response.json({ ok: true }); }
    catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Não foi possível excluir." }, { status: 400 }); }
}
