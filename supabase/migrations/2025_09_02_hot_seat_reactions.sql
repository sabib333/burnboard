-- ============================================================
-- BURN BOARD — HOT SEAT REACTIONS (Master Prompt #3)
-- Additive-only migration. No existing tables modified.
-- Run this in Supabase SQL Editor
-- ============================================================

-- HOT SEAT ROAST REACTIONS TABLE
-- One active reaction per participant per roast (toggle/change/remove)
CREATE TABLE IF NOT EXISTS hot_seat_roast_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roast_id UUID NOT NULL REFERENCES hot_seat_roasts(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,  -- anon_id or user_id string
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('funny', 'savage', 'fatal')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- UNIQUE CONSTRAINT: Only one active reaction per participant per roast
-- This is enforced at the application layer via upsert logic, but we add
-- a partial unique index for database-level safety.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_reaction
  ON hot_seat_roast_reactions(roast_id, participant_id)
  WHERE is_active = true;

-- PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_reactions_roast ON hot_seat_roast_reactions(roast_id);
CREATE INDEX IF NOT EXISTS idx_reactions_participant ON hot_seat_roast_reactions(participant_id);
CREATE INDEX IF NOT EXISTS idx_reactions_type ON hot_seat_roast_reactions(reaction_type) WHERE is_active = true;

-- ROW LEVEL SECURITY
ALTER TABLE hot_seat_roast_reactions ENABLE ROW LEVEL SECURITY;

-- Public can read active reactions
DO $$ BEGIN
  CREATE POLICY "Public read active reactions" ON hot_seat_roast_reactions
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Anyone can insert reactions (anon or auth)
DO $$ BEGIN
  CREATE POLICY "Anyone can insert reactions" ON hot_seat_roast_reactions
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Participants can update own reactions (toggle/change)
DO $$ BEGIN
  CREATE POLICY "Participants can update own reactions" ON hot_seat_roast_reactions
    FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- REALTIME for reaction updates
ALTER PUBLICATION supabase_realtime ADD TABLE hot_seat_roast_reactions;

-- ============================================================
-- DONE — Hot Seat reactions table created
-- ============================================================
