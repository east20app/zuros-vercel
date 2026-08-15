export type ServiceName = "bot" | "web";
export type ServiceState = "starting" | "online" | "degraded" | "offline";
export interface ServiceStatusDTO { service: ServiceName; state: ServiceState; message: string; updatedAt: string }
export interface LogEntryDTO { id: number; level: "info" | "warn" | "error"; service: ServiceName | "system"; message: string; timestamp: string }

export type TelemetrySeverity = "all" | "error" | "warn" | "info";
export interface TelemetryFilter {
    severity?: TelemetrySeverity;
    service?: LogEntryDTO["service"] | "all";
    limit?: number;
}

const severityRank: Record<LogEntryDTO["level"], number> = { error: 0, warn: 1, info: 2 };

const sensitiveKey = /token|authorization|password|secret|api[-_]?key|pix|credential/i;
function safeContext(context?: Record<string, unknown>): string {
    if (!context) return "";
    const sanitized = Object.fromEntries(Object.entries(context).map(([key, value]) => [key, sensitiveKey.test(key) ? "[REDACTED]" : value]));
    try { return ` ${JSON.stringify(sanitized)}`; } catch { return " [contexto não serializável]"; }
}

/** Formata erros com stack e contexto operacional sem registrar credenciais conhecidas. */
export function formatError(error: unknown, context?: Record<string, unknown>): string {
    const details = error instanceof Error ? error.stack || error.message : String(error);
    return `${details}${safeContext(context)}`;
}

const root = globalThis as typeof globalThis & { __zurosTelemetry?: { sequence: number; statuses: Map<ServiceName, ServiceStatusDTO>; logs: LogEntryDTO[] } };
const state = root.__zurosTelemetry ??= {
    sequence: 0,
    statuses: new Map<ServiceName, ServiceStatusDTO>(),
    logs: [] as LogEntryDTO[],
};
export function log(service: LogEntryDTO["service"], level: LogEntryDTO["level"], message: string): void {
    state.logs.push({ id: ++state.sequence, level, service, message, timestamp: new Date().toISOString() });
    if (state.logs.length > 200) state.logs.splice(0, state.logs.length - 200);
}
export function logError(service: LogEntryDTO["service"], error: unknown, context?: Record<string, unknown>): void {
    log(service, "error", formatError(error, context));
}
export function reportStatus(service: ServiceName, serviceState: ServiceState, message: string): void {
    state.statuses.set(service, { service, state: serviceState, message, updatedAt: new Date().toISOString() });
    log(service, serviceState === "degraded" || serviceState === "offline" ? "warn" : "info", message);
}
export function getPlatformTelemetry(filter: TelemetryFilter = {}): { statuses: ServiceStatusDTO[]; logs: LogEntryDTO[]; uptimeSeconds: number } {
    let logs = state.logs;
    if (filter.severity && filter.severity !== "all") {
        const minRank = severityRank[filter.severity];
        logs = logs.filter((entry) => severityRank[entry.level] <= minRank);
    }
    if (filter.service && filter.service !== "all") {
        logs = logs.filter((entry) => entry.service === filter.service);
    }
    const limit = filter.limit ?? 50;
    return { statuses: Array.from(state.statuses.values()), logs: logs.slice(-limit).reverse(), uptimeSeconds: Math.floor(process.uptime()) };
}
