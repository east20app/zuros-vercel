import crypto from "crypto";

const PREFIX = "enc:v1:";

function encryptionKey(): Buffer {
    const secret = process.env.DATA_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
    if (!secret) {
        throw new Error("DATA_ENCRYPTION_KEY não configurada.");
    }
    return crypto.createHash("sha256").update(secret, "utf8").digest();
}

export function isEncryptedSecret(value: unknown): value is string {
    return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(value: string | null | undefined): string {
    const normalized = String(value || "");
    if (!normalized || isEncryptedSecret(normalized)) return normalized;

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
    const payload = [
        iv.toString("base64url"),
        cipher.getAuthTag().toString("base64url"),
        encrypted.toString("base64url"),
    ].join(".");
    return PREFIX + payload;
}

export function decryptSecret(value: string | null | undefined): string {
    const normalized = String(value || "");
    if (!normalized || !isEncryptedSecret(normalized)) {
        // Compatibilidade gradual: dados antigos em texto puro continuam legíveis
        // e são criptografados na próxima gravação.
        return normalized;
    }

    const [iv, tag, encrypted] = normalized.slice(PREFIX.length).split(".");
    if (!iv || !tag || !encrypted) throw new Error("Segredo criptografado inválido.");

    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        encryptionKey(),
        Buffer.from(iv, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
        decipher.update(Buffer.from(encrypted, "base64url")),
        decipher.final(),
    ]).toString("utf8");
}