const { existsSync, readFileSync, readdirSync, renameSync, rmSync, statSync } = require("fs");
const { join } = require("path");
const { spawnSync } = require("child_process");
const { Script } = require("vm");
const dotenv = require("dotenv");
require("./restore-bracket-dirs.cjs");

const root = process.cwd();
const siteDir = join(root, "site");
const siteNodeModules = join(siteDir, "node_modules");
const nodeMajor = Number(process.versions.node.split(".")[0]);

if (nodeMajor >= 24) {
    console.warn(`[deploy] Node ${process.versions.node}: usando modo de compatibilidade para o Next.js 14.`);
}

// O Next roda com cwd=site, portanto seus arquivos .env ficam na raiz invisíveis
// durante o build. Carregue a mesma configuração usada pelo processo principal.
dotenv.config({ path: join(root, ".env.production") });
dotenv.config({ path: join(root, ".env") });

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
// Building Next.js needs substantially more heap than the long-running server.
// Keep this aligned with build-site.cjs; the production server remains capped
// separately by the root package.json start script.
const BUILD_NODE_OPTIONS = process.env.BUILD_NODE_OPTIONS || "--max-old-space-size=2048";

function log(msg) {
    console.log(`[deploy] ${msg}`);
}

function buildDir() {
    return "next-build-visual";
}

function hasSiteDeps() {
    let pkg = null;
    try {
        pkg = require(join(siteDir, "package.json"));
    } catch {
        return false;
    }
    const deps = Object.keys(pkg.dependencies || {});
    if (!deps.length) return false;
    for (const dep of deps) {
        if (!existsSync(join(siteNodeModules, dep))) return false;
    }
    return true;
}

function hasNextBuild(dir = buildDir()) {
    try {
        const outputDir = join(siteDir, dir);
        if (!existsSync(outputDir)) return false;

        const requiredFiles = [
            "BUILD_ID",
            "build-manifest.json",
            "routes-manifest.json",
            join("server", "pages-manifest.json"),
            join("server", "app-paths-manifest.json"),
            join("server", "webpack-runtime.js"),
        ];
        if (!requiredFiles.every((file) => existsSync(join(outputDir, file)))) return false;

        const manifestPath = join(outputDir, "server", "app-paths-manifest.json");
        const appPaths = Object.values(JSON.parse(readFileSync(manifestPath, "utf8")));
        if (!appPaths.length) return false;

        const pagesManifestPath = join(outputDir, "server", "pages-manifest.json");
        const pagePaths = Object.values(JSON.parse(readFileSync(pagesManifestPath, "utf8")));
        const complete = [...appPaths, ...pagePaths].every(
            (file) => typeof file === "string" && existsSync(join(outputDir, "server", file)),
        );
        if (!complete) return false;

        // OneDrive can leave a generated chunk present but partially corrupted.
        // Manifests and mtimes still look valid in that case, while Next only
        // discovers the syntax error when the affected route is requested.
        const serverJavaScript = [];
        const collectJavaScript = (dir) => {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
                const target = join(dir, entry.name);
                if (entry.isDirectory()) collectJavaScript(target);
                else if (entry.name.endsWith(".js")) serverJavaScript.push(target);
            }
        };
        collectJavaScript(join(outputDir, "server"));
        for (const file of serverJavaScript) {
            try {
                new Script(readFileSync(file, "utf8"), { filename: file });
            } catch {
                log(`Chunk inválido detectado: ${file.slice(outputDir.length + 1)}; reconstrução necessária.`);
                return false;
            }
        }

        // Deployment ZIPs contain a build produced and validated before upload.
        // Extracting a ZIP can give source files newer mtimes than BUILD_ID,
        // which must not force a memory-heavy rebuild on the 512 MB host.
        const packagedBuild = existsSync(join(outputDir, ".deploy-ready"));
        const buildTime = statSync(join(outputDir, "BUILD_ID")).mtimeMs;
        // Server actions import integration code from the root src directory,
        // so changes there also invalidate the compiled Next.js server bundle.
        const sourceRoots = [join(siteDir, "app"), join(siteDir, "components"), join(siteDir, "lib"), join(root, "src")];
        const sourceFiles = [
            join(siteDir, "package.json"), join(siteDir, "next.config.mjs"),
            join(siteDir, "tailwind.config.ts"), join(siteDir, "postcss.config.mjs"),
            join(root, "package.json"), join(root, "tsconfig.json"),
        ];
        const visit = (dir) => {
            if (!existsSync(dir)) return;
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
                const target = join(dir, entry.name);
                if (entry.isDirectory()) visit(target);
                else sourceFiles.push(target);
            }
        };
        sourceRoots.forEach(visit);
        if (!packagedBuild && sourceFiles.some((file) => existsSync(file) && statSync(file).mtimeMs > buildTime)) {
            log("Código do painel mais recente que o build; reconstrução necessária.");
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

function panelPortInUse() {
    if (process.platform !== "win32") return false;
    const port = Number(process.env.PORT || 3000);
    const probe = spawnSync("powershell.exe", [
        "-NoProfile", "-NonInteractive", "-Command",
        `if (Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }`,
    ], { stdio: "ignore", windowsHide: true });
    return probe.status === 0;
}

function run(cmd, args, cwd, extraEnv = {}) {
    const executable = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : cmd;
    const executableArgs = process.platform === "win32" ? ["/d", "/s", "/c", cmd, ...args] : args;
    const result = spawnSync(executable, executableArgs, {
        cwd,
        stdio: "inherit",
        shell: false,
        env: { ...process.env, NODE_OPTIONS: BUILD_NODE_OPTIONS, ...extraEnv },
    });
    return result.status === 0;
}

function cleanLeftovers() {
    if (!existsSync(siteNodeModules)) return;
    let removed = 0;
    for (const entry of readdirSync(siteNodeModules)) {
        if (/^\.[^@].+-[A-Za-z0-9_-]{8,}$/.test(entry)) {
            try {
                rmSync(join(siteNodeModules, entry), { recursive: true, force: true });
                removed++;
            } catch {}
        }
    }
    if (removed) log(`Removidos ${removed} diretórios temporários quebrados do npm.`);
}

function installSiteDeps(force) {
    if (!force && hasSiteDeps()) {
        log("site/node_modules OK, pulando instalação.");
        return true;
    }
    log("Instalando dependências do painel (site)...");
    try {
        rmSync(siteNodeModules, { recursive: true, force: true });
    } catch {}
    cleanLeftovers();
    return run(npmCmd, ["install", "--no-audit", "--no-fund"], siteDir);
}

function buildSite() {
    if (hasNextBuild()) {
        log(`site/${buildDir()} já buildado, pulando build.`);
        return true;
    }
    const outputDir = join(siteDir, buildDir());
    const stagingDirName = `${buildDir()}-staging`;
    const stagingDir = join(siteDir, stagingDirName);
    if (panelPortInUse()) {
        log("O painel já está rodando na porta 3000. Encerre a instância atual antes de reconstruir o site.");
        return false;
    }
    if (existsSync(outputDir)) {
        log(`Build ausente, incompleto ou desatualizado em site/${buildDir()}; reconstruindo sem remover o build atual.`);
    }
    try { rmSync(stagingDir, { recursive: true, force: true }); } catch {}
    const attempts = nodeMajor >= 24 ? 3 : 1;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        log(`Buildando o painel Next.js${attempts > 1 ? ` (tentativa ${attempt}/${attempts})` : ""}...`);
        if (run(npmCmd, ["run", "build"], siteDir, { NEXT_DIST_DIR: stagingDirName }) && hasNextBuild(stagingDirName)) {
            const previousDir = `${outputDir}-previous`;
            try {
                rmSync(previousDir, { recursive: true, force: true });
                if (existsSync(outputDir)) renameSync(outputDir, previousDir);
                renameSync(stagingDir, outputDir);
                rmSync(previousDir, { recursive: true, force: true });
                return true;
            } catch (error) {
                log(`Não foi possível ativar o novo build: ${error instanceof Error ? error.message : String(error)}`);
                if (!existsSync(outputDir) && existsSync(previousDir)) renameSync(previousDir, outputDir);
                return false;
            }
        }
        if (attempt < attempts) {
            log("Worker do Next encerrou inesperadamente; limpando o build parcial e tentando novamente.");
            try { rmSync(stagingDir, { recursive: true, force: true }); } catch {}
        }
    }
    return false;
}

const mode = process.argv[2] || "all";
const force = process.argv[3] === "--force";

let ok = true;
if (mode === "install") {
    ok = installSiteDeps(force);
} else if (mode === "build") {
    if (!installSiteDeps(force)) ok = false;
    else ok = buildSite();
} else {
    if (!installSiteDeps(force)) ok = false;
    else ok = buildSite();
}

if (!ok) {
    console.error("[deploy] Falha no painel (site). Inicialização cancelada para evitar um serviço incompleto.");
    process.exit(1);
}
