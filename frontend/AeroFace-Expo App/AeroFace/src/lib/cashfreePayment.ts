// ═══════════════════════════════════════════════════════════════════
//  Cashfree Payment Client Module
//  Handles order creation (via Edge Function) and payment completion
// ═══════════════════════════════════════════════════════════════════

import { supabase } from './supabase';
import Constants from 'expo-constants';

const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl as string;

// ── Types ─────────────────────────────────────────────────────────

export interface CreateOrderResponse {
    orderId: string;
    sessionId: string;
    paymentUrl: string;
    amount: number;
    currency: string;
    planName: string;
}

export interface PaymentResult {
    success: boolean;
    membership_id?: string;
    transaction_id?: string;
    plan_name?: string;
    lounge_id?: string;
    end_date?: string;
    error?: string;
    message?: string;
}

export interface PaymentOrder {
    id: string;
    order_id: string;
    plan_id: string;
    lounge_id: string;
    amount: number;
    currency: string;
    status: 'pending' | 'paid' | 'failed' | 'expired';
    created_at: string;
    paid_at: string | null;
}

// ── Create Order (calls Edge Function) ────────────────────────────

export async function createPaymentOrder(
    planId: string,
    loungeId: string,
): Promise<CreateOrderResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated. Please log in.');

    console.log('[cashfreePayment] Creating order for plan:', planId, 'lounge:', loungeId);

    // Use direct fetch instead of supabase.functions.invoke
    // because the SDK swallows response bodies on non-2xx errors
    const functionUrl = `${SUPABASE_URL}/functions/v1/create-order`;
    console.log('[cashfreePayment] Calling:', functionUrl);

    const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': session.access_token,
        },
        body: JSON.stringify({ planId, loungeId }),
    });

    const responseText = await response.text();
    console.log('[cashfreePayment] Response status:', response.status, 'body:', responseText.substring(0, 500));

    let data: any;
    try {
        data = JSON.parse(responseText);
    } catch {
        throw new Error(`Server returned invalid response: ${responseText.substring(0, 200)}`);
    }

    if (!response.ok) {
        const errorMsg = data?.error || data?.message || data?.details || `Server error (${response.status})`;
        console.error('[cashfreePayment] Server error:', errorMsg);
        throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    }

    if (data?.error) {
        throw new Error(data.error);
    }

    console.log('[cashfreePayment] Order created:', data?.orderId);
    return data as CreateOrderResponse;
}

// ── Complete Payment (calls DB RPC) ───────────────────────────────

export async function completePayment(orderId: string): Promise<PaymentResult> {
    const { data, error } = await supabase.rpc('complete_payment', {
        p_order_id: orderId,
    });

    if (error) {
        console.error('[cashfreePayment] completePayment error:', error);
        throw new Error(error.message || 'Failed to complete payment');
    }

    return data as PaymentResult;
}

// ── Mark Order Failed ─────────────────────────────────────────────

export async function markOrderFailed(orderId: string): Promise<void> {
    const { error } = await supabase
        .from('payment_orders')
        .update({ status: 'failed' })
        .eq('order_id', orderId);

    if (error) {
        console.error('[cashfreePayment] markOrderFailed error:', error);
    }
}

// ── Fetch User's Payment History ──────────────────────────────────

export async function getMyOrders(): Promise<PaymentOrder[]> {
    const { data, error } = await supabase
        .from('payment_orders')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[cashfreePayment] getMyOrders error:', error);
        throw error;
    }

    return data || [];
}
