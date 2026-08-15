const fs = require("node:fs");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..");
const cachePath = path.resolve(workspaceRoot, "site", ".next-dev");
const expectedParent = path.resolve(workspaceRoot, "site");

if (path.dirname(cachePath) !== expectedParent || path.basename(cachePath) !== ".next-dev") {
    throw new Error(`Caminho de cache inesperado: ${cachePath}`);
}

fs.rmSync(cachePath, { recursive: true, force: true });
console.log(`Cache de desenvolvimento removido: ${cachePath}`);
