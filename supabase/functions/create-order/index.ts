// @ts-nocheck
// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// ═══════════════════════════════════════════════════════════════════
//  AeroFace — create-order Edge Function
//
//  Creates a Cashfree payment order securely (API keys server-side).
//  POST { planId, loungeId } → { orderId, sessionId, paymentUrl }
// ═══════════════════════════════════════════════════════════════════

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: any, status: number): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

console.log("[create-order] Edge Function initialized");

serve(async (req: Request) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
        // ── Environment ───────────────────────────────────────────
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
        const cashfreeAppId = Deno.env.get("CASHFREE_APP_ID") || "";
        const cashfreeSecretKey = Deno.env.get("CASHFREE_SECRET_KEY") || "";
        const cashfreeEnv = Deno.env.get("CASHFREE_ENV") || "sandbox";

        console.log("[create-order] ENV check — url:", !!supabaseUrl, "srvKey:", !!supabaseServiceKey, "anonKey:", !!supabaseAnonKey, "cfApp:", !!cashfreeAppId, "cfSecret:", !!cashfreeSecretKey);

        if (!cashfreeAppId || !cashfreeSecretKey) {
            console.error("[create-order] Missing Cashfree credentials");
            return jsonResponse({ error: "Payment service not configured" }, 503);
        }

        // ── Auth — extract user from JWT ─────────────────────────
        const authHeader = req.headers.get("Authorization") || "";
        console.log("[create-order] Auth header present:", !!authHeader, "starts with Bearer:", authHeader.startsWith("Bearer "));

        // Create a service-role client for DB operations
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Extract user from the JWT token
        let user = null;
        if (authHeader) {
            const token = authHeader.replace("Bearer ", "");
            const { data, error: userError } = await supabase.auth.getUser(token);
            if (userError) {
                console.error("[create-order] JWT verify error:", userError.message);
            } else {
                user = data?.user;
                console.log("[create-order] User verified:", user?.id);
            }
        }

        if (!user) {
            console.error("[create-order] No valid user found");
            return jsonResponse({ error: "Unauthorized — please log in" }, 401);
        }

        // ── Parse Request ─────────────────────────────────────────
        let planId = "";
        let loungeId = "";
        try {
            const body = await req.json();
            planId = body?.planId || "";
            loungeId = body?.loungeId || "";
        } catch (_) {
            return jsonResponse({ error: "Invalid JSON body" }, 400);
        }

        if (!planId || !loungeId) {
            return jsonResponse({ error: "planId and loungeId are required" }, 400);
        }

        console.log("[create-order] Plan:", planId, "Lounge:", loungeId);

        // ── Validate Plan ─────────────────────────────────────────
        const { data: plan, error: planError } = await supabase
            .from("lounge_plans")
            .select("id, name, price, currency, duration_days, is_active, lounge_id")
            .eq("id", planId)
            .eq("lounge_id", loungeId)
            .single();

        if (planError || !plan) {
            console.error("[create-order] Plan not found:", planError?.message);
            return jsonResponse({ error: "Plan not found" }, 404);
        }

        if (!plan.is_active) {
            return jsonResponse({ error: "This plan is currently inactive" }, 400);
        }

        console.log("[create-order] Plan validated:", plan.name, "₹" + plan.price);

        // ── Create Cashfree Order ─────────────────────────────────
        const orderId = "AF_" + Date.now() + "_" + user.id.substring(0, 8);
        const amount = Number(plan.price);
        const currency = plan.currency || "INR";

        const cashfreeBaseUrl = cashfreeEnv === "production"
            ? "https://api.cashfree.com"
            : "https://sandbox.cashfree.com";

        const customerEmail = user.email || "customer@aeroface.app";
        const customerName = user.user_metadata?.name || user.email?.split("@")[0] || "AeroFace User";
        const customerPhone = user.phone || "9999999999";

        console.log("[create-order] Calling Cashfree:", cashfreeBaseUrl, "orderId:", orderId, "amount:", amount);

        const cfPayload = {
            order_id: orderId,
            order_amount: amount,
            order_currency: currency,
            customer_details: {
                customer_id: user.id.replace(/-/g, "").substring(0, 50),
                customer_email: customerEmail,
                customer_phone: customerPhone,
                customer_name: customerName,
            },
            order_meta: {
                return_url: "https://aeroface.app/payment/success?order_id=" + orderId,
            },
            order_note: plan.name + " subscription",
        };

        const cfResponse = await fetch(cashfreeBaseUrl + "/pg/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-client-id": cashfreeAppId,
                "x-client-secret": cashfreeSecretKey,
                "x-api-version": "2023-08-01",
            },
            body: JSON.stringify(cfPayload),
        });

        const cfText = await cfResponse.text();
        console.log("[create-order] Cashfree response status:", cfResponse.status, "body:", cfText.substring(0, 500));

        let cfData;
        try {
            cfData = JSON.parse(cfText);
        } catch (_) {
            console.error("[create-order] Cashfree returned non-JSON:", cfText.substring(0, 200));
            return jsonResponse({ error: "Payment gateway returned invalid response" }, 502);
        }

        if (!cfResponse.ok || !cfData.payment_session_id) {
            console.error("[create-order] Cashfree error:", JSON.stringify(cfData));
            return jsonResponse({
                error: "Failed to create payment order",
                details: cfData.message || cfData.type || "Unknown Cashfree error",
            }, 500);
        }

        console.log("[create-order] Cashfree order created:", cfData.cf_order_id);

        // ── Save Order in DB ──────────────────────────────────────
        const { error: insertError } = await supabase
            .from("payment_orders")
            .insert({
                order_id: orderId,
                cf_session_id: cfData.payment_session_id,
                plan_id: planId,
                lounge_id: loungeId,
                user_id: user.id,
                amount: amount,
                currency: currency,
                status: "pending",
                user_email: customerEmail,
                user_name: customerName,
            });

        if (insertError) {
            console.error("[create-order] DB insert error:", insertError.message);
            return jsonResponse({ error: "Failed to save order: " + insertError.message }, 500);
        }

        console.log("[create-order] ✅ Order saved to DB");

        // ── Build payment URL ─────────────────────────────────────
        const paymentUrl = cashfreeEnv === "production"
            ? "https://payments.cashfree.com/order/#" + cfData.payment_session_id
            : "https://sandbox.cashfree.com/pg/orders/pay/" + cfData.payment_session_id;

        return jsonResponse({
            orderId: orderId,
            sessionId: cfData.payment_session_id,
            paymentUrl: paymentUrl,
            amount: amount,
            currency: currency,
            planName: plan.name,
        }, 200);

    } catch (error: any) {
        console.error("[create-order] Unexpected error:", error?.message || error);
        return jsonResponse({ error: "Internal server error: " + (error?.message || "unknown") }, 500);
    }
});
