-- ═══════════════════════════════════════════════════════════════════
--  005 — Lounge Subscription Plans
--  Enables lounge owners to create and manage pricing plans
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lounge_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lounge_id UUID NOT NULL REFERENCES lounges(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  duration_days INTEGER NOT NULL DEFAULT 30,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each plan name must be unique per lounge
  UNIQUE(lounge_id, name)
);

CREATE INDEX IF NOT EXISTS idx_lp_lounge_id ON lounge_plans(lounge_id);
CREATE INDEX IF NOT EXISTS idx_lp_active ON lounge_plans(is_active);

-- RLS
ALTER TABLE lounge_plans ENABLE ROW LEVEL SECURITY;

-- Anyone can read active plans (passengers browsing)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can read active plans') THEN
    CREATE POLICY "Public can read active plans"
      ON lounge_plans FOR SELECT TO public
      USING (is_active = true);
  END IF;
END $$;

-- Owners CRUD their own plans
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners read all their plans') THEN
    CREATE POLICY "Owners read all their plans"
      ON lounge_plans FOR SELECT TO authenticated
      USING (lounge_id IN (SELECT id FROM lounges WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners insert plans') THEN
    CREATE POLICY "Owners insert plans"
      ON lounge_plans FOR INSERT TO authenticated
      WITH CHECK (lounge_id IN (SELECT id FROM lounges WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners update plans') THEN
    CREATE POLICY "Owners update plans"
      ON lounge_plans FOR UPDATE TO authenticated
      USING (lounge_id IN (SELECT id FROM lounges WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners delete plans') THEN
    CREATE POLICY "Owners delete plans"
      ON lounge_plans FOR DELETE TO authenticated
      USING (lounge_id IN (SELECT id FROM lounges WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- Trigger
DROP TRIGGER IF EXISTS tr_plans_update_timestamp ON lounge_plans;
CREATE TRIGGER tr_plans_update_timestamp
  BEFORE UPDATE ON lounge_plans FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
