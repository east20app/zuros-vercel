import fs from "fs/promises";
import crypto from "crypto";
import path from "path";
import AdmZip from "adm-zip";
import semver from "semver";
import databases from "../databases";
import { getUserHasPermissionOnStore, PermissionsStore } from "../functions/acl";
import { releaseUploadSchema } from "./dtos";
import { recordActivity } from "./activity-log";
import { safeReleaseEntryPath } from "./release-archive";
import { deleteReleaseBuffer, readReleaseBuffer, saveReleaseBuffer } from "../functions/release-storage";

export const MAX_RELEASE_FILE_SIZE = 50 * 1024 * 1024;
export const MAX_RELEASE_UNCOMPRESSED_SIZE = 200 * 1024 * 1024;
export const MAX_PRODUCT_RELEASES = 10;
export const MAX_RELEASE_FILES = 5000;
export const MAX_RELEASE_COMPRESSION_RATIO = 100;
export const RELEASE_EXCLUDED_PATHS = ["node_modules", ".git", "venv", ".vscode", "__pycache__/", ".next/"];
export const RELEASE_FILE_TOO_LARGE_MESSAGE = "O arquivo é muito grande! O tamanho máximo permitido é 50MB.";

export interface ProductReleaseDTO {
    version: string;
    date: string;
    isCurrent: boolean;
    status: "uploading" | "published" | "failed";
    sha256: string | null;
    errorMessage: string | null;
}

export interface ProductReleasesDTO {
    productId: string;
    productName: string;
    currentVersion: string | null;
    releases: ProductReleaseDTO[];
    used: number;
    limit: number;
    applicationsCount: number;
    pendingApplications: number;
    errorApplications: number;
}

export function stripRootFolderFromZip({ originalZip, exclude_path_list }: {
    originalZip: AdmZip;
    exclude_path_list?: string[];
}): Buffer {
    const entries = originalZip.getEntries();
    if (entries.length === 0) return originalZip.toBuffer();

    if (entries.length > MAX_RELEASE_FILES) throw new Error(`O ZIP excede o limite de ${MAX_RELEASE_FILES} arquivos.`);
    const safeNames = entries.map((entry) => safeReleaseEntryPath(entry.entryName));
    const uncompressedSize = entries.reduce((total, entry) => total + Number(entry.header.size || 0), 0);
    const compressedSize = entries.reduce((total, entry) => total + Number(entry.header.compressedSize || 0), 0);
    if (uncompressedSize / Math.max(1, compressedSize) > MAX_RELEASE_COMPRESSION_RATIO) throw new Error("O ZIP possui taxa de compressão extrema e foi rejeitado.");
    if (uncompressedSize > MAX_RELEASE_UNCOMPRESSED_SIZE) {
        throw new Error("O conteúdo descompactado do ZIP excede o limite de 200 MB.");
    }
    const firstPathPart = safeNames[0].split("/")[0];
    const allInsideSameDir = safeNames.every((entryName) => entryName.startsWith(`${firstPathPart}/`));
    const parentDir = allInsideSameDir ? `${firstPathPart}/` : "";
    const newZip = new AdmZip();

    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        const entryName = safeNames[index];
        const relativePath = parentDir ? entryName.substring(parentDir.length) : entryName;
        if (!relativePath || !relativePath.trim()) continue;
        const shouldExclude = exclude_path_list?.some((excluded) => {
            const normalized = excluded.replace(/\/+$/, "");
            return relativePath === normalized || relativePath.startsWith(`${normalized}/`);
        });
        if (shouldExclude) continue;
        if (entry.isDirectory) {
            newZip.addFile(relativePath.endsWith("/") ? relativePath : `${relativePath}/`, Buffer.alloc(0));
        } else {
            newZip.addFile(relativePath, entry.getData());
        }
    }
    return newZip.toBuffer();
}

async function assertReleaseAdmin(requesterId: string, storeId: string) {
    const allowed = await getUserHasPermissionOnStore({
        userId: requesterId,
        storeId,
        permission: PermissionsStore.ADMIN,
    });
    if (!allowed) throw new Error("Você não tem permissão para usar este comando.");
}

export async function assertProductReleaseUploadAccess(args: {
    requesterId: string;
    storeId: string;
    productId: string;
}): Promise<void> {
    releaseUploadSchema.parse({ storeId: args.storeId, productId: args.productId });
    await assertReleaseAdmin(args.requesterId, args.storeId);
    const [userInfo, product] = await Promise.all([
        databases.userSettings.exists({ userId_discord: args.requesterId }),
        databases.products.exists({ _id: args.productId, storeId: args.storeId }),
    ]);
    if (!userInfo) throw new Error("Usuario nao cadastrado.");
    if (!product) throw new Error("Produto nao encontrado.");
}
export async function publishProductRelease(args: {
    requesterId: string;
    storeId: string;
    productId: string;
    fileBuffer: Buffer;
    fileSize: number;
}): Promise<{ version: string; productName: string }> {
    releaseUploadSchema.parse({ storeId: args.storeId, productId: args.productId });
    await assertReleaseAdmin(args.requesterId, args.storeId);
    if (!args.fileSize) throw new Error("Não foi possível determinar o tamanho do arquivo!");
    if (args.fileSize > MAX_RELEASE_FILE_SIZE) throw new Error(RELEASE_FILE_TOO_LARGE_MESSAGE);

    const userInfo = await databases.userSettings.findOne({ userId_discord: args.requesterId });
    if (!userInfo) throw new Error("Usuario nao cadastrado.");
    const product = await databases.products.findOne({ _id: args.productId, storeId: args.storeId });
    if (!product) throw new Error("Produto nao encontrado.");
    // Releases com status "failed" não consumem a vaga permanentemente: são
    // removidas no próximo envio para liberar espaço sem exigir exclusão manual.
    const failedCount = (product.releases || []).filter((release) => release.status === "failed").length;
    if (failedCount) {
        await databases.products.updateOne({ _id: product._id }, { $pull: { releases: { status: "failed" } } });
    }
    if ((product.releases || []).length >= MAX_PRODUCT_RELEASES) {
        throw new Error(`O máximo de releases permitidas é ${MAX_PRODUCT_RELEASES}. Remova uma release antes de enviar outra.`);
    }

    const nextRelease = semver.inc(product.lastReleaseCreatedVersion, "patch");
    if (!nextRelease) throw new Error("Não foi possível calcular a próxima versão da release.");
    const releaseDir = path.join("releases", product._id.toString());
    const savedFilePath = path.join(releaseDir, `${nextRelease}.zip`);
    let saved = false;
    const reservation = await databases.products.updateOne(
        { _id: product._id, lastReleaseCreatedVersion: product.lastReleaseCreatedVersion, $expr: { $lt: [{ $size: { $ifNull: ["$releases", []] } }, MAX_PRODUCT_RELEASES] } },
        { $set: { lastReleaseCreatedVersion: nextRelease }, $push: { releases: { version: nextRelease, date: new Date(), path: "", status: "uploading" } } },
    );
    if (!reservation.modifiedCount) throw new Error("Outra publicação reservou esta versão. Atualize a página e tente novamente.");

    try {
        let archive: AdmZip;
        try {
            archive = new AdmZip(args.fileBuffer);
            archive.getEntries();
        } catch {
            throw new Error("O arquivo ZIP está corrompido ou usa um formato não suportado.");
        }
        const strippedBuffer = stripRootFolderFromZip({
            originalZip: archive,
            exclude_path_list: RELEASE_EXCLUDED_PATHS,
        });
const persistentPath = await saveReleaseBuffer(product._id.toString(), nextRelease, strippedBuffer);
        saved = true;
        const sha256 = crypto.createHash("sha256").update(strippedBuffer).digest("hex");
        const releaseEntries = new AdmZip(strippedBuffer).getEntries();
        const uncompressedSize = releaseEntries.reduce((total, entry) => total + Number(entry.header.size || 0), 0);
        const result = await databases.products.updateOne(
            { _id: product._id },
            { $set: { "releases.$[release].path": persistentPath, "releases.$[release].status": "published", "releases.$[release].sha256": sha256, "releases.$[release].fileCount": releaseEntries.length, "releases.$[release].uncompressedSize": uncompressedSize }, $unset: { "releases.$[release].errorMessage": 1 } },
            { arrayFilters: [{ "release.version": nextRelease }] },
        );
        if (!result.modifiedCount) throw new Error("Não foi possível concluir a publicação da release reservada.");        recordActivity({ level: "success", source: "web", storeId: args.storeId, message: `Release ${nextRelease} publicada para ${product.name}` });
        return { version: nextRelease, productName: product.name };
    } catch (error) {
        await databases.products.updateOne({ _id: product._id }, { $set: { "releases.$[release].status": "failed", "releases.$[release].errorMessage": String(error instanceof Error ? error.message : "Falha na publicação").slice(0, 500) } }, { arrayFilters: [{ "release.version": nextRelease }] }).catch(() => undefined);
        if (saved) {
            await deleteReleaseBuffer(product._id.toString(), nextRelease, savedFilePath).catch(() => console.warn("Não foi possível remover o arquivo de release após erro."));
        }
        throw error;
    }
}

export async function getReleaseArchive(args: { requesterId: string; storeId: string; productId: string; version: string }): Promise<{ buffer: Buffer; files: string[] }> {
    await assertReleaseAdmin(args.requesterId, args.storeId);
    const product = await databases.products.findOne({ _id: args.productId, storeId: args.storeId }).lean();
    const release = product?.releases?.find((item) => item.version === args.version);
    if (!product || !release) throw new Error("Release não encontrada.");
    const buffer = await readReleaseBuffer(args.productId, args.version, release.path);
    const archive = new AdmZip(buffer);
    return { buffer, files: archive.getEntries().map((entry) => entry.entryName).filter(Boolean) };
}

export async function removeProductRelease(args: { requesterId: string; storeId: string; productId: string; version: string }): Promise<void> {
    await assertReleaseAdmin(args.requesterId, args.storeId);
    const product = await databases.products.findOne({ _id: args.productId, storeId: args.storeId });
    const release = product?.releases?.find((item) => item.version === args.version);
    if (!product || !release) throw new Error("Release não encontrada.");
    if (product.currentReleaseVersion === args.version) throw new Error("Defina outra release como atual antes de excluir esta versão.");
    await deleteReleaseBuffer(args.productId, args.version, release.path);
    product.releases = product.releases?.filter((item) => item.version !== args.version) as typeof product.releases;
    await product.save();
}

export async function getProductReleases(args: {
    requesterId: string;
    storeId: string;
    productId: string;
}): Promise<ProductReleasesDTO> {
    await assertReleaseAdmin(args.requesterId, args.storeId);
    const product = await databases.products.findOne({ _id: args.productId, storeId: args.storeId }).lean();
    if (!product) throw new Error("Produto nao encontrado.");
    const [applicationsCount, pendingApplications, errorApplications] = await Promise.all([
        databases.applications.countDocuments({ productId: product._id }),
        databases.applications.countDocuments({ productId: product._id, errorOnUpdate: false, $or: [{ version: { $ne: product.currentReleaseVersion } }, { forceUpdate: true }] }),
        databases.applications.countDocuments({ productId: product._id, errorOnUpdate: true }),
    ]);
    const releases = (product.releases || []).map((release) => ({
        version: release.version,
        date: release.date.toISOString(),
        isCurrent: release.version === product.currentReleaseVersion,
        status: release.status || "published",
        sha256: release.sha256 || null,
        errorMessage: release.errorMessage || null,
    }));
    return {
        productId: product._id.toString(), productName: product.name,
        currentVersion: product.currentReleaseVersion || null,
        releases, used: releases.length, limit: MAX_PRODUCT_RELEASES,
        applicationsCount, pendingApplications, errorApplications,
    };
}
