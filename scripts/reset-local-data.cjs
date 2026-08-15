const path = require("path");
const fs = require("fs/promises");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env.production") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
    if (process.env.RESET_LOCAL_DATA !== "YES") throw new Error('Defina RESET_LOCAL_DATA="YES" para confirmar.');
    if (!process.env.MONGO_DB_URL) throw new Error("MONGO_DB_URL não configurada.");
    const workspace = path.resolve(process.cwd());
    const releasesRoot = path.resolve(workspace, "releases");
    if (releasesRoot !== path.join(workspace, "releases") || !releasesRoot.startsWith(`${workspace}${path.sep}`)) throw new Error("Diretório fora do workspace.");

    await mongoose.connect(process.env.MONGO_DB_URL);
    const database = mongoose.connection.db;
    if (!database?.databaseName) throw new Error("Banco não selecionado.");
    const databaseName = database.databaseName;
    const collections = await database.listCollections({}, { nameOnly: true }).toArray();
    let deletedDocuments = 0;
    for (const { name } of collections) {
        if (!name || name.startsWith("system.")) continue;
        const result = await database.collection(name).deleteMany({});
        deletedDocuments += result.deletedCount;
    }

    await fs.mkdir(releasesRoot, { recursive: true });
    const entries = await fs.readdir(releasesRoot);
    for (const entry of entries) {
        const target = path.resolve(releasesRoot, entry);
        if (!target.startsWith(`${releasesRoot}${path.sep}`)) throw new Error("Caminho inválido.");
        await fs.rm(target, { recursive: true, force: true });
    }
    console.log(`[reset] Banco "${databaseName}" zerado: ${deletedDocuments} documento(s) removido(s) de ${collections.length} coleção(ões).`);
    console.log(`[reset] ${entries.length} item(ns) removido(s) de releases/.`);
    console.log("[reset] CamposCloud não foi alterada.");
    await mongoose.disconnect();
}
main().catch(async (error) => { console.error("[reset] Falha:", error?.message || error); await mongoose.disconnect().catch(() => undefined); process.exitCode = 1; });
