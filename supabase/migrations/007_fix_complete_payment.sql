-- ═══════════════════════════════════════════════════════════════════
-- 007: Fix complete_payment RPC — handle existing memberships
-- If user already has a membership, extend/renew it instead of
-- crashing on duplicate key constraint.
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
    v_member_id UUID;
    v_end_date  TIMESTAMPTZ;
    v_tx      lounge_transactions%ROWTYPE;
    v_existing_member lounge_memberships%ROWTYPE;
BEGIN
    -- 1. Lock and fetch the order
    SELECT * INTO v_order
    FROM payment_orders
    WHERE order_id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- Already paid — return success (idempotent)
    IF v_order.status = 'paid' THEN
        -- Fetch existing membership info for the response
        SELECT * INTO v_existing_member
        FROM lounge_memberships
        WHERE lounge_id = v_order.lounge_id AND user_id = v_order.user_id
        ORDER BY end_date DESC LIMIT 1;

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Already completed',
            'membership_id', v_existing_member.id,
            'plan_name', (SELECT name FROM lounge_plans WHERE id = v_order.plan_id),
            'end_date', v_existing_member.end_date
        );
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

    -- 4. Create or extend membership
    -- Check if user already has a membership for this lounge
    SELECT * INTO v_existing_member
    FROM lounge_memberships
    WHERE lounge_id = v_order.lounge_id AND user_id = v_order.user_id;

    IF FOUND THEN
        -- Extend existing membership
        -- If currently active, extend from end_date; otherwise from now
        IF v_existing_member.end_date > now() THEN
            v_end_date := v_existing_member.end_date + (v_plan.duration_days || ' days')::INTERVAL;
        ELSE
            v_end_date := now() + (v_plan.duration_days || ' days')::INTERVAL;
        END IF;

        UPDATE lounge_memberships
        SET status = 'active',
            end_date = v_end_date,
            user_email = COALESCE(v_order.user_email, user_email),
            user_name = COALESCE(v_order.user_name, user_name),
            updated_at = now()
        WHERE id = v_existing_member.id;

        v_member_id := v_existing_member.id;
    ELSE
        -- Create new membership
        v_end_date := now() + (v_plan.duration_days || ' days')::INTERVAL;

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
            v_end_date
        )
        RETURNING id INTO v_member_id;
    END IF;

    -- 5. Record transaction
    INSERT INTO lounge_transactions (
        lounge_id, user_id, membership_id,
        amount, currency, transaction_type,
        description, status, transaction_date
    ) VALUES (
        v_order.lounge_id,
        v_order.user_id,
        v_member_id,
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
        'membership_id', v_member_id,
        'transaction_id', v_tx.id,
        'plan_name', v_plan.name,
        'end_date', v_end_date
    );
END;
$$;
