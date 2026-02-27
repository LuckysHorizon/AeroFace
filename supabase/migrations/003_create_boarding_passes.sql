-- ═══════════════════════════════════════════════════════════════════
--  003 — Boarding Passes Table
--  Stores OCR-extracted data from scanned boarding passes
-- ═══════════════════════════════════════════════════════════════════

-- Create boarding_passes table
CREATE TABLE IF NOT EXISTS boarding_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Extracted passenger & flight info
  passenger_name TEXT,
  flight_number TEXT,
  airline TEXT,
  departure_airport_code TEXT,        -- IATA code e.g. "HYD"
  departure_airport_name TEXT,        -- Full name e.g. "Rajiv Gandhi Intl"
  arrival_airport_code TEXT,          -- IATA code e.g. "DEL"
  arrival_airport_name TEXT,
  departure_date DATE,
  departure_time TEXT,
  boarding_time TEXT,
  gate TEXT,
  seat TEXT,
  booking_reference TEXT,             -- PNR / confirmation code
  travel_class TEXT,                  -- Economy / Business / First
  sequence_number TEXT,               -- Boarding sequence

  -- Image & extraction metadata
  image_url TEXT,                     -- Supabase Storage path
  raw_extracted_text TEXT,            -- Full OCR output for debugging
  extraction_confidence FLOAT DEFAULT 0,
  status TEXT DEFAULT 'processed'
    CHECK (status IN ('processing', 'processed', 'failed')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────
CREATE INDEX idx_bp_user_id ON boarding_passes(user_id);
CREATE INDEX idx_bp_departure_airport ON boarding_passes(departure_airport_code);
CREATE INDEX idx_bp_departure_date ON boarding_passes(departure_date);
CREATE INDEX idx_bp_flight ON boarding_passes(flight_number);
CREATE INDEX idx_bp_status ON boarding_passes(status);

-- ── Row Level Security ─────────────────────────────────────────
ALTER TABLE boarding_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own boarding passes"
  ON boarding_passes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own boarding passes"
  ON boarding_passes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own boarding passes"
  ON boarding_passes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own boarding passes"
  ON boarding_passes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ── Trigger: auto-update updated_at ────────────────────────────
CREATE TRIGGER tr_bp_update_timestamp
  BEFORE UPDATE ON boarding_passes FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ── Storage bucket for boarding pass images ────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('boarding-passes', 'boarding-passes', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can upload to their own folder
CREATE POLICY "Users upload own boarding pass images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'boarding-passes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: users can read their own images
CREATE POLICY "Users read own boarding pass images"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'boarding-passes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: users can delete their own images
CREATE POLICY "Users delete own boarding pass images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'boarding-passes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
