const AdmZip = require("adm-zip");
const { readdirSync, readFileSync, statSync } = require("fs");
const { extname, join, relative, resolve } = require("path");

const root = resolve(__dirname, "..");
const outputName = "zuros-vercel.zip";
const outputPath = join(root, outputName);
const zip = new AdmZip();

const excludedDirectories = new Set([
    ".git", ".codex", ".agents", ".vscode", ".idea", "node_modules",
    ".next", ".next-dev", "next-build", "next-build-visual",
    "next-build-visual-staging", "dist", "coverage",
]);
const excludedFiles = new Set([
    outputName, "site.zip", "camposcloud-deploy.zip", ".env", ".env.production",
    "cookies.txt", "csrf.txt", "response.txt", "token.txt", "config.json",
]);
const excludedExtensions = new Set([".log", ".tmp", ".bak", ".tsbuildinfo", ".lnk"]);

function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
        if (entry.isFile() && excludedFiles.has(entry.name)) continue;
        if (entry.name.startsWith(".env") && entry.name !== ".env.example") continue;
        const fullPath = join(directory, entry.name);
        if (entry.isDirectory()) walk(fullPath);
        else if (entry.isFile() && !excludedExtensions.has(extname(entry.name).toLowerCase())) {
            zip.addFile(relative(root, fullPath).replace(/\\/g, "/"), readFileSync(fullPath));
        }
    }
}

walk(root);
zip.writeZip(outputPath);
const sizeMB = (statSync(outputPath).size / 1024 / 1024).toFixed(2);
console.log(`[vercel] ${outputName} criado (${sizeMB} MB), sem dependências, builds ou segredos locais.`);
