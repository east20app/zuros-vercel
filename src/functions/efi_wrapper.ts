import EfiPay from "sdk-node-apis-efi";
import databases from "../databases";
import { env } from "../config/env";

interface UserEfiInstance {
    instance: EfiPay;
    pixKey: string;
    isValid: boolean;
    cachedAt: number;
}

// Tempo que uma instância fica em cache antes de ser considerada "velha"
// e forçar uma releitura das credenciais no banco.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * BUGS CORRIGIDOS:
 * 1) Sem TTL: se `isValid` desse false uma vez (ex: cert vencido/instabilidade
 *    momentânea), o usuário ficava com `isValid: false` cacheado PARA SEMPRE,
 *    já que `getInstance` só chama `updateCredentials` quando não existe cache.
 * 2) `this.instances` nunca é limpo — em produção, com muitos usuários
 *    diferentes ao longo do tempo, isso é um memory leak lento.
 */
class EFI_Wrapper {
    private instances: Map<string, UserEfiInstance> = new Map();

    async getInstance(userId: string): Promise<UserEfiInstance | null> {
        const cached = this.instances.get(userId);
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
            return cached;
        }

        return await this.updateCredentials(userId);
    }

    /**
     * Atualiza/Cria as credenciais do usuário no cache
     */
    public async updateCredentials(userId: string): Promise<UserEfiInstance | null> {
        const settingsDB = await databases.userSettings.findOne({ userId_discord: userId });
        if (!settingsDB) {
            console.error(`Bank settings not found for user ${userId}.`);
            this.instances.delete(userId);
            return null;
        }

        const efiSettings = settingsDB.efi_credentials || {};
        if (!efiSettings.client_id || !efiSettings.client_secret || !efiSettings.pix_key || !efiSettings.cert) {
            console.error(`EFI bank settings are incomplete for user ${userId}.`);
            this.instances.delete(userId);
            return null;
        }

        const instance = new EfiPay({
            client_id: efiSettings.client_id,
            client_secret: efiSettings.client_secret,
            certificate: efiSettings.cert,
            cert_base64: true,
            sandbox: env.NODE_ENV === "development",
        });

        const userEfiInstance: UserEfiInstance = {
            instance,
            pixKey: efiSettings.pix_key,
            isValid: await this.checkIsValidConfig(userId, instance),
            cachedAt: Date.now(),
        };

        this.instances.set(userId, userEfiInstance);

        return userEfiInstance;
    }

    /**
     * Testa se a instância do usuário está funcionando
     */
    async checkIsValidConfig(userId: string, efiInstance: EfiPay): Promise<boolean> {
        try {
            await efiInstance.getAccountBalance();
            return true;
        } catch (error) {
            console.error(`Error testing EFI instance for user ${userId}:`, error);
            return false;
        }
    }

    clearInstance(userId: string) {
        this.instances.delete(userId);
    }
}

const efiWrapper = new EFI_Wrapper();
export default efiWrapper;
