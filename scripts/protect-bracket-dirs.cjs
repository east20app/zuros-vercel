const { existsSync, readdirSync, renameSync } = require("fs");
const { join, resolve } = require("path");

// Alguns extratores usados por hosts tratam colchetes como glob e descartam
// diretórios de rotas dinâmicas. Protegemos os nomes depois do build; o
// restore-bracket-dirs.cjs os restaura antes de validar/iniciar o painel.
const MAP = {
    "[...nextauth]": "__nextauth__",
    "[storeId]": "__storeId__",
    "[appId]": "__appId__",
    "[productId]": "__productId__",
    "[cartId]": "__cartId__",
    "[modulo]": "__modulo__",
};

const siteBuild = resolve(__dirname, "..", "site", "next-build-visual");

let renamed = 0;
function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;

        const full = join(dir, entry.name);
        walk(full);

        const target = MAP[entry.name];
        if (!target) continue;

        const destination = join(dir, target);
        if (existsSync(destination)) {
            throw new Error(`Conflito ao proteger diretório: ${destination}`);
        }
        renameSync(full, destination);
        renamed++;
    }
}

walk(siteBuild);
console.log(`[deploy] protect-bracket-dirs: ${renamed} diretório(s) protegido(s).`);
