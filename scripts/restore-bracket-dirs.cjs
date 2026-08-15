const { existsSync, readdirSync, renameSync } = require("fs");
const { join, resolve } = require("path");

// Diretórios com colchetes ("[...nextauth]", "[storeId]", "[appId]") são
// DERRUBADOS por alguns extractors de zip (interpretam "[]" como glob).
// O deploy empacota com nomes placeholder sem colchetes e este script
// restaura os nomes reais ANTES do Next.js iniciar.
const MAP = {
    __nextauth__: "[...nextauth]",
    __storeId__: "[storeId]",
    __appId__: "[appId]",
    __productId__: "[productId]",
    __cartId__: "[cartId]",
    __modulo__: "[modulo]",
};

const siteBuild = resolve(__dirname, "..", "site", "next-build-visual");

let renamed = 0;
function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full);
            const target = MAP[entry.name];
            if (target) {
                const destination = join(dir, target);
                if (existsSync(destination)) {
                    throw new Error(`Conflito ao restaurar diretório: ${destination}`);
                }
                renameSync(full, destination);
                renamed++;
                console.log(`[deploy] restaurado: ${destination}`);
            }
        }
    }
}

walk(siteBuild);
console.log(`[deploy] restore-bracket-dirs: ${renamed} diretório(s) restaurado(s).`);
