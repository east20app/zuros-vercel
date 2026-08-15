const fs = require("fs");
const path = require("path");

const ignoredNames = new Set([".env.example"]);
const roots = [process.cwd(), path.join(process.cwd(), "site")];
const unsafe = [];

for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.startsWith(".env") || ignoredNames.has(entry.name)) continue;
        const file = path.join(root, entry.name);
        if (fs.readFileSync(file, "utf8").trim()) unsafe.push(path.relative(process.cwd(), file));
    }
}

if (unsafe.length) {
    console.error(`Arquivos de ambiente não vazios detectados: ${unsafe.join(", ")}`);
    console.error("Remova-os do pacote/commit e use o gerenciador de segredos do ambiente.");
    process.exit(1);
}

console.log("Verificação de segredos concluída.");
