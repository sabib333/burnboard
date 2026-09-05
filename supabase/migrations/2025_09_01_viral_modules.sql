-- ============================================================
-- BURN BOARD V2.1 — VIRAL MODULES (Phases 1-10)
-- Additive-only migration. No existing tables modified.
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PHASE 2: HOT SEAT
-- ============================================================
-- Add hot seat columns to existing profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hot_seat_token TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hot_seat_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hot_seat_share_count INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_hot_seat_token ON profiles(hot_seat_token) WHERE hot_seat_token IS NOT NULL;

-- ============================================================
-- PHASE 4: BURN SCORE
-- ============================================================
-- Add burn score to user_karma
ALTER TABLE user_karma ADD COLUMN IF NOT EXISTS burn_score INT DEFAULT 0;
ALTER TABLE user_karma ADD COLUMN IF NOT EXISTS total_reactions_received INT DEFAULT 0;
ALTER TABLE user_karma ADD COLUMN IF NOT EXISTS total_battles_won INT DEFAULT 0;
ALTER TABLE user_karma ADD COLUMN IF NOT EXISTS total_challenges_completed INT DEFAULT 0;

-- RPC: Increment burn score atomically
CREATE OR REPLACE FUNCTION increment_burn_score(
  p_user_id UUID,
  p_score_delta INT DEFAULT 0,
  p_reactions_delta INT DEFAULT 0,
  p_battles_won_delta INT DEFAULT 0,
  p_challenges_delta INT DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  UPDATE user_karma SET
    burn_score = burn_score + p_score_delta,
    total_reactions_received = total_reactions_received + p_reactions_delta,
    total_battles_won = total_battles_won + p_battles_won_delta,
    total_challenges_completed = total_challenges_completed + p_challenges_delta
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PHASE 6: FRIEND CHALLENGES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  challenged_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  challenger_score INT DEFAULT 0,
  challenged_score INT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','completed','expired','declined')),
  challenge_type TEXT DEFAULT 'roast_battle' CHECK (challenge_type IN ('roast_battle','most_roasts','most_upvotes','karma_race')),
  description TEXT,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own challenges" ON user_challenges
    FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users create challenges" ON user_challenges
    FOR INSERT WITH CHECK (auth.uid() = challenger_id);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users update own challenges" ON user_challenges
    FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON user_challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged ON user_challenges(challenged_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON user_challenges(status, created_at DESC);

-- ============================================================
-- PHASE 7: ENHANCED BATTLES (Rounds + History)
-- ============================================================
CREATE TABLE IF NOT EXISTS battle_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID REFERENCES battles(id) ON DELETE CASCADE,
  round_number INT NOT NULL DEFAULT 1,
  profile1_roast_id UUID REFERENCES roasts(id) ON DELETE SET NULL,
  profile2_roast_id UUID REFERENCES roasts(id) ON DELETE SET NULL,
  votes1 INT DEFAULT 0,
  votes2 INT DEFAULT 0,
  winner INT CHECK (winner IN (1, 2)),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE battle_rounds ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public read battle rounds" ON battle_rounds FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY "Insert battle rounds" ON battle_rounds FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY "Update battle rounds" ON battle_rounds FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_battle_rounds_battle ON battle_rounds(battle_id);

CREATE TABLE IF NOT EXISTS battle_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID REFERENCES battles(id) ON DELETE CASCADE,
  profile1_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  profile2_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  winner_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  total_votes1 INT DEFAULT 0,
  total_votes2 INT DEFAULT 0,
  round_count INT DEFAULT 1,
  completed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE battle_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public read battle history" ON battle_history FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY "Insert battle history" ON battle_history FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_battle_history_completed ON battle_history(completed_at DESC);

-- ============================================================
-- PHASE 9: LEADERBOARD SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  burn_score INT DEFAULT 0,
  total_upvotes INT DEFAULT 0,
  total_roasts INT DEFAULT 0,
  level TEXT DEFAULT 'Newbie',
  category TEXT DEFAULT 'alltime' CHECK (category IN ('alltime','weekly','daily','monthly')),
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public read leaderboard snapshots" ON leaderboard_snapshots FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY "Insert leaderboard snapshots" ON leaderboard_snapshots FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_leaderboard_category ON leaderboard_snapshots(category, burn_score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_date ON leaderboard_snapshots(snapshot_date, category);

-- ============================================================
-- PHASE 10: MODERATION (User Blocks + Auto Rules)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own blocks" ON user_blocks
    FOR SELECT USING (auth.uid() = blocker_id);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users block" ON user_blocks
    FOR INSERT WITH CHECK (auth.uid() = blocker_id);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users unblock" ON user_blocks
    FOR DELETE USING (auth.uid() = blocker_id);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

-- Moderation rules (auto-filter configuration)
CREATE TABLE IF NOT EXISTS moderation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('word_filter','rate_limit_escalation','auto_hide','shadowban')),
  pattern TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'flag',
  severity INT DEFAULT 1,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE moderation_rules ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admin read rules" ON moderation_rules FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY "Admin insert rules" ON moderation_rules FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Auto-hide threshold: roast reported 3+ times → auto-hide
CREATE OR REPLACE FUNCTION auto_hide_roast()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT count(*) FROM reports WHERE roast_id = NEW.roast_id AND status = 'pending') >= 3 THEN
    UPDATE roasts SET is_hidden = true WHERE id = NEW.roast_id;
    UPDATE reports SET status = 'resolved' WHERE roast_id = NEW.roast_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_hide ON reports;
CREATE TRIGGER trigger_auto_hide
  AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION auto_hide_roast();

-- ============================================================
-- PHASE 8: TRENDING (computed from existing data — no new table needed)
-- ============================================================
-- Trending is computed via queries on existing roasts + user_interactions
-- No new tables required.

-- ============================================================
-- REALTIME for new tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE user_challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE battle_rounds;

-- ============================================================
-- DONE — All viral module tables created
-- ============================================================
