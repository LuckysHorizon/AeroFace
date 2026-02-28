// ═══════════════════════════════════════════════════════════════════
//  Portal Cache — Rate limiting, TTL caching & dedup for lounge portal
// ═══════════════════════════════════════════════════════════════════

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

// ── Config ────────────────────────────────────────────────────────
const CACHE_TTL_MS = 3 * 60 * 1000;        // 3 minutes
const MIN_FETCH_INTERVAL_MS = 15 * 1000;    // 15 seconds between same-key fetches
const WRITE_COOLDOWN_MS = 2 * 1000;         // 2 seconds between writes to same resource

// ── State (module-level singletons) ──────────────────────────────
const cache = new Map<string, CacheEntry<any>>();
const lastFetchTime = new Map<string, number>();
const lastWriteTime = new Map<string, number>();
const inflightRequests = new Map<string, Promise<any>>();

// ── Read Cache ────────────────────────────────────────────────────

/**
 * Return cached data or call fetchFn. Deduplicates concurrent requests,
 * rate-limits repeated fetches, retries on transient errors, and returns
 * stale data when the network is down.
 */
export async function cachedFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
): Promise<T> {
    // 1. Return from cache if fresh
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.data as T;
    }

    // 2. Rate limit — return stale if we fetched too recently
    const lastFetch = lastFetchTime.get(key);
    if (lastFetch && Date.now() - lastFetch < MIN_FETCH_INTERVAL_MS) {
        if (entry) {
            return entry.data as T;
        }
    }

    // 3. Deduplicate in-flight requests
    const inflight = inflightRequests.get(key);
    if (inflight) {
        return inflight as Promise<T>;
    }

    // 4. Fresh fetch with retry + stale-on-error
    const promise = fetchWithRetry(fetchFn, 2, 1500)
        .then((data) => {
            cache.set(key, { data, timestamp: Date.now() });
            lastFetchTime.set(key, Date.now());
            return data;
        })
        .catch((err) => {
            // If we have stale data, return it instead of crashing
            if (entry) {
                console.warn('[PortalCache] STALE_FALLBACK:', key);
                return entry.data as T;
            }
            // No stale data — re-throw with a clean message
            throw new Error(sanitizeError(err));
        })
        .finally(() => {
            inflightRequests.delete(key);
        });

    inflightRequests.set(key, promise);
    return promise;
}

/**
 * Retry a fetch function up to `retries` times with exponential-ish delay.
 */
async function fetchWithRetry<T>(
    fn: () => Promise<T>,
    retries: number,
    delayMs: number,
): Promise<T> {
    try {
        return await fn();
    } catch (err) {
        if (retries <= 0) throw err;
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return fetchWithRetry(fn, retries - 1, delayMs * 1.5);
    }
}

/**
 * Strip HTML and map common server errors to user-friendly messages.
 */
export function sanitizeError(err: any): string {
    const raw: string = err?.message || err?.toString?.() || 'Unknown error';

    // Detect HTML responses (Cloudflare error pages, 5xx, etc.)
    if (raw.includes('<!DOCTYPE') || raw.includes('<html')) {
        if (raw.includes('525')) return 'Server connection issue (SSL). Please try again in a moment.';
        if (raw.includes('502')) return 'Server temporarily unavailable. Please try again.';
        if (raw.includes('503')) return 'Service is down for maintenance. Please try again later.';
        if (raw.includes('524')) return 'Request timed out. Please try again.';
        return 'Server is temporarily unavailable. Please pull down to refresh.';
    }

    // Detect network-level failures
    if (raw.includes('Network request failed') || raw.includes('network'))
        return 'No internet connection. Please check your network.';
    if (raw.includes('timeout') || raw.includes('Timeout'))
        return 'Request timed out. Please try again.';

    // Return the original message if it's already clean
    return raw.length > 200 ? raw.slice(0, 150) + '…' : raw;
}

// ── Write Rate Limiting ───────────────────────────────────────────

/**
 * Rate-limit write operations (insert/update/delete) to prevent rapid-fire
 * DB mutations. Returns true if the write is allowed, false if throttled.
 */
export function canWrite(key: string): boolean {
    const last = lastWriteTime.get(key);
    if (last && Date.now() - last < WRITE_COOLDOWN_MS) {
        console.log('[PortalCache] WRITE_THROTTLED:', key);
        return false;
    }
    return true;
}

/**
 * Mark that a write operation occurred for the given key.
 * Also invalidates any related read caches.
 */
export function markWrite(key: string, invalidateKeys?: string[]): void {
    lastWriteTime.set(key, Date.now());
    // Invalidate related read caches so next fetch gets fresh data
    if (invalidateKeys) {
        invalidateKeys.forEach(k => {
            cache.delete(k);
            lastFetchTime.delete(k);
        });
    }
}

// ── Cache Management ──────────────────────────────────────────────

/**
 * Clear a specific cache entry (for pull-to-refresh).
 */
export function clearPortalCache(key: string): void {
    cache.delete(key);
    lastFetchTime.delete(key);
    console.log('[PortalCache] CLEARED:', key);
}

/**
 * Clear all portal caches (on logout).
 */
export function clearAllPortalCache(): void {
    cache.clear();
    lastFetchTime.clear();
    lastWriteTime.clear();
    inflightRequests.clear();
    console.log('[PortalCache] ALL CLEARED');
}

// ── Cache Key Builders ────────────────────────────────────────────

export const CK = {
    lounge: () => 'portal:lounge',
    members: (loungeId: string) => `portal:members:${loungeId}`,
    transactions: (loungeId: string, period: string) => `portal:tx:${loungeId}:${period}`,
    plans: (loungeId: string) => `portal:plans:${loungeId}`,
    stats: (loungeId: string) => `portal:stats:${loungeId}`,
    visits: (loungeId: string) => `portal:visits:${loungeId}`,
} as const;
