import assert from "node:assert/strict";
import { test } from "node:test";

const MODULE_PATH = "../../src/functions/secret-crypto.ts";

test("criptografa e descriptografa segredos com DATA_ENCRYPTION_KEY", async () => {
    const previous = process.env.DATA_ENCRYPTION_KEY;
    const previousSession = process.env.NEXTAUTH_SECRET;
    process.env.DATA_ENCRYPTION_KEY = "d".repeat(64);
    process.env.NEXTAUTH_SECRET = "s".repeat(64);

    try {
        const crypto = await import(MODULE_PATH);
        const encrypted = crypto.encryptSecret("token-secreto");
        assert.match(encrypted, /^enc:v1:/);
        assert.equal(crypto.decryptSecret(encrypted), "token-secreto");
        assert.equal(crypto.encryptSecret(encrypted), encrypted);
    } finally {
        if (previous === undefined) delete process.env.DATA_ENCRYPTION_KEY;
        else process.env.DATA_ENCRYPTION_KEY = previous;
        if (previousSession === undefined) delete process.env.NEXTAUTH_SECRET;
        else process.env.NEXTAUTH_SECRET = previousSession;
    }
});

test("não usa NEXTAUTH_SECRET como fallback de criptografia", async () => {
    const previous = process.env.DATA_ENCRYPTION_KEY;
    const previousSession = process.env.NEXTAUTH_SECRET;
    delete process.env.DATA_ENCRYPTION_KEY;
    process.env.NEXTAUTH_SECRET = "s".repeat(64);

    try {
        const crypto = await import(`${MODULE_PATH}?no-data-key=${Date.now()}`);
        assert.throws(() => crypto.encryptSecret("token-secreto"), /DATA_ENCRYPTION_KEY não configurada/);
    } finally {
        if (previous === undefined) delete process.env.DATA_ENCRYPTION_KEY;
        else process.env.DATA_ENCRYPTION_KEY = previous;
        if (previousSession === undefined) delete process.env.NEXTAUTH_SECRET;
        else process.env.NEXTAUTH_SECRET = previousSession;
    }
});
