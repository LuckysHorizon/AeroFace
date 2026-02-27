-- ═══════════════════════════════════════════════════════════════════
-- 006: Payment Orders + complete_payment RPC
-- Tracks Cashfree payment sessions and automates post-payment
-- membership creation + transaction recording.
-- ═══════════════════════════════════════════════════════════════════

-- ── Payment Orders Table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        TEXT UNIQUE NOT NULL,           -- Cashfree order ID
    cf_session_id   TEXT,                           -- Cashfree payment session ID
    plan_id         UUID NOT NULL REFERENCES lounge_plans(id) ON DELETE RESTRICT,
    lounge_id       UUID NOT NULL REFERENCES lounges(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount          NUMERIC(10,2) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'INR',
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid', 'failed', 'expired')),
    user_email      TEXT,
    user_name       TEXT,
    payment_method  TEXT,                           -- filled post-payment
    cf_payment_id   TEXT,                           -- Cashfree payment ID
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    paid_at         TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_po_user_id   ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_po_lounge_id ON payment_orders(lounge_id);
CREATE INDEX IF NOT EXISTS idx_po_order_id  ON payment_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_po_status    ON payment_orders(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_payment_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_order_updated_at ON payment_orders;
CREATE TRIGGER trg_payment_order_updated_at
    BEFORE UPDATE ON payment_orders
    FOR EACH ROW EXECUTE FUNCTION update_payment_order_updated_at();

-- ── RLS Policies ─────────────────────────────────────────────────
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

-- Users can read their own orders
CREATE POLICY "Users read own orders"
    ON payment_orders FOR SELECT
    USING (auth.uid() = user_id);

-- Lounge owners can read orders for their lounge
CREATE POLICY "Owners read lounge orders"
    ON payment_orders FOR SELECT
    USING (
        lounge_id IN (
            SELECT id FROM lounges WHERE owner_id = auth.uid()
        )
    );

-- Service role (Edge Function) can insert orders
CREATE POLICY "Service can insert orders"
    ON payment_orders FOR INSERT
    WITH CHECK (true);

-- Service role can update orders
CREATE POLICY "Service can update orders"
    ON payment_orders FOR UPDATE
    USING (true)
    WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════════
-- complete_payment RPC
-- Called after Cashfree payment success. In one atomic transaction:
--   1. Verifies the order is pending
--   2. Marks it as paid
--   3. Creates a membership record
--   4. Records a transaction
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION complete_payment(
    p_order_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order   payment_orders%ROWTYPE;
    v_plan    lounge_plans%ROWTYPE;
    v_member  lounge_memberships%ROWTYPE;
    v_tx      lounge_transactions%ROWTYPE;
BEGIN
    -- 1. Lock and fetch the order
    SELECT * INTO v_order
    FROM payment_orders
    WHERE order_id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    IF v_order.status = 'paid' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already completed');
    END IF;

    IF v_order.status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order is ' || v_order.status);
    END IF;

    -- 2. Fetch the plan for duration
    SELECT * INTO v_plan
    FROM lounge_plans
    WHERE id = v_order.plan_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Plan not found');
    END IF;

    -- 3. Mark order as paid
    UPDATE payment_orders
    SET status = 'paid', paid_at = now()
    WHERE id = v_order.id;

    -- 4. Create membership
    INSERT INTO lounge_memberships (
        lounge_id, user_id, user_email, user_name,
        membership_type, status, start_date, end_date
    ) VALUES (
        v_order.lounge_id,
        v_order.user_id,
        v_order.user_email,
        v_order.user_name,
        'standard',
        'active',
        now(),
        now() + (v_plan.duration_days || ' days')::INTERVAL
    )
    RETURNING * INTO v_member;

    -- 5. Record transaction
    INSERT INTO lounge_transactions (
        lounge_id, user_id, membership_id,
        amount, currency, transaction_type,
        description, status, transaction_date
    ) VALUES (
        v_order.lounge_id,
        v_order.user_id,
        v_member.id,
        v_order.amount,
        v_order.currency,
        'membership',
        'Subscription: ' || v_plan.name,
        'completed',
        now()
    )
    RETURNING * INTO v_tx;

    RETURN jsonb_build_object(
        'success', true,
        'membership_id', v_member.id,
        'transaction_id', v_tx.id,
        'plan_name', v_plan.name,
        'end_date', v_member.end_date
    );
END;
$$;
