-- ============================================================
-- BURN BOARD — FRIEND CHALLENGE SYSTEM
-- Additive-only migration. No existing tables modified.
-- ============================================================

-- ============================================================
-- FRIEND CHALLENGES TABLE
-- Works with both authenticated and anonymous users
-- Uses unique public tokens for shareable challenge links
-- ============================================================

CREATE TABLE IF NOT EXISTS friend_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Unique public token for shareable links (hard to guess)
  public_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  
  -- Challenger identity (either user_id or anon_id)
  challenger_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  challenger_anon_id TEXT,
  challenger_display_name TEXT DEFAULT 'Someone',
  
  -- Optional source references
  source_hot_seat_id UUID REFERENCES hot_seats(id) ON DELETE SET NULL,
  source_burn_score INT,
  
  -- Challenge status lifecycle
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active',      -- Challenge can be accepted
    'accepted',    -- A participant has accepted
    'completed',   -- Challenged participant created a Hot Seat
    'expired',     -- Challenge expired (optional)
    'cancelled'    -- Challenge cancelled/invalid
  )),
  
  -- Attribution tracking
  accepted_by_anon_id TEXT,
  accepted_hot_seat_id UUID REFERENCES hot_seats(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_friend_challenges_token ON friend_challenges(public_token);
CREATE INDEX IF NOT EXISTS idx_friend_challenges_challenger ON friend_challenges(challenger_user_id) WHERE challenger_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_friend_challenges_challenger_anon ON friend_challenges(challenger_anon_id) WHERE challenger_anon_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_friend_challenges_status ON friend_challenges(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friend_challenges_source_hot_seat ON friend_challenges(source_hot_seat_id) WHERE source_hot_seat_id IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE friend_challenges ENABLE ROW LEVEL SECURITY;

-- Public read for active challenges (needed for challenge landing page)
DO $$ BEGIN
  CREATE POLICY "friend_challenges_select_active" ON friend_challenges
    FOR SELECT USING (status = 'active' OR status = 'accepted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Challengers can create challenges
DO $$ BEGIN
  CREATE POLICY "friend_challenges_insert" ON friend_challenges
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Challengers and accepted users can update their challenges
DO $$ BEGIN
  CREATE POLICY "friend_challenges_update" ON friend_challenges
    FOR UPDATE USING (
      auth.uid() = challenger_user_id 
      OR auth.uid() IS NULL  -- Allow anonymous updates
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_friend_challenges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_friend_challenges_updated_at ON friend_challenges;
CREATE TRIGGER update_friend_challenges_updated_at
  BEFORE UPDATE ON friend_challenges
  FOR EACH ROW EXECUTE FUNCTION update_friend_challenges_updated_at();

-- ============================================================
-- REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE friend_challenges;

-- ============================================================
-- DONE — Friend Challenges table created
-- ============================================================
