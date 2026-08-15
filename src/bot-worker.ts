import { parentPort } from "worker_threads";
import { BaseInteraction } from "discord.js";
import client from "./bot-client";
import { env } from "./config/env";
import { isDiscordInteractionExpiredError } from "./functions/utils";
import "./databases";
import "./cronjobs";

type WorkerEvent = { type: "status"; state: "starting" | "online" | "degraded" | "offline"; message: string } | { type: "log"; level: "info" | "warn" | "error"; message: string };
const send = (event: WorkerEvent) => parentPort?.postMessage(event);
const safeInteractionMethods = ["reply", "followUp", "editReply", "update", "deferReply", "deferUpdate"] as const;
for (const methodName of safeInteractionMethods) {
    const prototype = BaseInteraction.prototype as any;
    const originalMethod = prototype[methodName];
    if (typeof originalMethod !== "function" || prototype[methodName]?._safeWrapped) continue;
    prototype[methodName] = async function (this: BaseInteraction, ...args: any[]) {
        try { return await originalMethod.apply(this, args); }
        catch (error) { if (isDiscordInteractionExpiredError(error)) return undefined; throw error; }
    };
    prototype[methodName]._safeWrapped = true;
}

async function shutdown(signal: string) {
    send({ type: "status", state: "offline", message: `Encerrando (${signal})` });
    client.destroy();
    process.exit(0);
}

// Heartbeat periódico: permite ao processo pai detectar travamentos do loop de
// eventos e acionar auto-healing mesmo sem um crash explícito.
const startedAt = Date.now();
const heartbeat = setInterval(() => {
    if (!parentPort) return;
    parentPort.postMessage({ type: "heartbeat", uptime: Math.round((Date.now() - startedAt) / 1000) });
}, 15_000);
heartbeat.unref();

client.on("clientReady", (readyClient) => {
    const tag = readyClient.user?.tag || "bot";
    send({ type: "status", state: "online", message: `Online como ${tag}` });
    send({ type: "log", level: "info", message: `${tag} conectado em ${readyClient.guilds.cache.size} servidor(es)` });
});
process.on("unhandledRejection", (error) => send({ type: "log", level: "error", message: error instanceof Error ? error.stack || error.message : String(error) }));
process.on("uncaughtException", (error) => {
    if (!isDiscordInteractionExpiredError(error)) send({ type: "log", level: "error", message: error.stack || error.message });
});
parentPort?.on("message", (message) => { if (message?.type === "shutdown") void shutdown("parent"); });
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

send({ type: "status", state: "starting", message: "Conectando ao Discord" });
if (!env.BOT_TOKEN) throw new Error("BOT_TOKEN é obrigatório para iniciar o worker Discord.");
void client.login(env.BOT_TOKEN).catch((error) => {
    send({ type: "status", state: "degraded", message: error instanceof Error ? error.message : "Falha ao conectar" });
    throw error;
});
