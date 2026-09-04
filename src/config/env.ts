import dotenv from "dotenv";
import { z } from "zod";

const nodeEnv = process.env.NODE_ENV ?? "development";
dotenv.config({ path: `.env.${nodeEnv}` });
dotenv.config();

// Durante a descoberta de rotas o Next apenas importa os módulos e nenhuma
// consulta deve ocorrer. Valores locais inertes deixam o build independente de
// segredos; em runtime a validação abaixo continua exigindo as URLs verdadeiras.
if (process.env.NEXT_PHASE === "phase-production-build") {
    process.env.MONGO_DB_URL ||= "mongodb://127.0.0.1:27017/zuros_build";
    process.env.DROX_BOTS_MONGO_URI ||= "mongodb://127.0.0.1:27017/drox_build";
}

// Permite referenciar a credencial principal nos arquivos locais sem duplicar o segredo.
if (process.env.DROX_BOTS_MONGO_URI === "${MONGO_DB_URL}") {
    process.env.DROX_BOTS_MONGO_URI = process.env.MONGO_DB_URL;
}

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // Opcional no painel standalone/Vercel. Só o worker Discord precisa dele.
    BOT_TOKEN: z.string().min(1).optional(),
    MONGO_DB_URL: z.string().min(1, "MONGO_DB_URL é obrigatório"),
    DROX_BOTS_MONGO_URI: z.string().min(1, "DROX_BOTS_MONGO_URI é obrigatório para acessar o banco drox_bots"),
    OWNER_ID: z.string().min(1).optional(),
    CAMPOS_API_TOKEN: z.string().min(10).optional(),
    HOST: z.string().min(1).optional(),
    PORT: z.coerce.number().int().positive().max(65535).default(3000),
    NEXTAUTH_URL: z.string().url("NEXTAUTH_URL deve ser uma URL HTTP/HTTPS válida").optional(),
    NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET deve ter pelo menos 32 caracteres").optional(),
    DATA_ENCRYPTION_KEY: z.string().min(32, "DATA_ENCRYPTION_KEY deve ter pelo menos 32 caracteres").optional(),
    EFI_WEBHOOK_SECRET: z.string().min(16, "EFI_WEBHOOK_SECRET deve ter pelo menos 16 caracteres").optional(),
    PROMISSEPAY_WEBHOOK_SECRET: z.string().min(16, "PROMISSEPAY_WEBHOOK_SECRET deve ter pelo menos 16 caracteres").optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "ambiente"}: ${issue.message}`)
        .join("; ");
    throw new Error(`Configuração de ambiente inválida: ${details}`);
}

export const env = Object.freeze(parsed.data);
export type Environment = z.infer<typeof envSchema>;

/** Validação exclusiva do boot; não roda durante a coleta de páginas do Next. */
export function validateProductionRuntimeEnv(value: Environment = env) {
    if (value.NODE_ENV !== "production") return;
    // Os segredos dos provedores de pagamento só são necessários quando os
    // respectivos webhooks estão habilitados. Bloquear todo o processo por
    // causa deles também derruba o painel público e o bot na hospedagem.
    const required = ["NEXTAUTH_URL", "NEXTAUTH_SECRET"] as const;
    const missing = required
        .filter((key) => !value[key]);
    if (missing.length) throw new Error(`Configuração de produção incompleta: ${missing.join(", ")}.`);
}
