import CamposCloudSDK from '@camposcloud/sdk';
import databases from '../databases';

interface UserSDKInstance {
    instance: CamposCloudSDK;
    isValid: boolean;
    cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const INVALID_CACHE_TTL_MS = 15 * 1000;
const REQUEST_TIMEOUT_MS = 3 * 60 * 1000;
const VALIDATION_TIMEOUT_MS = 15 * 1000;

function configureHttpClient(instance: CamposCloudSDK) {
    const client = (instance as unknown as {
        axiosInstance?: { defaults: { timeout: number; maxBodyLength?: number; maxContentLength?: number } };
    }).axiosInstance;
    if (client) {
        client.defaults.timeout = REQUEST_TIMEOUT_MS;
        client.defaults.maxBodyLength = Infinity;
        client.defaults.maxContentLength = Infinity;
    }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
    });
}

/**
 * Mesmo bug do efi_wrapper.ts: sem TTL, um `isValid: false` (token expirado,
 * instabilidade da API etc.) ficava preso no cache pra sempre, e o Map
 * de instâncias nunca era limpo em caso de erro.
 */
class SDKWrapper {
    private instances: Map<string, UserSDKInstance> = new Map();
    private pending: Map<string, Promise<UserSDKInstance | null>> = new Map();

    /**
     * Retorna a instância do SDK para o usuário
     */
    async getInstance(userId: string): Promise<UserSDKInstance | null> {
        const cached = this.instances.get(userId);
        const ttl = cached?.isValid ? CACHE_TTL_MS : INVALID_CACHE_TTL_MS;
        if (cached && Date.now() - cached.cachedAt < ttl) {
            return cached;
        }
        const current = this.pending.get(userId);
        if (current) return current;
        const request = this.updateCredentials(userId).finally(() => this.pending.delete(userId));
        this.pending.set(userId, request);
        return request;
    }

    /**
     * Cria ou atualiza as credenciais do SDK no cache
     */
    public async updateCredentials(userId: string): Promise<UserSDKInstance | null> {
        const settingsDB = await databases.userSettings.findOne(
            { userId_discord: userId },
            { "settings.token_campos": 1, token_campos: 1, userId_campos: 1 }
        ).lean();
        const serverToken = String(process.env.CAMPOS_API_TOKEN || "").trim();
        const serverAccountId = serverToken.includes(":") ? serverToken.split(":", 1)[0] : "";
        const fallbackToken = settingsDB?.userId_campos && String(settingsDB.userId_campos) === serverAccountId ? serverToken : "";
        const storedToken = String(settingsDB?.settings?.token_campos || settingsDB?.token_campos || "").trim();
        const token = storedToken || fallbackToken;
        if (!token) {
            this.instances.delete(userId);
            return null;
        }

        let instance = new CamposCloudSDK({ apiToken: token });

        // O SDK não define timeout. Uma conexão interrompida durante o upload
        // deixaria a interação do Discord pendente indefinidamente.
        configureHttpClient(instance);

        let isValid = await this.checkIsValidConfig(userId, instance);
        if (!isValid && fallbackToken && fallbackToken !== storedToken) {
            instance = new CamposCloudSDK({ apiToken: fallbackToken });
            configureHttpClient(instance);
            isValid = await this.checkIsValidConfig(userId, instance);
        }
        const userSDKInstance: UserSDKInstance = { instance, isValid, cachedAt: Date.now() };
        this.instances.set(userId, userSDKInstance);

        return userSDKInstance;
    }

    /**
     * Testa se o token/config do usuário é válido
     */
    async checkIsValidConfig(userId: string, sdkInstance: CamposCloudSDK): Promise<boolean> {
        try {
            await withTimeout(sdkInstance.getMe(), VALIDATION_TIMEOUT_MS, "Tempo limite ao validar a CamposCloud.");
            return true;
        } catch (error) {
            const status = (error as { response?: { status?: number } })?.response?.status;
            console.warn(`[CamposCloud] Falha ao validar credencial do usuário ${userId}${status ? ` (HTTP ${status})` : ""}.`);
            return false;
        }
    }

    /**
     * Obtém o uso de memória do plano do usuário
     */
    async getPlanUsage(userId: string) {
        const sdkInstance = await this.getInstance(userId);
        if (!sdkInstance?.isValid) return null;

        const sdk = sdkInstance.instance;

        const [userData, applications] = await Promise.all([
            sdk.getMe().catch(() => null),
            sdk.getApplications().catch(() => null),
        ]);
        if (!userData || !userData.currentSubscription) return null;
        if (!applications) return null;

        const currentSubscription = userData.currentSubscription;
        const currentUserPlan = currentSubscription.planReference;

        let planMemoryMB: number | undefined;
        if (currentUserPlan) {
            if (["business", "customized"].includes(currentUserPlan.type)) {
                planMemoryMB = currentSubscription.allocatedMemoryMB;
            } else {
                planMemoryMB = currentUserPlan.ramMB;
            }
        }

        if (planMemoryMB === undefined) return null;

        const usedMemoryMB = Math.max(0, Number(applications.totalUsedRAM) || 0);
        const freeMemoryMB = Math.max(0, planMemoryMB - usedMemoryMB);
        const utilizedMemoryPercentage =
            planMemoryMB > 0
                ? Number(((usedMemoryMB / planMemoryMB) * 100).toFixed(2))
                : 0;

        return {
            planReference: currentUserPlan,
            totalMemory: planMemoryMB,
            usedMemoryMB,
            freeMemoryMB,
            utilizedMemoryPercentage,
            endAt: currentSubscription.endAt,
        };
    }

    clearInstance(userId: string) {
        this.instances.delete(userId);
        this.pending.delete(userId);
    }
}

const sdkWrapper = new SDKWrapper();
export default sdkWrapper;
