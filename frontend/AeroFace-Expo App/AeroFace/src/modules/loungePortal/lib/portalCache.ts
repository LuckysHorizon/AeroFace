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
 * Return cached data or call fetchFn. Deduplicates concurrent requests
 * and rate-limits repeated fetches to the same key.
 */
export async function cachedFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
): Promise<T> {
    // 1. Return from cache if fresh
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
        console.log('[PortalCache] HIT:', key);
        return entry.data as T;
    }

    // 2. Rate limit — return stale if we fetched too recently
    const lastFetch = lastFetchTime.get(key);
    if (lastFetch && Date.now() - lastFetch < MIN_FETCH_INTERVAL_MS) {
        if (entry) {
            console.log('[PortalCache] RATE_LIMITED (stale):', key);
            return entry.data as T;
        }
    }

    // 3. Deduplicate in-flight requests
    const inflight = inflightRequests.get(key);
    if (inflight) {
        console.log('[PortalCache] DEDUP:', key);
        return inflight as Promise<T>;
    }

    // 4. Fresh fetch
    console.log('[PortalCache] MISS:', key);
    const promise = fetchFn()
        .then((data) => {
            cache.set(key, { data, timestamp: Date.now() });
            lastFetchTime.set(key, Date.now());
            return data;
        })
        .finally(() => {
            inflightRequests.delete(key);
        });

    inflightRequests.set(key, promise);
    return promise;
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
} as const;
