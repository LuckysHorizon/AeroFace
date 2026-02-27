-- ═══════════════════════════════════════════════════════════════════
--  004 — Lounge Portal Schema
--  Adds ownership, memberships, and transaction tracking for lounge owners
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Add owner_id to lounges ────────────────────────────────────
ALTER TABLE lounges
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS airport_code TEXT,
  ADD COLUMN IF NOT EXISTS terminal TEXT,
  ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS pricing JSONB DEFAULT '{"currency":"INR","walk_in":1500,"member":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_lounges_owner_id ON lounges(owner_id);

-- ── 2. Lounge Memberships ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lounge_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lounge_id UUID NOT NULL REFERENCES lounges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  user_name TEXT,

  membership_type TEXT DEFAULT 'standard'
    CHECK (membership_type IN ('standard', 'premium', 'vip')),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'revoked')),

  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(lounge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lm_lounge_id ON lounge_memberships(lounge_id);
CREATE INDEX IF NOT EXISTS idx_lm_user_id ON lounge_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_lm_status ON lounge_memberships(status);

-- ── 3. Lounge Transactions (Revenue) ──────────────────────────────
CREATE TABLE IF NOT EXISTS lounge_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lounge_id UUID NOT NULL REFERENCES lounges(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES lounge_memberships(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  transaction_type TEXT DEFAULT 'booking'
    CHECK (transaction_type IN ('booking', 'membership', 'walk_in', 'refund')),
  description TEXT,
  status TEXT DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),

  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lt_lounge_id ON lounge_transactions(lounge_id);
CREATE INDEX IF NOT EXISTS idx_lt_transaction_date ON lounge_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_lt_type ON lounge_transactions(transaction_type);

-- ── 4. RLS Policies ───────────────────────────────────────────────

ALTER TABLE lounge_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE lounge_transactions ENABLE ROW LEVEL SECURITY;

-- Lounge owners can manage their own lounges
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can update their lounges') THEN
    CREATE POLICY "Owners can update their lounges" ON lounges FOR UPDATE TO authenticated USING (owner_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can insert lounges') THEN
    CREATE POLICY "Owners can insert lounges" ON lounges FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

-- Membership policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners read memberships for their lounges') THEN
    CREATE POLICY "Owners read memberships for their lounges" ON lounge_memberships FOR SELECT TO authenticated
      USING (lounge_id IN (SELECT id FROM lounges WHERE owner_id = auth.uid()) OR user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners manage memberships for their lounges') THEN
    CREATE POLICY "Owners manage memberships for their lounges" ON lounge_memberships FOR INSERT TO authenticated
      WITH CHECK (lounge_id IN (SELECT id FROM lounges WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners update memberships for their lounges') THEN
    CREATE POLICY "Owners update memberships for their lounges" ON lounge_memberships FOR UPDATE TO authenticated
      USING (lounge_id IN (SELECT id FROM lounges WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners delete memberships for their lounges') THEN
    CREATE POLICY "Owners delete memberships for their lounges" ON lounge_memberships FOR DELETE TO authenticated
      USING (lounge_id IN (SELECT id FROM lounges WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- Transaction policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners read transactions for their lounges') THEN
    CREATE POLICY "Owners read transactions for their lounges" ON lounge_transactions FOR SELECT TO authenticated
      USING (lounge_id IN (SELECT id FROM lounges WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners insert transactions for their lounges') THEN
    CREATE POLICY "Owners insert transactions for their lounges" ON lounge_transactions FOR INSERT TO authenticated
      WITH CHECK (lounge_id IN (SELECT id FROM lounges WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- ── 5. Triggers ───────────────────────────────────────────────────

DROP TRIGGER IF EXISTS tr_memberships_update_timestamp ON lounge_memberships;
CREATE TRIGGER tr_memberships_update_timestamp
  BEFORE UPDATE ON lounge_memberships FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ── 6. Stats RPC Function ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_lounge_stats(p_lounge_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_revenue', COALESCE((
      SELECT SUM(amount) FROM lounge_transactions
      WHERE lounge_id = p_lounge_id AND status = 'completed'
    ), 0),
    'today_revenue', COALESCE((
      SELECT SUM(amount) FROM lounge_transactions
      WHERE lounge_id = p_lounge_id
        AND status = 'completed'
        AND transaction_date >= CURRENT_DATE
    ), 0),
    'month_revenue', COALESCE((
      SELECT SUM(amount) FROM lounge_transactions
      WHERE lounge_id = p_lounge_id
        AND status = 'completed'
        AND transaction_date >= date_trunc('month', CURRENT_DATE)
    ), 0),
    'total_members', (
      SELECT COUNT(*) FROM lounge_memberships
      WHERE lounge_id = p_lounge_id
    ),
    'active_members', (
      SELECT COUNT(*) FROM lounge_memberships
      WHERE lounge_id = p_lounge_id AND status = 'active'
    ),
    'pending_members', (
      SELECT COUNT(*) FROM lounge_memberships
      WHERE lounge_id = p_lounge_id AND status = 'pending'
    ),
    'total_transactions', (
      SELECT COUNT(*) FROM lounge_transactions
      WHERE lounge_id = p_lounge_id AND status = 'completed'
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
