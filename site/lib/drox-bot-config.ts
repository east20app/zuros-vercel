import "server-only";
import { EventEmitter } from "events";
import mongoose, { type Connection } from "mongoose";
import { isAllowedBotDocument } from "./bot-config-modules";
type DroxDocument = { _id: string } & Record<string, unknown>;

export type DroxSyncOperation = "insert" | "update" | "delete";
export interface DroxSyncEvent { botId: string; docId: string; operation: DroxSyncOperation }
export interface DroxSyncState { watching: boolean; lastError: string | null; startedAt: string | null }

const connectionCache = globalThis as typeof globalThis & { __zurosDroxConnection?: Promise<Connection> };
function connection(): Promise<Connection> {
    if (!connectionCache.__zurosDroxConnection) {
        const configuredUri = process.env.DROX_BOTS_MONGO_URI;
        const uri = configuredUri === "${MONGO_DB_URL}" ? process.env.MONGO_DB_URL : configuredUri;
        if (!uri) throw new Error("DROX_BOTS_MONGO_URI is not configured");
        const pending = mongoose.createConnection(uri, { dbName: "drox_bots", serverSelectionTimeoutMS: 5_000, maxPoolSize: 10 }).asPromise();
        const cached = pending.catch((error) => {
            // Uma falha transitória não pode envenenar o cache até o próximo restart.
            if (connectionCache.__zurosDroxConnection === cached) delete connectionCache.__zurosDroxConnection;
            throw error;
        });
        connectionCache.__zurosDroxConnection = cached;
    }
    return connectionCache.__zurosDroxConnection;
}
function validate(botId: string, docId: string) {
    if (!/^\d{15,25}$/.test(botId)) throw new Error("Invalid DROX bot id");
    if (!isAllowedBotDocument(docId)) throw new Error("DROX document is not allowed");
}

/**
 * Drox Sync: barramento de eventos compartilhado no processo. Toda escrita no
 * Mongo `drox_bots` emite um evento imediato aqui, permitindo que o painel
 * atualize a UI sem aguardar polling. O Change Stream cobre escritas feitas
 * por bots Python hospedados; o saveBotDocument emite o mesmo evento para
 * cobrir escritas feitas pelo próprio painel.
 */
const busState = globalThis as typeof globalThis & { __zurosDroxSync?: EventEmitter; __zurosDroxSyncStarted?: boolean };
const syncBus = busState.__zurosDroxSync ?? new EventEmitter();
syncBus.setMaxListeners(200);
busState.__zurosDroxSync = syncBus;

const syncState = globalThis as typeof globalThis & { __zurosDroxSyncState?: DroxSyncState };
const state = syncState.__zurosDroxSyncState ??= { watching: false, lastError: null, startedAt: null };

function emitSync(botId: string, docId: string, operation: DroxSyncOperation) {
    syncBus.emit("sync", { botId, docId, operation } satisfies DroxSyncEvent);
}

/** Assina eventos de sincronização. Retorna uma função para cancelar. */
export function subscribeBotConfigSync(listener: (event: DroxSyncEvent) => void): () => void {
    syncBus.on("sync", listener);
    return () => { syncBus.off("sync", listener); };
}

export function getDroxSyncState(): DroxSyncState {
    return { ...state };
}

/** Inicia (uma única vez) o Change Stream do `drox_bots`. Idempotente. */
export function startBotConfigSyncWatcher(): void {
    if (busState.__zurosDroxSyncStarted) return;
    busState.__zurosDroxSyncStarted = true;
    state.startedAt = new Date().toISOString();
    void connection()
        .then(async (db) => {
            const database = db.db;
            if (!database) throw new Error("DROX database unavailable");
            const pipeline: object[] = [{
                $match: {
                    "ns.coll": /^\d{15,25}$/,
                    operationType: { $in: ["insert", "update", "replace", "delete"] },
                },
            }];
            const cursor = database.watch(pipeline, { fullDocument: "updateLookup" });
            state.watching = true;
            state.lastError = null;
            cursor.on("change", (change) => {
                const entry = change as { ns?: { coll?: string }; documentKey?: { _id?: unknown }; operationType?: string };
                const botId = String(entry.ns?.coll || "");
                const docId = String(entry.documentKey?._id || "");
                const operation: DroxSyncOperation =
                    entry.operationType === "delete" ? "delete" :
                    entry.operationType === "insert" ? "insert" : "update";
                if (!botId || !docId) return;
                if (!isAllowedBotDocument(docId)) return;
                emitSync(botId, docId, operation);
            });
            cursor.on("error", (error) => {
                state.watching = false;
                const raw = error instanceof Error ? error.message : String(error);
                const standalone = (typeof error === "object" && error !== null && (error as { code?: unknown }).code === 40573) || /replica set/i.test(raw);
                if (standalone) {
                    // MongoDB local sem replica set não suporta change streams.
                    // A sincronização continua funcionando via polling do cliente.
                    state.lastError = "MongoDB standalone: change streams indisponíveis (40573). Sincronização via polling.";
                    console.warn("[DROX SYNC] Change streams indisponíveis neste MongoDB (standalone). Sincronização segue via polling.");
                    return;
                }
                state.lastError = raw;
                console.error("[DROX SYNC] Change stream encerrado com erro:", error);
            });
            cursor.on("close", () => {
                state.watching = false;
            });
        })
        .catch((error) => {
            state.lastError = error instanceof Error ? error.message : String(error);
            console.error("[DROX SYNC] Não foi possível iniciar o watcher:", error);
        });
}

function toPlainJson(value: unknown): unknown {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(toPlainJson);
    if (value instanceof Date) return value.toISOString();
    const bson = value as { _bsontype?: string; toHexString?: () => string };
    if (bson._bsontype === "ObjectId" && typeof bson.toHexString === "function") return bson.toHexString();
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return Buffer.from(value).toString("base64");
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) out[key] = toPlainJson((value as Record<string, unknown>)[key]);
    return out;
}

export async function getBotDocument(botId: string, docId: string): Promise<Record<string, unknown> | null> {
    validate(botId, docId); const db = (await connection()).db; if (!db) throw new Error("DROX database unavailable");
    const document = await db.collection<DroxDocument>(botId).findOne({ _id: docId }); if (!document) return null;
    const data: Record<string, unknown> = { ...document };
    delete data._id;
    delete data._updatedAt;
    // Converte tipos BSON (Date, ObjectId, Buffer) para valores JSON puros para
    // que as respostas atravessem a fronteira RSC (Server Components / Server
    // Actions) sem o erro "Only plain objects can be passed to Client
    // Components".
    return toPlainJson(data) as Record<string, unknown>;
}
export async function saveBotDocument(botId: string, docId: string, data: Record<string, unknown>): Promise<void> {
    validate(botId, docId); const db = (await connection()).db; if (!db) throw new Error("DROX database unavailable");
    const clean = { ...data }; delete (clean as { _id?: unknown })._id;
    // The hosted DROX watcher uses this timestamp to recognize external writes
    // and invalidate its in-memory configuration cache immediately.
    await db.collection<DroxDocument>(botId).replaceOne(
        { _id: docId },
        { _id: docId, ...clean, _updatedAt: new Date() },
        { upsert: true },
    );
    // Notifica consumidores do painel imediatamente após a escrita.
    emitSync(botId, docId, "update");
}
