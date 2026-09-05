export interface RateLimitOptions {
    windowMs: number;
    maxRequests: number;
}

export interface RateLimitStore {
    get(key: string): Promise<RateLimitEntry | undefined> | RateLimitEntry | undefined;
    set(key: string, entry: RateLimitEntry): Promise<void> | void;
    delete(key: string): Promise<void> | void;
}

export interface RateLimitEntry {
    count: number;
    resetTime: number;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
    windowMs: 5000,
    maxRequests: 5,
};

/** Armazenamento local seguro para desenvolvimento e fallback de runtime. */
export class MemoryRateLimitStore implements RateLimitStore {
    private readonly entries = new Map<string, RateLimitEntry>();

    get(key: string) {
        return this.entries.get(key);
    }

    set(key: string, entry: RateLimitEntry) {
        this.entries.set(key, entry);
    }

    delete(key: string) {
        this.entries.delete(key);
    }

    prune(now = Date.now()) {
        for (const [key, entry] of this.entries) {
            if (now > entry.resetTime) this.entries.delete(key);
        }
    }
}

export class RateLimiter {
    constructor(
        private readonly store: RateLimitStore = new MemoryRateLimitStore(),
        private readonly defaults: RateLimitOptions = DEFAULT_OPTIONS,
    ) {}

    async check(key: string, options?: Partial<RateLimitOptions>): Promise<boolean> {
        const opts = { ...this.defaults, ...options };
        const now = Date.now();
        const entry = await this.store.get(key);

        if (!entry || now > entry.resetTime) {
            await this.store.set(key, { count: 1, resetTime: now + opts.windowMs });
            return true;
        }

        if (entry.count >= opts.maxRequests) return false;

        await this.store.set(key, { ...entry, count: entry.count + 1 });
        return true;
    }
}

const defaultStore = new MemoryRateLimitStore();
const defaultLimiter = new RateLimiter(defaultStore);

/** Compatibilidade com os consumidores atuais; endpoints novos podem injetar um store distribuído. */
export function checkRateLimit(key: string, options?: Partial<RateLimitOptions>): boolean {
    const now = Date.now();
    defaultStore.prune(now);
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const entry = defaultStore.get(key);

    if (!entry || now > entry.resetTime) {
        defaultStore.set(key, { count: 1, resetTime: now + opts.windowMs });
        return true;
    }

    if (entry.count >= opts.maxRequests) return false;
    defaultStore.set(key, { ...entry, count: entry.count + 1 });
    return true;
}

export { defaultLimiter };
