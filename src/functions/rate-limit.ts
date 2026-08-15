const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

interface RateLimitOptions {
    windowMs: number;
    maxRequests: number;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
    windowMs: 5000,
    maxRequests: 5,
};

export function checkRateLimit(key: string, options?: Partial<RateLimitOptions>): boolean {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetTime) {
        rateLimitMap.set(key, { count: 1, resetTime: now + opts.windowMs });
        return true;
    }

    if (entry.count >= opts.maxRequests) {
        return false;
    }

    entry.count++;
    return true;
}

setInterval(() => {
    const now = Date.now();
    rateLimitMap.forEach((entry, key) => {
        if (now > entry.resetTime) {
            rateLimitMap.delete(key);
        }
    });
}, 30000);
