import { EventEmitter } from "events";
import { randomUUID } from "crypto";

export type ActivityLevel = "info" | "success" | "warning" | "error";
export interface ActivityEntry {
    id: string;
    timestamp: string;
    level: ActivityLevel;
    source: "bot" | "web" | "system";
    message: string;
    storeId?: string;
}

const shared = globalThis as typeof globalThis & { __zurosActivityBus?: EventEmitter; __zurosActivityEntries?: ActivityEntry[] };
const bus = shared.__zurosActivityBus ?? new EventEmitter();
const entries = shared.__zurosActivityEntries ?? [];
bus.setMaxListeners(100);
shared.__zurosActivityBus = bus;
shared.__zurosActivityEntries = entries;

export function recordActivity(entry: Omit<ActivityEntry, "id" | "timestamp">): ActivityEntry {
    const complete = { ...entry, id: randomUUID(), timestamp: new Date().toISOString() };
    entries.unshift(complete);
    if (entries.length > 200) entries.length = 200;
    bus.emit("activity", complete);
    return complete;
}

export function listActivity(storeId?: string, limit = 50): ActivityEntry[] {
    return entries.filter((entry) => !storeId || !entry.storeId || entry.storeId === storeId).slice(0, limit);
}

export function subscribeToActivity(listener: (entry: ActivityEntry) => void): () => void {
    bus.on("activity", listener);
    return () => bus.off("activity", listener);
}
