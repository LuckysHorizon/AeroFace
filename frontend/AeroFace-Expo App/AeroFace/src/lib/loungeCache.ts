// ═══════════════════════════════════════════════════════════════════
//  Lounge Cache — In-memory cache with TTL, rate limiting & dedup
// ═══════════════════════════════════════════════════════════════════

export interface LoungeData {
    lounges: any[];
    airports: any[];
    selectedAirport: string | null;
    airportCity: string;
    airportName: string;
    dataSource: string;
}

interface CacheEntry {
    data: LoungeData;
    timestamp: number;
}

// ── Config ────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000;        // 5 minutes
const MIN_FETCH_INTERVAL_MS = 30 * 1000;    // 30 seconds between same-key fetches

// ── State (module-level singleton — survives component unmounts) ──
const cache = new Map<string, CacheEntry>();
const lastFetchTime = new Map<string, number>();
const inflightRequests = new Map<string, Promise<LoungeData>>();

// ── Public key constant for auto-location fetches ─────────────
export const AUTO_LOCATION_KEY = '__auto__';

/**
 * Build a cache key from an optional airport code.
 * Location-based (no code) fetches all share the AUTO_LOCATION_KEY.
 */
export function cacheKey(airportCode?: string | null): string {
    return airportCode ? airportCode.toUpperCase() : AUTO_LOCATION_KEY;
}

/**
 * Check if a valid (non-expired) cache entry exists for `key`.
 */
export function hasCachedData(key: string): boolean {
    const entry = cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

/**
 * Return cached data if it exists and is still within TTL.
 */
export function getCached(key: string): LoungeData | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp >= CACHE_TTL_MS) {
        // Expired — clean up
        cache.delete(key);
        return null;
    }
    console.log('[Cache] HIT for key:', key);
    return entry.data;
}

/**
 * Core API — return cached data or call `fetchFn` to get fresh data.
 *
 * Features:
 * - Returns cached data instantly if within TTL
 * - Rate-limits repeated fetches (min 30s gap per key)
 * - Deduplicates concurrent in-flight requests for the same key
 */
export async function getCachedOrFetch(
    key: string,
    fetchFn: () => Promise<LoungeData>,
): Promise<LoungeData> {
    // 1. Return from cache if fresh
    const cached = getCached(key);
    if (cached) return cached;

    // 2. Rate limiting — if we fetched recently but it expired from cache
    //    (edge case: shouldn't happen often with 5min TTL vs 30s limit,
    //     but guards against rapid invalidation + re-fetch loops)
    const lastFetch = lastFetchTime.get(key);
    if (lastFetch && Date.now() - lastFetch < MIN_FETCH_INTERVAL_MS) {
        // Still within rate limit window — return stale cache if available
        const stale = cache.get(key);
        if (stale) {
            console.log('[Cache] RATE_LIMITED — returning stale data for key:', key);
            return stale.data;
        }
        // No stale data either, we have to fetch regardless
    }

    // 3. Deduplicate in-flight requests
    const inflight = inflightRequests.get(key);
    if (inflight) {
        console.log('[Cache] DEDUP — waiting for in-flight request for key:', key);
        return inflight;
    }

    // 4. Fresh fetch
    console.log('[Cache] MISS for key:', key);
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

/**
 * Clear a specific cache entry (for pull-to-refresh).
 * Also resets the rate-limit timer so a fresh fetch is allowed immediately.
 */
export function clearCache(key: string): void {
    cache.delete(key);
    lastFetchTime.delete(key);
    console.log('[Cache] CLEARED key:', key);
}

/**
 * Clear the entire cache (rarely needed — e.g. on logout).
 */
export function clearAllCache(): void {
    cache.clear();
    lastFetchTime.clear();
    inflightRequests.clear();
    console.log('[Cache] ALL CLEARED');
}
