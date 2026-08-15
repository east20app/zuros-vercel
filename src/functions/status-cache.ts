export interface InstanceStatusSnapshot {
    online: boolean;
    memoryUsedMB: number | null;
    memoryMB: number | null;
    uptime: number | null;
}

interface CacheEntry {
    value: InstanceStatusSnapshot;
    cachedAt: number;
    stale: boolean;
}

const TTL_MS = 20_000;
const STALE_MS = 90_000;
const globalCache = globalThis as typeof globalThis & { __zurosInstanceStatusCache?: Map<string, CacheEntry> };
const cache = globalCache.__zurosInstanceStatusCache ?? new Map<string, CacheEntry>();
globalCache.__zurosInstanceStatusCache = cache;

/**
 * Cache de status das instâncias na CamposCloud. Evita chamadas excessivas à
 * API do SDK no dashboard: após TTL o valor vira "stale" (retorna o valor
 * antigo enquanto o refresh roda); após STALE é descartado.
 */
export function getCachedInstanceStatus(
    appId: string,
    fetchStatus: () => Promise<InstanceStatusSnapshot>
): Promise<InstanceStatusSnapshot> {
    const key = String(appId);
    const now = Date.now();
    const cached = cache.get(key);

    if (cached && now - cached.cachedAt < TTL_MS) return Promise.resolve(cached.value);

    const pending = Promise.resolve()
        .then(fetchStatus)
        .then((value) => {
            cache.set(key, { value, cachedAt: Date.now(), stale: false });
            return value;
        })
        .catch((error) => {
            if (cached && now - cached.cachedAt < STALE_MS) {
                if (!cached.stale) {
                    cached.stale = true;
                    console.warn(`[STATUS-CACHE] Falha ao atualizar status de ${key}; usando valor em cache.`);
                }
                return cached.value;
            }
            throw error;
        });

    if (cached && now - cached.cachedAt >= TTL_MS && now - cached.cachedAt < STALE_MS) {
        // Retorna o valor antigo enquanto o refresh ocorre em background.
        void pending;
        return Promise.resolve(cached.value);
    }
    return pending;
}

export function invalidateInstanceStatus(appId: string): void {
    cache.delete(String(appId));
}

export function clearInstanceStatusCache(): void {
    cache.clear();
}
