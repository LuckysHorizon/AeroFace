-- ═══════════════════════════════════════════════════════════════════
-- 012: Add lounge_id mapping to face_embeddings
-- Maps each face embedding to the lounge the user subscribed to
-- ═══════════════════════════════════════════════════════════════════

-- Add lounge_id column (nullable — old registrations may not have one)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'face_embeddings' AND column_name = 'lounge_id'
    ) THEN
        ALTER TABLE face_embeddings ADD COLUMN lounge_id UUID;
    END IF;
END $$;

-- Optional FK to lounges table (won't fail if lounges table doesn't exist)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lounges') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_face_embeddings_lounge'
        ) THEN
            ALTER TABLE face_embeddings
                ADD CONSTRAINT fk_face_embeddings_lounge
                FOREIGN KEY (lounge_id) REFERENCES lounges(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Index for looking up embeddings by lounge
CREATE INDEX IF NOT EXISTS idx_face_embeddings_lounge
    ON face_embeddings(lounge_id)
    WHERE lounge_id IS NOT NULL;
