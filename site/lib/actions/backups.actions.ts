"use server";
import { revalidatePath } from "next/cache";
import databases from "@root/src/databases";
import { ActionError, requireSessionUser } from "./context";
import { getBotDocument, saveBotDocument } from "@/lib/drox-bot-config";

export interface BackupEntry {
    arquivo: string;
    timestamp: number | null;
    guild: string;
    canais: number;
    categorias: number;
    cargos: number;
    emojis: number;
    stickers: number;
    membros: number;
    mensagens: number;
}

export interface BackupAutoConfig {
    backup_auto_ativo: boolean;
    backup_auto_minutos: number;
    backup_auto_exclude: string[];
}

export interface BackupQueueItem {
    id: string;
    tipo: "create" | "delete" | "restore";
    arquivo?: string;
    tipos?: string;
    guild_id?: string;
    status?: "done" | "erro";
    mensagem?: string;
}

async function ownedActiveApplication(appId: string) {
    const discordId = await requireSessionUser();
    const identifier = /^[a-f\d]{24}$/i.test(appId) ? { $or: [{ _id: appId }, { botId: appId }, { appId }] } : { botId: appId };
    const application = await databases.applications.findOne({ ...identifier, ownerId: discordId }, { botId: 1, status: 1 }).lean().catch(() => null);
    if (!application) throw new ActionError("Aplicação não encontrada ou sem permissão.");
    if (application.status !== "active") throw new ActionError("Esta aplicação não está ativa.");
    if (!application.botId) throw new ActionError("Esta aplicação ainda não possui um bot vinculado.");
    return { appId: String(application._id), discordId, botId: application.botId };
}

function readItems(doc: Record<string, unknown> | null | undefined): unknown[] {
    if (!doc) return [];
    const items = (doc as Record<string, unknown>).items;
    if (Array.isArray(items)) return items;
    if (Array.isArray(doc)) return doc;
    return [];
}

export async function getBotBackups(appId: string): Promise<{ backups: BackupEntry[]; auto: BackupAutoConfig; fila: BackupQueueItem[] }> {
    const { botId } = await ownedActiveApplication(appId);
    const [backsDoc, configDoc, filaDoc] = await Promise.all([
        getBotDocument(botId, "backs"),
        getBotDocument(botId, "backup_configs"),
        getBotDocument(botId, "backup_requests"),
    ]);
    const backups = readItems(backsDoc).filter((b): b is BackupEntry => !!b && typeof b === "object" && typeof (b as BackupEntry).arquivo === "string");
    const autoRaw = (configDoc ?? {}) as Record<string, unknown>;
    const auto: BackupAutoConfig = {
        backup_auto_ativo: Boolean(autoRaw.backup_auto_ativo) || false,
        backup_auto_minutos: typeof autoRaw.backup_auto_minutos === "number" ? autoRaw.backup_auto_minutos : 360,
        backup_auto_exclude: Array.isArray(autoRaw.backup_auto_exclude) ? (autoRaw.backup_auto_exclude as string[]) : [],
    };
    const fila = readItems(filaDoc).filter((q): q is BackupQueueItem => !!q && typeof q === "object");
    return { backups, auto, fila };
}

async function enqueueRequest(botId: string, item: Omit<BackupQueueItem, "id" | "status">) {
    const filaDoc = await getBotDocument(botId, "backup_requests");
    const fila = readItems(filaDoc);
    const next: BackupQueueItem = { ...item, id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()), status: undefined };
    await saveBotDocument(botId, "backup_requests", { items: [...fila.slice(-99), next] });
}

export async function createBotBackup(appId: string): Promise<{ ok: true }> {
    const { botId } = await ownedActiveApplication(appId);
    await enqueueRequest(botId, { tipo: "create" });
    revalidatePath(`/dashboard/${appId}/backups`);
    return { ok: true };
}

export async function deleteBotBackup(appId: string, arquivo: string): Promise<{ ok: true }> {
    const { botId } = await ownedActiveApplication(appId);
    await enqueueRequest(botId, { tipo: "delete", arquivo });
    revalidatePath(`/dashboard/${appId}/backups`);
    return { ok: true };
}

export async function restoreBotBackup(appId: string, arquivo: string, tipos = "all", guildId?: string): Promise<{ ok: true }> {
    const { botId } = await ownedActiveApplication(appId);
    await enqueueRequest(botId, { tipo: "restore", arquivo, tipos, guild_id: guildId || undefined });
    revalidatePath(`/dashboard/${appId}/backups`);
    return { ok: true };
}

export async function saveBotBackupAuto(appId: string, auto: BackupAutoConfig): Promise<{ ok: true }> {
    const { botId } = await ownedActiveApplication(appId);
    await saveBotDocument(botId, "backup_configs", {
        backup_auto_ativo: Boolean(auto.backup_auto_ativo),
        backup_auto_minutos: Math.max(1, Math.min(2880, Math.round(Number(auto.backup_auto_minutos) || 360))),
        backup_auto_exclude: Array.isArray(auto.backup_auto_exclude) ? auto.backup_auto_exclude : [],
    });
    revalidatePath(`/dashboard/${appId}/backups`);
    return { ok: true };
}