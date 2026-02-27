-- ═══════════════════════════════════════════════════════════════════
-- 010: Add missing DELETE + UPDATE RLS policies for lounge_transactions
-- Without these, owners can read/insert but NOT delete/update transactions.
-- Also add DELETE policy for lounge_memberships (service-role inserts).
-- ═══════════════════════════════════════════════════════════════════

-- Owners can UPDATE their own lounge transactions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners update transactions for their lounges') THEN
    CREATE POLICY "Owners update transactions for their lounges"
      ON lounge_transactions FOR UPDATE TO authenticated
      USING (lounge_id IN (SELECT id FROM lounges WHERE owner_id = auth.uid()))
      WITH CHECK (lounge_id IN (SELECT id FROM lounges WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- Owners can DELETE their own lounge transactions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners delete transactions for their lounges') THEN
    CREATE POLICY "Owners delete transactions for their lounges"
      ON lounge_transactions FOR DELETE TO authenticated
      USING (lounge_id IN (SELECT id FROM lounges WHERE owner_id = auth.uid()));
  END IF;
END $$;
