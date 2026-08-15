const { spawnSync } = require("child_process");
const { join } = require("path");
const fs = require("fs");

const root = process.cwd();
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 24) console.warn(`[build] Node ${process.versions.node}: modo de compatibilidade ativo.`);

function loadEnvFile(file) {
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        let val = m[2].trim();
        if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            val = val.slice(1, -1);
        }
        if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
}

loadEnvFile(join(root, ".env.production"));
loadEnvFile(join(root, ".env"));

if (!process.env.NODE_ENV) process.env.NODE_ENV = "production";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const executable = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : npmCmd;
const executableArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", npmCmd, "run", "build"]
    : ["run", "build"];
const result = spawnSync(executable, executableArgs, {
    cwd: join(root, "site"),
    stdio: "inherit",
    shell: false,
    env: {
        ...process.env,
        NODE_OPTIONS: process.env.BUILD_NODE_OPTIONS || "--max-old-space-size=2048",
    },
});

process.exit(result.status ?? 1);
