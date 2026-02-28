// ═══════════════════════════════════════════════════════════════════
//  Lounge Portal API — Supabase queries for lounge owner dashboard
//  All reads are cached & rate-limited via portalCache
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '../../../lib/supabase';
import {
    cachedFetch,
    canWrite,
    markWrite,
    clearPortalCache,
    CK,
} from './portalCache';

// ── Types ─────────────────────────────────────────────────────────

export interface LoungeProfile {
    id: string;
    name: string;
    airport_name: string;
    airport_code: string | null;
    terminal: string | null;
    capacity: number;
    pricing: { currency: string; walk_in: number; member: number };
    description: string | null;
    address: string | null;
    latitude: number;
    longitude: number;
    is_active: boolean;
    owner_id: string;
    created_at: string;
}

export interface Membership {
    id: string;
    lounge_id: string;
    user_id: string;
    plan_id: string | null;
    user_email: string | null;
    user_name: string | null;
    membership_type: 'standard' | 'premium' | 'vip';
    status: 'pending' | 'active' | 'expired' | 'revoked';
    start_date: string;
    end_date: string | null;
    created_at: string;
    updated_at: string;
    plan_name?: string;
}

export interface Transaction {
    id: string;
    lounge_id: string;
    membership_id: string | null;
    user_id: string | null;
    amount: number;
    currency: string;
    transaction_type: 'booking' | 'membership' | 'walk_in' | 'refund';
    description: string | null;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    transaction_date: string;
}

export interface LoungeStats {
    total_revenue: number;
    today_revenue: number;
    month_revenue: number;
    total_members: number;
    active_members: number;
    pending_members: number;
    total_transactions: number;
}

export interface LoungeVisit {
    id: string;
    lounge_id: string;
    user_id: string;
    in_time: string;
    out_time: string | null;
    created_at: string;
    user_name?: string;
    user_email?: string;
}

export interface LoungePlan {
    id: string;
    lounge_id: string;
    name: string;
    description: string | null;
    price: number;
    currency: string;
    duration_days: number;
    features: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// ── Lounge Profile ────────────────────────────────────────────────

export async function getOwnerLounge(): Promise<LoungeProfile | null> {
    return cachedFetch(CK.lounge(), async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('lounges')
            .select('*')
            .eq('owner_id', user.id)
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('[loungeApi] getOwnerLounge error:', error);
            throw error;
        }
        return data;
    });
}

export async function registerLounge(lounge: {
    name: string;
    airport_name: string;
    airport_code: string;
    terminal?: string;
    latitude: number;
    longitude: number;
    address?: string;
    capacity?: number;
    description?: string;
}): Promise<LoungeProfile> {
    if (!canWrite('register-lounge')) throw new Error('Please wait a moment before trying again.');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('lounges')
        .insert({ ...lounge, owner_id: user.id, is_active: true })
        .select()
        .single();

    if (error) {
        console.error('[loungeApi] registerLounge error:', error);
        throw error;
    }

    markWrite('register-lounge', [CK.lounge()]);
    return data;
}

export async function updateLoungeProfile(
    loungeId: string,
    updates: Partial<Pick<LoungeProfile, 'name' | 'airport_name' | 'airport_code' | 'terminal' | 'capacity' | 'pricing' | 'description' | 'is_active'>>
): Promise<LoungeProfile> {
    if (!canWrite('update-lounge')) throw new Error('Please wait a moment before trying again.');

    const { data, error } = await supabase
        .from('lounges')
        .update(updates)
        .eq('id', loungeId)
        .select()
        .single();

    if (error) {
        console.error('[loungeApi] updateLoungeProfile error:', error);
        throw error;
    }

    markWrite('update-lounge', [CK.lounge(), CK.stats(loungeId)]);
    return data;
}

export async function deleteLounge(loungeId: string): Promise<void> {
    if (!canWrite('delete-lounge')) throw new Error('Please wait a moment before trying again.');

    const { error } = await supabase
        .from('lounges')
        .delete()
        .eq('id', loungeId);

    if (error) {
        console.error('[loungeApi] deleteLounge error:', error);
        throw error;
    }

    markWrite('delete-lounge', [CK.lounge()]);
}

// ── Members ───────────────────────────────────────────────────────

export async function getMembers(loungeId: string): Promise<Membership[]> {
    return cachedFetch(CK.members(loungeId), async () => {
        const { data, error } = await supabase
            .from('lounge_memberships')
            .select('*, lounge_plans(name)')
            .eq('lounge_id', loungeId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[loungeApi] getMembers error:', error);
            throw error;
        }
        // Flatten plan name from join
        return (data || []).map((m: any) => ({
            ...m,
            plan_name: m.lounge_plans?.name || null,
            lounge_plans: undefined,
        }));
    });
}

export async function addMember(member: {
    lounge_id: string;
    user_email: string;
    user_name: string;
    membership_type?: 'standard' | 'premium' | 'vip';
    status?: 'pending' | 'active';
    end_date?: string;
}): Promise<Membership> {
    if (!canWrite('add-member')) throw new Error('Please wait a moment before trying again.');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('lounge_memberships')
        .insert({
            lounge_id: member.lounge_id,
            user_id: user.id,
            user_email: member.user_email,
            user_name: member.user_name,
            membership_type: member.membership_type || 'standard',
            status: member.status || 'active',
            end_date: member.end_date || null,
        })
        .select()
        .single();

    if (error) {
        console.error('[loungeApi] addMember error:', error);
        throw error;
    }

    markWrite('add-member', [CK.members(member.lounge_id), CK.stats(member.lounge_id)]);
    return data;
}

export async function updateMemberStatus(
    membershipId: string,
    status: 'active' | 'revoked' | 'expired',
    loungeId?: string
): Promise<void> {
    if (!canWrite('update-member')) throw new Error('Please wait a moment before trying again.');

    const { error } = await supabase
        .from('lounge_memberships')
        .update({ status })
        .eq('id', membershipId);

    if (error) {
        console.error('[loungeApi] updateMemberStatus error:', error);
        throw error;
    }

    const keys = loungeId ? [CK.members(loungeId), CK.stats(loungeId)] : undefined;
    markWrite('update-member', keys);
}

export async function deleteMember(membershipId: string, loungeId?: string): Promise<void> {
    if (!canWrite('delete-member')) throw new Error('Please wait a moment before trying again.');

    const { error } = await supabase
        .from('lounge_memberships')
        .delete()
        .eq('id', membershipId);

    if (error) {
        console.error('[loungeApi] deleteMember error:', error);
        throw error;
    }

    const keys = loungeId ? [CK.members(loungeId), CK.stats(loungeId)] : undefined;
    markWrite('delete-member', keys);
}

// ── Visits ────────────────────────────────────────────────────────

export async function getVisits(loungeId: string): Promise<LoungeVisit[]> {
    return cachedFetch(CK.visits(loungeId), async () => {
        const { data, error } = await supabase
            .from('lounge_visits')
            .select('*')
            .eq('lounge_id', loungeId)
            .order('in_time', { ascending: false })
            .limit(50);

        if (error) {
            console.error('[loungeApi] getVisits error:', error);
            throw error;
        }

        // Fetch members to attach names
        const members = await getMembers(loungeId);

        return (data || []).map((v: any) => {
            const member = members.find(m => m.user_id === v.user_id);
            return {
                ...v,
                user_name: member?.user_name || v.user_name || 'Unknown User',
                user_email: member?.user_email || v.user_email || 'Unknown Email',
            };
        });
    });
}

// ── Transactions / Revenue ────────────────────────────────────────

export type Period = 'today' | 'week' | 'month' | 'all';

export async function getTransactions(loungeId: string, period: Period = 'all'): Promise<Transaction[]> {
    return cachedFetch(CK.transactions(loungeId, period), async () => {
        let query = supabase
            .from('lounge_transactions')
            .select('*')
            .eq('lounge_id', loungeId)
            .order('transaction_date', { ascending: false });

        const now = new Date();
        if (period === 'today') {
            query = query.gte('transaction_date', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());
        } else if (period === 'week') {
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            query = query.gte('transaction_date', weekAgo.toISOString());
        } else if (period === 'month') {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            query = query.gte('transaction_date', monthStart.toISOString());
        }

        const { data, error } = await query;
        if (error) {
            console.error('[loungeApi] getTransactions error:', error);
            throw error;
        }
        return data || [];
    });
}

export async function addTransaction(transaction: {
    lounge_id: string;
    amount: number;
    transaction_type: 'booking' | 'membership' | 'walk_in' | 'refund';
    description?: string;
    currency?: string;
}): Promise<Transaction> {
    if (!canWrite('add-tx')) throw new Error('Please wait a moment before trying again.');

    const { data, error } = await supabase
        .from('lounge_transactions')
        .insert({
            lounge_id: transaction.lounge_id,
            amount: transaction.amount,
            transaction_type: transaction.transaction_type,
            description: transaction.description || null,
            currency: transaction.currency || 'INR',
            status: 'completed',
        })
        .select()
        .single();

    if (error) {
        console.error('[loungeApi] addTransaction error:', error);
        throw error;
    }

    // Invalidate all transaction period caches + stats
    markWrite('add-tx', [
        CK.transactions(transaction.lounge_id, 'today'),
        CK.transactions(transaction.lounge_id, 'week'),
        CK.transactions(transaction.lounge_id, 'month'),
        CK.transactions(transaction.lounge_id, 'all'),
        CK.stats(transaction.lounge_id),
    ]);
    return data;
}

export async function deleteTransaction(transactionId: string, loungeId?: string): Promise<void> {
    if (!canWrite('del-tx')) throw new Error('Please wait a moment before trying again.');

    const { error } = await supabase
        .from('lounge_transactions')
        .delete()
        .eq('id', transactionId);

    if (error) {
        console.error('[loungeApi] deleteTransaction error:', error);
        throw error;
    }

    const keys = loungeId ? [
        CK.transactions(loungeId, 'today'),
        CK.transactions(loungeId, 'week'),
        CK.transactions(loungeId, 'month'),
        CK.transactions(loungeId, 'all'),
        CK.stats(loungeId),
    ] : undefined;
    markWrite('del-tx', keys);
}

// ── Stats (RPC) ───────────────────────────────────────────────────

export async function getLoungeStats(loungeId: string): Promise<LoungeStats> {
    return cachedFetch(CK.stats(loungeId), async () => {
        const { data, error } = await supabase
            .rpc('get_lounge_stats', { p_lounge_id: loungeId });

        if (error) {
            console.error('[loungeApi] getLoungeStats error:', error);
            throw error;
        }
        return data as LoungeStats;
    });
}

// ── Subscription Plans ────────────────────────────────────────────

export async function getPlans(loungeId: string): Promise<LoungePlan[]> {
    return cachedFetch(CK.plans(loungeId), async () => {
        const { data, error } = await supabase
            .from('lounge_plans')
            .select('*')
            .eq('lounge_id', loungeId)
            .order('price', { ascending: true });

        if (error) {
            console.error('[loungeApi] getPlans error:', error);
            throw error;
        }
        return data || [];
    });
}

export async function addPlan(plan: {
    lounge_id: string;
    name: string;
    description?: string;
    price: number;
    duration_days: number;
    features?: string[];
}): Promise<LoungePlan> {
    if (!canWrite('add-plan')) throw new Error('Please wait a moment before trying again.');

    const { data, error } = await supabase
        .from('lounge_plans')
        .insert({
            lounge_id: plan.lounge_id,
            name: plan.name,
            description: plan.description || null,
            price: plan.price,
            currency: 'INR',
            duration_days: plan.duration_days,
            features: plan.features || [],
            is_active: true,
        })
        .select()
        .single();

    if (error) {
        console.error('[loungeApi] addPlan error:', error);
        throw error;
    }

    markWrite('add-plan', [CK.plans(plan.lounge_id)]);
    return data;
}

export async function updatePlan(
    planId: string,
    updates: Partial<Pick<LoungePlan, 'name' | 'description' | 'price' | 'duration_days' | 'features' | 'is_active'>>
): Promise<LoungePlan> {
    if (!canWrite('update-plan')) throw new Error('Please wait a moment before trying again.');

    const { data, error } = await supabase
        .from('lounge_plans')
        .update(updates)
        .eq('id', planId)
        .select()
        .single();

    if (error) {
        console.error('[loungeApi] updatePlan error:', error);
        throw error;
    }

    markWrite('update-plan');
    return data;
}

export async function deletePlan(planId: string): Promise<void> {
    if (!canWrite('del-plan')) throw new Error('Please wait a moment before trying again.');

    const { error } = await supabase
        .from('lounge_plans')
        .delete()
        .eq('id', planId);

    if (error) {
        console.error('[loungeApi] deletePlan error:', error);
        throw error;
    }

    markWrite('del-plan');
}

// ── Manual Cache Invalidation (for pull-to-refresh) ───────────────

export { clearPortalCache, clearAllPortalCache } from './portalCache';
