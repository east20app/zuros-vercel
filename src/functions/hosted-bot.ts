import AdmZip from "adm-zip";
import fs from "fs/promises";
import path from "path";
import { readReleaseBuffer, releaseBufferExists } from "./release-storage";

export interface HostedBotConfig {
    botID?: string;
    botToken: string;
    apiURL?: string;
    version?: string;
    syncEmojis?: boolean;
    saveConfig?: boolean;
    startOnBackup?: boolean;
    preserveExistingConfig?: boolean;
    bot?: {
        token: string;
        owner?: string;
        id?: string;
        perms?: string;
        server?: string;
    };
}

export function getReleasePath(productId: string, version: string): string {
    return path.join("releases", productId, `${version}.zip`);
}

export async function releaseExists(productId: string, version: string): Promise<boolean> {
    const releasePath = getReleasePath(productId, version);
    return releaseBufferExists(productId, version, releasePath);
}

const BOT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}$/;
const BOT_ID_PATTERN = /^\d{15,25}$/;

/**
 * Valida todas as credenciais antes de qualquer operação de deploy. Falhas
 * aqui abortam o processo sem contato com a CamposCloud, tornando a rotação de
 * tokens e a injeção de variáveis de ambiente à prova de erros em cadeia.
 */
export function validateHostedBotConfig(config: HostedBotConfig): void {
    if (!config || typeof config !== "object") throw new Error("Configuração do bot hospedado ausente.");
    const token = (config.botToken || config.bot?.token || "").trim();
    if (!token) throw new Error("Token do bot é obrigatório para o deploy.");
    if (!BOT_TOKEN_PATTERN.test(token)) throw new Error("Token do bot parece inválido: use o token completo de um bot do Discord (formato 3 partes).");
    if (config.botID && !BOT_ID_PATTERN.test(config.botID.trim())) throw new Error("ID do bot deve conter apenas dígitos (15-25 caracteres).");
    if (config.bot?.id && !BOT_ID_PATTERN.test(config.bot.id.trim())) throw new Error("applicationId do bot deve conter apenas dígitos (15-25 caracteres).");
    if (config.bot?.owner && !BOT_ID_PATTERN.test(config.bot.owner.trim())) throw new Error("ID do dono deve conter apenas dígitos (15-25 caracteres).");
    if (config.apiURL && !/^https?:\/\/.+/i.test(config.apiURL)) throw new Error("URL da API inválida: deve começar com http:// ou https://.");
    if (config.version && config.version.length > 60) throw new Error("Versão do bot muito longa.");
}

/** Entradas residuais de desenvolvimento removidas do pacote antes do upload. */
function disposableEntry(name: string): boolean {
    const normalized = name.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
    const segments = normalized.split("/").filter(Boolean);
    const disposableDirectory = (part: string) =>
        part === "__pycache__" || part === ".pytest_cache" || part === ".mypy_cache" ||
        part === ".ruff_cache" || part === ".tox" || part === "tests" || part === "test" ||
        part === "tmp" || part === "temp" || part === "venv" || part === ".venv" || part === "env" ||
        part === ".git" || part === ".hg" || part === ".svn" || part === ".idea" || part === ".vscode" ||
        part === "__MACOSX" || part === "node_modules/.cache";
    const disposableFile = /(^|\/)(\.ds_store|thumbs\.db|\.coverage|coverage\.xml|pytest\.ini|tox\.ini|\.gitignore|\.npmrc|\.python-version|\.env\.(local|example|dev|prod)|.*\.py[co]|.*\.log|.*\.tmp|.*\.bak)$/.test(normalized);
    const disposableDeepFile = /\.(pyc|pyo|log|tmp|bak)$/.test(normalized.split("/").pop() || "");
    return segments.some(disposableDirectory) || disposableFile || disposableDeepFile;
}

export async function buildHostedBotPackageBuffer(
    releasePath: string,
    config: HostedBotConfig
): Promise<Buffer> {
    const normalized = releasePath.replace(/\\/g, "/");
    const match = normalized.match(/releases\/([^/]+)\/([^/]+)\.zip$/);
    const releaseBuffer = match ? await readReleaseBuffer(match[1], match[2], releasePath) : await fs.readFile(releasePath);
    return buildHostedBotPackageFromBuffer(releaseBuffer, config);
}

/** Gera o pacote de uma aplicação a partir de uma release já carregada. */
export function buildHostedBotPackageFromBuffer(
    releaseBuffer: Buffer,
    config: HostedBotConfig
): Buffer {
    validateHostedBotConfig(config);
    const zipFile = new AdmZip(releaseBuffer);

    // Tree Shaking: remove resíduos de desenvolvimento antes do upload. Reduz
    // transferência, extração e cold start na CamposCloud.
    let removedBytes = 0;
    let removedEntries = 0;
    for (const entry of zipFile.getEntries()) {
        if (disposableEntry(entry.entryName)) {
            removedBytes += entry.header.size;
            removedEntries += 1;
            zipFile.deleteFile(entry.entryName);
        }
    }

    const entries = zipFile.getEntries().map((entry) => entry.entryName);
    const filesToReplace = ["config.json", ".env", "token.txt"];

    for (const fileName of filesToReplace) {
        if (entries.includes(fileName)) {
            zipFile.deleteFile(fileName);
        }
    }

    const apiURL = config.apiURL ?? "https://api.droxbot.com.br";
    const version = config.version ?? "Beta 1.2.3";
    const botToken = (config.bot?.token ?? config.botToken).trim();

    const botConfig = {
        botID: config.botID,
        botToken,
        apiURL,
        version,
        droxEmojis: config.syncEmojis ?? true,
        DROX_EMOJIS: config.syncEmojis ?? true,
        API_URL: apiURL,
        VERSION: version,
        TELEMETRY_URL: `${apiURL.replace(/\/$/, "")}/api/bot-telemetry`,
        saveConfig: config.saveConfig ?? false,
        startOnBackup: config.startOnBackup ?? true,
        perms: config.bot?.perms ?? "",
        bot: {
            token: botToken,
            owner: config.bot?.owner,
            id: config.bot?.id ?? config.botID,
            perms: config.bot?.perms,
            server: config.bot?.server ?? "",
        },
    };

    const envContent = [
        `BOT_TOKEN=${botToken}`,
        `BOT_TOKEN_DISCORD=${botToken}`,
        `TOKEN=${botToken}`,
        `DISCORD_TOKEN=${botToken}`,
        `BOT_ID=${config.botID ?? ""}`,
        `OWNER_ID=${config.bot?.owner ?? ""}`,
        `APPLICATION_ID=${config.bot?.id ?? ""}`,
        `API_URL=${apiURL}`,
        `VERSION=${version}`,
        `DROX_EMOJIS=${config.syncEmojis ?? true}`,
        `TELEMETRY_URL=${apiURL.replace(/\/$/, "")}/api/bot-telemetry`,
        `SAVE_CONFIG=${config.saveConfig ?? false}`,
        `START_ON_BACKUP=${config.startOnBackup ?? true}`,
        `SERVER_ID=${config.bot?.server ?? ""}`,
        `PERMS=${config.bot?.perms ?? ""}`,
    ].join("\n");

    if (!config.preserveExistingConfig) {
        zipFile.addFile("config.json", Buffer.from(JSON.stringify(botConfig, null, 4)));
        zipFile.addFile(".env", Buffer.from(envContent));
        zipFile.addFile("token.txt", Buffer.from(botToken));
    }

    const output = zipFile.toBuffer();
    const originalSize = releaseBuffer.byteLength;
    const reduction = originalSize > 0 ? Math.round(((originalSize - output.byteLength) / originalSize) * 100) : 0;
    if (removedEntries > 0) {
        console.log(`[HOSTED-BOT] Tree shaking: ${removedEntries} arquivo(s) removido(s), ${reduction}% menor (${originalSize} -> ${output.byteLength} bytes).`);
    }
    return output;
}

export async function redeployWithNewToken(
    camposApplication: { uploadFile: (opts: { file: Buffer; path?: string }) => Promise<any> },
    productId: string,
    version: string,
    config: HostedBotConfig
): Promise<void> {
    const releasePath = getReleasePath(productId, version);
    const zipBuffer = await buildHostedBotPackageBuffer(releasePath, config);
    await camposApplication.uploadFile({ file: zipBuffer, path: "/" });
}
