import axios from "axios";
import databases from "../databases";

const PROMISSE_API_URL = "https://api.promisse.com.br";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const REQUEST_TIMEOUT_MS = 10000;

interface IPromisseInstance {
    apiKey: string;
    isValid: boolean;
    cachedAt: number;
}

/**
 * BUGS CORRIGIDOS:
 * 1) Mesmo problema de cache sem TTL do efi_wrapper/camposcloud-sdk.
 * 2) `createTransaction` e `getTransactionStatus` não tinham timeout,
 *    então uma API fora do ar podia travar a call indefinidamente
 *    (o `checkIsValidConfig` já tinha timeout, os outros não).
 */
class PromissePay_Wrapper {
    private instances: Map<string, IPromisseInstance> = new Map();

    async getInstance(userId: string): Promise<IPromisseInstance | null> {
        const cached = this.instances.get(userId);
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
            return cached;
        }

        return await this.updateCredentials(userId);
    }

    public async updateCredentials(userId: string): Promise<IPromisseInstance | null> {
        const settingsDB = await databases.userSettings.findOne({ userId_discord: userId });
        if (!settingsDB?.promissepay_credentials?.api_key) {
            console.error(`PromissePay API key not found for user ${userId}.`);
            this.instances.delete(userId);
            return null;
        }

        const apiKey = settingsDB.promissepay_credentials.api_key;
        const isValid = await this.checkIsValidConfig(apiKey);

        const instance: IPromisseInstance = { apiKey, isValid, cachedAt: Date.now() };
        this.instances.set(userId, instance);

        return instance;
    }

    async checkIsValidConfig(apiKey: string): Promise<boolean> {
        try {
            await axios.get(`${PROMISSE_API_URL}/balance`, {
                headers: { Authorization: apiKey },
                timeout: REQUEST_TIMEOUT_MS,
            });
            return true;
        } catch (error: any) {
            if (error?.code !== 'ECONNABORTED') {
                console.error(`Error testing PromissePay config:`, error?.message);
            }
            return false;
        }
    }

    async createTransaction(apiKey: string, amountInCents: number): Promise<{
        id: string;
        qrCodeBase64: string;
        copyPaste: string;
        expiresAt: string;
    } | null> {
        try {
            const response = await axios.post(`${PROMISSE_API_URL}/transactions`, { amount: amountInCents }, {
                headers: {
                    Authorization: apiKey,
                    "Content-Type": "application/json",
                },
                timeout: REQUEST_TIMEOUT_MS,
            });

            const data = response.data;

            const qrCodeBase64 = data.qrCodeBase64?.includes(",")
                ? data.qrCodeBase64.split(",")[1]
                : data.qrCodeBase64;

            return {
                id: data.id,
                qrCodeBase64,
                copyPaste: data.copyPaste,
                expiresAt: data.expiresAt,
            };
        } catch (error: any) {
            console.error("Error creating PromissePay transaction:", error?.response?.data || error?.message);
            return null;
        }
    }

    async getTransactionStatus(apiKey: string, transactionId: string): Promise<{
        status: string;
        amount?: number;
    } | null> {
        try {
            const response = await axios.get(`${PROMISSE_API_URL}/transactions/${transactionId}`, {
                headers: { Authorization: apiKey },
                timeout: REQUEST_TIMEOUT_MS,
            });

            return {
                status: response.data.status,
                amount: response.data.amount,
            };
        } catch (error: any) {
            console.error("Error getting PromissePay transaction status:", error?.response?.data || error?.message);
            return null;
        }
    }

    async getBalance(apiKey: string): Promise<{ available: number; locked: number } | null> {
        try {
            const response = await axios.post(`${PROMISSE_API_URL}/balance`, {}, {
                headers: { Authorization: apiKey },
                timeout: REQUEST_TIMEOUT_MS,
            });

            return {
                available: response.data.balance?.balance_available || 0,
                locked: response.data.balance?.balance_locked || 0,
            };
        } catch (error) {
            console.error("Error getting PromissePay balance:", error);
            return null;
        }
    }

    clearInstance(userId: string) {
        this.instances.delete(userId);
    }
}

const promisseWrapper = new PromissePay_Wrapper();
export default promisseWrapper;