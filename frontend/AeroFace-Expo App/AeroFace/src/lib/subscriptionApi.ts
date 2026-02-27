// ═══════════════════════════════════════════════════════════════════
//  Subscription API — Public queries for passengers browsing plans
//  Reads active lounge_plans + lounges, with location-based sorting
// ═══════════════════════════════════════════════════════════════════

import { supabase } from './supabase';

// ── Types ─────────────────────────────────────────────────────────

export interface LoungeWithPlans {
    id: string;
    name: string;
    airport_name: string;
    airport_code: string | null;
    terminal: string | null;
    address: string | null;
    latitude: number;
    longitude: number;
    is_active: boolean;
    distance?: number; // km from user
    plans: LoungePlanPublic[];
}

export interface LoungePlanPublic {
    id: string;
    name: string;
    description: string | null;
    price: number;
    currency: string;
    duration_days: number;
    features: string[];
}

// ── Helpers ───────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Cache (simple in-memory) ──────────────────────────────────────
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes
let cachedResult: { data: LoungeWithPlans[]; timestamp: number; key: string } | null = null;

function getCacheKey(lat?: number | null, lng?: number | null, airportCode?: string | null) {
    return `${lat?.toFixed(2) || 'n'}_${lng?.toFixed(2) || 'n'}_${airportCode || 'all'}`;
}

// ── Main Fetch ────────────────────────────────────────────────────

export async function getLoungesWithPlans(options?: {
    latitude?: number | null;
    longitude?: number | null;
    airportCode?: string | null;
}): Promise<LoungeWithPlans[]> {
    const lat = options?.latitude ?? null;
    const lng = options?.longitude ?? null;
    const airportCode = options?.airportCode ?? null;
    const key = getCacheKey(lat, lng, airportCode);

    // Return cached if fresh
    if (cachedResult && cachedResult.key === key && Date.now() - cachedResult.timestamp < CACHE_TTL) {
        console.log('[subscriptionApi] cache HIT');
        return cachedResult.data;
    }

    console.log('[subscriptionApi] fetching lounges+plans');

    // 1. Fetch all active lounges
    let loungeQuery = supabase
        .from('lounges')
        .select('id, name, airport_name, airport_code, terminal, address, latitude, longitude, is_active')
        .eq('is_active', true);

    if (airportCode) {
        loungeQuery = loungeQuery.ilike('airport_code', airportCode);
    }

    const { data: lounges, error: loungeError } = await loungeQuery;
    if (loungeError) {
        console.error('[subscriptionApi] lounges error:', loungeError);
        throw loungeError;
    }

    if (!lounges || lounges.length === 0) return [];

    // 2. Fetch all active plans for those lounges
    const loungeIds = lounges.map(l => l.id);
    const { data: plans, error: planError } = await supabase
        .from('lounge_plans')
        .select('id, lounge_id, name, description, price, currency, duration_days, features')
        .in('lounge_id', loungeIds)
        .eq('is_active', true)
        .order('price', { ascending: true });

    if (planError) {
        console.error('[subscriptionApi] plans error:', planError);
        throw planError;
    }

    // 3. Group plans by lounge
    const plansByLounge = new Map<string, LoungePlanPublic[]>();
    (plans || []).forEach(p => {
        const arr = plansByLounge.get(p.lounge_id) || [];
        arr.push({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            currency: p.currency,
            duration_days: p.duration_days,
            features: p.features || [],
        });
        plansByLounge.set(p.lounge_id, arr);
    });

    // 4. Merge and compute distance
    let result: LoungeWithPlans[] = lounges.map(l => ({
        ...l,
        distance: lat && lng ? haversineKm(lat, lng, l.latitude, l.longitude) : undefined,
        plans: plansByLounge.get(l.id) || [],
    }));

    // 5. Sort: lounges with plans first, then by distance (if user location available)
    result.sort((a, b) => {
        // Plans first
        if (a.plans.length > 0 && b.plans.length === 0) return -1;
        if (a.plans.length === 0 && b.plans.length > 0) return 1;
        // Then by distance
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        return 0;
    });

    // Cache
    cachedResult = { data: result, timestamp: Date.now(), key };
    return result;
}

export function clearSubscriptionCache() {
    cachedResult = null;
}
