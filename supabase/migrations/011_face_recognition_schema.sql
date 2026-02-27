-- ═══════════════════════════════════════════════════════════════════
-- 011: AeroFace Recognition Service — Schema Setup
-- Face embeddings + attendance tracking for lounge check-in/out
--
-- Tables created (public schema, used by aeroface-rec Python service):
--   • face_embeddings  — 512D ArcFace vector per user
--   • attendance_log   — Check-in / check-out audit trail
--
-- Dependencies: pgvector extension (for vector(512) type)
-- ═══════════════════════════════════════════════════════════════════


-- ── 1. Enable pgvector extension ──────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;


-- ── 2. Face Embeddings Table ──────────────────────────────────────
-- Stores one 512-dimensional ArcFace embedding per user.
-- The Python service upserts via ON CONFLICT (user_id).
CREATE TABLE IF NOT EXISTS face_embeddings (
    id          SERIAL PRIMARY KEY,
    user_id     VARCHAR(100) UNIQUE NOT NULL,
    embedding   vector(512)        NOT NULL,
    model_name  VARCHAR(50)        DEFAULT 'ArcFace',
    created_at  TIMESTAMP          DEFAULT NOW(),
    updated_at  TIMESTAMP          DEFAULT NOW()
);


-- ── 3. Attendance Log Table ───────────────────────────────────────
-- Each row = one session. check-in creates the row; check-out fills checkout_time.
CREATE TABLE IF NOT EXISTS attendance_log (
    id              SERIAL PRIMARY KEY,
    user_id         VARCHAR(100)  NOT NULL,
    checkin_time    TIMESTAMP     DEFAULT NOW(),
    checkout_time   TIMESTAMP,
    created_at      TIMESTAMP     DEFAULT NOW(),
    CONSTRAINT fk_attendance_user
        FOREIGN KEY (user_id) REFERENCES face_embeddings(user_id) ON DELETE CASCADE
);


-- ── 4. Indexes ────────────────────────────────────────────────────

-- IVFFlat index for cosine similarity search on embeddings
-- Tune 'lists' based on dataset size; run ANALYZE after bulk insert
CREATE INDEX IF NOT EXISTS idx_face_embeddings_vector
    ON face_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Fast lookup: latest check-in for a user
CREATE INDEX IF NOT EXISTS idx_attendance_user_checkin
    ON attendance_log(user_id, checkin_time DESC);

-- Fast lookup: who is currently checked in (checkout_time IS NULL)
CREATE INDEX IF NOT EXISTS idx_attendance_checkout_pending
    ON attendance_log(checkout_time)
    WHERE checkout_time IS NULL;


-- ── 5. Auto-update updated_at trigger ─────────────────────────────
-- Reuse the update_updated_at() function from migration 004 if it exists,
-- otherwise create it.
CREATE OR REPLACE FUNCTION update_face_embeddings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_face_embeddings_update_timestamp ON face_embeddings;
CREATE TRIGGER tr_face_embeddings_update_timestamp
    BEFORE UPDATE ON face_embeddings FOR EACH ROW
    EXECUTE FUNCTION update_face_embeddings_timestamp();


-- ── 6. Row-Level Security ─────────────────────────────────────────
-- The Python service connects with DB credentials (not Supabase anon key),
-- so RLS doesn't block it. These policies protect against anon/public access.

ALTER TABLE face_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_log  ENABLE ROW LEVEL SECURITY;

-- Service role (used by Python backend) gets full access implicitly.
-- Authenticated users can only read their own embedding.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own face embedding') THEN
        CREATE POLICY "Users can view own face embedding"
            ON face_embeddings FOR SELECT TO authenticated
            USING (user_id = auth.uid()::text);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own attendance') THEN
        CREATE POLICY "Users can view own attendance"
            ON attendance_log FOR SELECT TO authenticated
            USING (user_id = auth.uid()::text);
    END IF;
END $$;

-- Allow service_role full CRUD (Supabase grants this by default, but explicit is safer)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role manages face embeddings') THEN
        CREATE POLICY "Service role manages face embeddings"
            ON face_embeddings FOR ALL TO service_role
            USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role manages attendance') THEN
        CREATE POLICY "Service role manages attendance"
            ON attendance_log FOR ALL TO service_role
            USING (true) WITH CHECK (true);
    END IF;
END $$;


-- ── 7. Helper: Get active checkins (who is in the lounge now) ─────
CREATE OR REPLACE FUNCTION get_active_checkins()
RETURNS TABLE (
    user_id     VARCHAR(100),
    checkin_time TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT al.user_id, al.checkin_time
    FROM attendance_log al
    WHERE al.checkout_time IS NULL
      AND al.checkin_time >= CURRENT_DATE
    ORDER BY al.checkin_time DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ── 8. Helper: Get attendance summary for a date range ────────────
CREATE OR REPLACE FUNCTION get_attendance_summary(
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date   DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    session_user_id  VARCHAR(100),
    session_date     DATE,
    total_checkins   BIGINT,
    avg_duration_hrs NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        al.user_id            AS session_user_id,
        DATE(al.checkin_time) AS session_date,
        COUNT(*)              AS total_checkins,
        ROUND(AVG(
            EXTRACT(EPOCH FROM (COALESCE(al.checkout_time, NOW()) - al.checkin_time)) / 3600
        )::numeric, 2)       AS avg_duration_hrs
    FROM attendance_log al
    WHERE DATE(al.checkin_time) BETWEEN p_start_date AND p_end_date
    GROUP BY al.user_id, DATE(al.checkin_time)
    ORDER BY session_date DESC, total_checkins DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════
-- End of migration 011
-- ═══════════════════════════════════════════════════════════════════
