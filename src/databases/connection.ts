import { connect, connection, set } from "mongoose";
import { isMainThread } from "worker_threads";
import { env } from "../config/env";

set("bufferTimeoutMS", 30_000);

let connectionPromise: ReturnType<typeof connect> | undefined;

export default async () => {
    if (connection.readyState === 1) return;
    if (connectionPromise) return connectionPromise.then(() => undefined);
    try {
        connectionPromise = connect(env.MONGO_DB_URL, {
            // Cada isolate usa pool próprio e pequeno. Isso impede que o bot
            // gerente consuma as conexões reservadas ao painel e aos clientes.
            maxPoolSize: process.env.VERCEL ? 5 : isMainThread ? 10 : 5,
            minPoolSize: 0,
            maxIdleTimeMS: 60_000,
            serverSelectionTimeoutMS: 12_000,
            connectTimeoutMS: 10_000,
            socketTimeoutMS: 30_000,
            appName: process.env.VERCEL ? "zuros-vercel" : isMainThread ? "zuros-web" : "zuros-manager-bot",
        });
        await connectionPromise;
        // Versões antigas gravavam cupons em `name` e deixavam um índice
        // único name_1. Documentos novos usam `code`, portanto todos possuem
        // name=null e o segundo insert falha com E11000. Remova somente esse
        // índice legado; os demais índices continuam intactos.
        const coupons = connection.collection("coupons");
        const indexes = await coupons.indexes().catch(() => []);
        const legacyNameIndex = indexes.find((index) =>
            index.name === "name_1" && index.key && Object.keys(index.key).length === 1 && index.key.name === 1
        );
        if (legacyNameIndex) {
            try {
                await coupons.dropIndex("name_1");
                console.log("✅・Índice legado de cupons removido (name_1).");
            } catch (error: any) {
                // O bot e o painel podem iniciar simultaneamente; se o outro
                // processo removeu o índice primeiro, a migração já terminou.
                if (error?.codeName !== "IndexNotFound" && error?.code !== 27) throw error;
            }
        }
        console.log("✅・Conexão com o MongoDB estabelecida com sucesso!");
    } catch (error: any) {
        console.error("❌・Erro ao conectar com o MongoDB:", error.message);
        connectionPromise = undefined;
        throw error;
    }
}
