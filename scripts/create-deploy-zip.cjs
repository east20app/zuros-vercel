const AdmZip = require("adm-zip");
const { existsSync, readdirSync, readFileSync, statSync } = require("fs");
const { join, relative, resolve } = require("path");

const root = resolve(__dirname, "..");
const outputName = "camposcloud-deploy.zip";
const outputPath = join(root, outputName);
const zip = new AdmZip();

const excludedNames = new Set([
    "node_modules",
    ".git",
    ".agents",
    ".codex",
    ".next",
    ".next-dev",
    "dist",
    outputName,
    "start.err.log",
    "start.out.log",
    "server.stderr.log",
    "server.stdout.log",
    "tsconfig.tsbuildinfo",
    "__pycache__",
    ".venv",
    "venv",
    ".pytest_cache",
    ".mypy_cache",
    ".cache",
    "site-packages",
    ".env",
    ".env.production",
]);

const excludedExtensions = new Set([".rar", ".7z", ".zip", ".pyc", ".pyo", ".log", ".tmp", ".bak", ".tsbuildinfo"]);

const protectedSegments = new Map([
    ["[...nextauth]", "__nextauth__"],
    ["[storeId]", "__storeId__"],
    ["[appId]", "__appId__"],
    ["[productId]", "__productId__"],
    ["[cartId]", "__cartId__"],
    ["[modulo]", "__modulo__"],
]);

function archivePath(filePath) {
    const parts = relative(root, filePath).split(/[\\/]/g);
    // O código-fonte precisa conservar os nomes reais caso o host reconstrua.
    // Apenas o build pronto recebe placeholders e é restaurado no prestart.
    if (parts[0] === "site" && parts[1] === "next-build-visual") {
        return parts.map((part) => protectedSegments.get(part) || part).join("/");
    }
    return parts.join("/");
}

function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (excludedNames.has(entry.name)) continue;
        // Never package local environment variants (.env.local,
        // .env.development, etc.). Keep only the documented example.
        if (entry.name.startsWith(".env") && entry.name !== ".env.example") continue;
        const fullPath = join(directory, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath);
        } else if (entry.isFile() && !excludedExtensions.has(require("path").extname(entry.name).toLowerCase())) {
            zip.addFile(archivePath(fullPath), readFileSync(fullPath));
        }
    }
}

const buildDir = join(root, "site", "next-build-visual");
if (!existsSync(join(buildDir, "BUILD_ID"))) {
    throw new Error("Build do site ausente. Execute npm run build:site antes de gerar o ZIP.");
}

for (const manifestName of ["app-paths-manifest.json", "pages-manifest.json"]) {
    const manifestPath = join(buildDir, "server", manifestName);
    if (!existsSync(manifestPath)) throw new Error(`Build incompleto: ${manifestName} ausente.`);
    const files = Object.values(JSON.parse(readFileSync(manifestPath, "utf8")));
    for (const file of files) {
        if (typeof file !== "string" || !existsSync(join(buildDir, "server", file))) {
            throw new Error(`Build incompleto: artefato ausente para ${file}. Execute npm run build:site -- --force.`);
        }
    }
}

walk(root);
// Signals to prestart that the included Next.js output was intentionally
// precompiled. ZIP extraction changes mtimes, so timestamps cannot be used to
// decide whether this packaged build is stale on the deployment host.
zip.addFile("site/next-build-visual/.deploy-ready", Buffer.from("precompiled\n", "utf8"));
zip.writeZip(outputPath);

const sizeMB = (statSync(outputPath).size / 1024 / 1024).toFixed(2);
console.log(`[deploy] ${outputName} criado (${sizeMB} MB), sem node_modules.`);
