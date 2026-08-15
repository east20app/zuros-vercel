import { Worker } from "worker_threads";
import { createServer, IncomingMessage, ServerResponse, Server } from "http";
import { createReadStream, existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { createRequire } from "module";
import { env, validateProductionRuntimeEnv } from "./config/env";
import "./databases";
import { log, logError, reportStatus } from "./integration/telemetry";
import { recordActivity } from "./integration/activity-log";

// Mantém Next, React e react-dom vindos da mesma instalação do painel.
const siteRequire = createRequire(path.resolve(process.cwd(), "site", "package.json"));
const next = siteRequire("next") as typeof import("next").default;

let webServer: Server | undefined;
let botWorker: Worker | undefined;
let workerRestartTimer: NodeJS.Timeout | undefined;
let workerMonitor: NodeJS.Timeout | undefined;
let workerLastHeartbeat = 0;
let workerReceivedHeartbeat = false;
let workerRestarts = 0;
let shuttingDown = false;

const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 45_000;
const WORKER_STARTUP_TIMEOUT_MS = 120_000;

const isDev = env.NODE_ENV !== "production";
const host = env.HOST;
const port = env.PORT;
const bindHost = host && ["0.0.0.0", "::", "localhost", "127.0.0.1"].includes(host) ? host : undefined;
const nextApp = next({
    dev: isDev,
    dir: path.resolve(process.cwd(), "site"),
    hostname: bindHost,
    port,
});
const nextRequestHandler = nextApp.getRequestHandler();
const buildIdPath = path.resolve(process.cwd(), "site", "next-build-visual", "BUILD_ID");
const staticContentTypes: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
};

function serveCompatibleStaticAsset(req: IncomingMessage, res: ServerResponse) {
    if (!req.url?.startsWith("/_next/static/")) return false;

    let relativePath: string;
    try {
        relativePath = decodeURIComponent(new URL(req.url, "http://localhost").pathname.slice(1));
    } catch {
        return false;
    }
    if (relativePath.split("/").some((part) => part === "..")) return false;

    const file = path.resolve(process.cwd(), "site", "next-build-visual", ...relativePath.split("/").slice(1));
    const allowedRoot = path.resolve(process.cwd(), "site", "next-build-visual", "static") + path.sep;
    if (!file.startsWith(allowedRoot) || !existsSync(file) || !statSync(file).isFile()) return false;

    res.statusCode = 200;
    res.setHeader("Content-Type", staticContentTypes[path.extname(file).toLowerCase()] || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    createReadStream(file).pipe(res);
    return true;
}

function readBuildId() {
    try {
        return readFileSync(buildIdPath, "utf8").trim();
    } catch {
        return "";
    }
}

async function startWebServer(prepared = false) {
    reportStatus("web", "starting", "Preparando o painel");
    try {
        console.log("[WEB] Iniciando o painel Next.js (prepare)...");
        if (!prepared) await nextApp.prepare();
        const activeBuildId = isDev ? "" : readBuildId();
        if (!isDev && !activeBuildId) {
            throw new Error("Build do painel inválido: arquivo BUILD_ID não encontrado.");
        }
        console.log("[WEB] Painel preparado, abrindo porta...");
        const server = createServer((req, res) => {
            if (serveCompatibleStaticAsset(req, res)) return;
            void nextRequestHandler(req, res).catch((error) => {
                console.error("[WEB] Erro ao processar requisição:", error);
                if (!res.headersSent) {
                    res.statusCode = 500;
                    res.setHeader("Content-Type", "text/plain; charset=utf-8");
                }
                if (!res.writableEnded) res.end("Erro interno do servidor");
            });
        });
        webServer = server;
        server.on("error", (err) => {
            console.error("[WEB] Erro no servidor HTTP:", err);
            const serverError = err as NodeJS.ErrnoException;
            if (serverError.code === "EADDRINUSE") {
                console.error(`[WEB] A porta ${port} já está em uso. Encerrando para evitar bot online sem painel.`);
                process.exitCode = 1;
                setTimeout(() => process.exit(1), 250).unref();
            }
        });
        server.listen(port, bindHost, () => {
            reportStatus("web", "online", `Painel disponível na porta ${port}`);
            console.log(`[WEB] ZUROS APP disponível em http://${bindHost || "0.0.0.0"}:${port}`);
        });
        // O build de produção é imutável enquanto este processo estiver
        // rodando. No OneDrive, observar BUILD_ID gerava falsos reinícios durante
        // sincronização e podia deixar o Next apontando para chunks incompletos.
    } catch (err) {
        reportStatus("web", "degraded", err instanceof Error ? err.message : "Falha no painel");
        console.error("[WEB] Erro ao iniciar o painel Next.js:", err);
        console.error("[WEB] Detalhes:", err instanceof Error ? err.stack : err);
        // Mantém o bot disponível: os serviços têm ciclos de falha independentes.
    }
}

type BotWorkerEvent = { type: "status"; state: "starting" | "online" | "degraded" | "offline"; message: string } | { type: "log"; level: "info" | "warn" | "error"; message: string; storeId?: string } | { type: "heartbeat"; uptime: number };

function startWorkerMonitor() {
    if (workerMonitor) clearInterval(workerMonitor);
    workerMonitor = setInterval(() => {
        if (!botWorker || shuttingDown) return;
        const silenceMs = Date.now() - workerLastHeartbeat;
        const timeout = workerReceivedHeartbeat ? HEARTBEAT_TIMEOUT_MS : WORKER_STARTUP_TIMEOUT_MS;
        if (silenceMs <= timeout) return;
        const seconds = Math.round(silenceMs / 1000);
        logError("bot", new Error(`Worker sem heartbeat há ${seconds}s; reiniciando por auto-healing.`), { event: "worker-heartbeat-timeout" });
        console.error(`[WORKER] Sem heartbeat há ${seconds}s — terminando para auto-recuperação.`);
        botWorker.terminate().catch(() => undefined);
    }, HEARTBEAT_INTERVAL_MS);
    workerMonitor.unref();
}

function startBotWorker() {
    if (shuttingDown || botWorker) return;
    reportStatus("bot", "starting", "Iniciando worker isolado");
    workerLastHeartbeat = Date.now();
    workerReceivedHeartbeat = false;
    startWorkerMonitor();
    const worker = new Worker(path.resolve(process.cwd(), "src", "bot-worker.ts"), {
        execArgv: process.execArgv,
        resourceLimits: { maxOldGenerationSizeMb: 160, maxYoungGenerationSizeMb: 32 },
    });
    botWorker = worker;
    worker.on("message", (event: BotWorkerEvent) => {
        if (event.type === "heartbeat") {
            workerLastHeartbeat = Date.now();
            workerReceivedHeartbeat = true;
            return;
        }
        if (event.type === "status") {
            reportStatus("bot", event.state, event.message);
            if (event.state === "online") {
                workerRestarts = 0;
                log("bot", "info", `Worker recuperado (heartbeat em ${Math.round((Date.now() - workerLastHeartbeat) / 1000)}s).`);
            }
        }
        else {
            log("bot", event.level, event.message);
            if (event.storeId) recordActivity({ source: "bot", level: event.level === "warn" ? "warning" : event.level, message: event.message, storeId: event.storeId });
        }
    });
    worker.on("error", (error) => logError("bot", error, { component: "worker" }));
    worker.on("exit", (code) => {
        const wasUnresponsive = Date.now() - workerLastHeartbeat > HEARTBEAT_TIMEOUT_MS;
        if (botWorker === worker) botWorker = undefined;
        if (workerMonitor) { clearInterval(workerMonitor); workerMonitor = undefined; }
        if (shuttingDown) return;
        const reason = wasUnresponsive ? "perda de heartbeat (auto-healing)" : `código de saída ${code}`;
        reportStatus("bot", "degraded", `Worker encerrado (${reason})`);
        log("bot", "warn", `Worker encerrado por ${reason}. Reiniciando em backoff exponencial.`);
        const delay = Math.min(30_000, 1_000 * 2 ** Math.min(workerRestarts++, 5));
        workerRestartTimer = setTimeout(startBotWorker, delay);
        workerRestartTimer.unref();
    });
}

async function bootstrap() {
    console.log("[SYSTEM] Iniciando ZUROS BOT + ZUROS APP...");
    try {
        validateProductionRuntimeEnv();
        startBotWorker();
        const [webResult] = await Promise.allSettled([nextApp.prepare()]);
        if (webResult.status === "fulfilled") await startWebServer(true);
        else reportStatus("web", "degraded", webResult.reason instanceof Error ? webResult.reason.message : "Falha ao preparar painel");
    } catch (error) {
        console.error("[SYSTEM] Falha crítica durante a inicialização:", error);
        await shutdown("bootstrap-error", 1);
    }
}

async function shutdown(signal: string, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[SYSTEM] Encerrando com segurança (${signal})...`);
    const closeWeb = new Promise<void>((resolve) => webServer ? webServer.close(() => resolve()) : resolve());
    if (workerRestartTimer) clearTimeout(workerRestartTimer);
    if (workerMonitor) { clearInterval(workerMonitor); workerMonitor = undefined; }
    botWorker?.postMessage({ type: "shutdown" });
    const closeWorker = botWorker ? new Promise<void>((resolve) => { botWorker?.once("exit", () => resolve()); setTimeout(resolve, 5_000).unref(); }) : Promise.resolve();
    await Promise.race([Promise.all([closeWeb, closeWorker]), new Promise<void>((resolve) => setTimeout(resolve, 6_000))]);
    process.exit(exitCode);
}

bootstrap();

process.on("unhandledRejection", (error) => {
    logError("system", error, { event: "unhandledRejection" });
    console.error("Unhandled Rejection:", error);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    logError("system", error, { event: "uncaughtException" });
});

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
