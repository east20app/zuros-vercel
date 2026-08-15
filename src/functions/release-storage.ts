import fs from "fs/promises";
import { GridFSBucket } from "mongodb";
import { connection } from "mongoose";
import connectDatabase from "../databases/connection";

const bucketName = "productReleases";
const filename = (productId: string, version: string) => `${productId}/${version}.zip`;
const uploadFilename = (uploadId: string, index: number) => `uploads/${uploadId}/${index}.part`;

async function bucket() {
    await connectDatabase();
    if (!connection.db) throw new Error("Banco de dados indisponível para armazenar a release.");
    return new GridFSBucket(connection.db, { bucketName });
}

export async function saveReleaseBuffer(productId: string, version: string, data: Buffer): Promise<string> {
    const storage = await bucket(); const name = filename(productId, version);
    const existing = await storage.find({ filename: name }).toArray();
    await Promise.all(existing.map((file) => storage.delete(file._id)));
    await new Promise<void>((resolve, reject) => { const stream = storage.openUploadStream(name, { metadata: { productId, version } }); stream.once("error", reject); stream.once("finish", () => resolve()); stream.end(data); });
    return `gridfs:${name}`;
}

export async function readReleaseBuffer(productId: string, version: string, legacyPath?: string): Promise<Buffer> {
    const storage = await bucket(); const name = filename(productId, version);
    const file = await storage.find({ filename: name }).sort({ uploadDate: -1 }).limit(1).next();
    if (file) return new Promise<Buffer>((resolve, reject) => { const chunks: Buffer[] = []; const stream = storage.openDownloadStream(file._id); stream.on("data", (chunk) => chunks.push(Buffer.from(chunk))); stream.once("error", reject); stream.once("end", () => resolve(Buffer.concat(chunks))); });
    if (legacyPath) return fs.readFile(legacyPath);
    throw new Error("Arquivo da release não encontrado.");
}

export async function deleteReleaseBuffer(productId: string, version: string, legacyPath?: string): Promise<void> {
    const storage = await bucket(); const files = await storage.find({ filename: filename(productId, version) }).toArray();
    await Promise.all(files.map((file) => storage.delete(file._id)));
    if (legacyPath && !legacyPath.startsWith("gridfs:")) await fs.unlink(legacyPath).catch(() => undefined);
}

export async function releaseBufferExists(productId: string, version: string, legacyPath?: string): Promise<boolean> {
    try { await readReleaseBuffer(productId, version, legacyPath); return true; } catch { return false; }
}

export async function saveReleaseUploadChunk(uploadId: string, index: number, data: Buffer): Promise<void> {
    const storage = await bucket(); const name = uploadFilename(uploadId, index);
    const existing = await storage.find({ filename: name }).toArray();
    await Promise.all(existing.map((file) => storage.delete(file._id)));
    await new Promise<void>((resolve, reject) => { const stream = storage.openUploadStream(name, { metadata: { uploadId, index, temporary: true } }); stream.once("error", reject); stream.once("finish", resolve); stream.end(data); });
}

export async function assembleReleaseUpload(uploadId: string, totalChunks: number): Promise<Buffer> {
    const storage = await bucket(); const buffers: Buffer[] = []; const ids = [];
    try {
        for (let index = 0; index < totalChunks; index++) {
            const file = await storage.find({ filename: uploadFilename(uploadId, index) }).sort({ uploadDate: -1 }).limit(1).next();
            if (!file) throw new Error(`Parte ${index + 1} do upload não foi encontrada.`);
            ids.push(file._id);
            const buffer = await new Promise<Buffer>((resolve, reject) => { const chunks: Buffer[] = []; const stream = storage.openDownloadStream(file._id); stream.on("data", (chunk) => chunks.push(Buffer.from(chunk))); stream.once("error", reject); stream.once("end", () => resolve(Buffer.concat(chunks))); });
            buffers.push(buffer);
        }
        return Buffer.concat(buffers);
    } finally {
        await Promise.all(ids.map((id) => storage.delete(id).catch(() => undefined)));
    }
}
