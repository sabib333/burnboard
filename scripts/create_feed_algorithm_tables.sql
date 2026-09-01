-- ============================================================
-- BURNBOARD Feed Algorithm — Instagram-Grade Signal Tracking
-- ============================================================
-- Tracks every real user interaction like Instagram does.
-- Used by lib/feedAlgorithm.ts for personalized scoring.
-- ============================================================

-- 1. Track every real interaction (Instagram tracks every tap)
CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anon_id TEXT, -- for anon users
  target_user_id UUID REFERENCES auth.users(id), -- whose profile they interacted with
  target_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- view, roast, upvote, reaction, follow, dm, share, battle_vote
  platform TEXT, -- linkedin, github etc of target
  created_at TIMESTAMP DEFAULT NOW()
);

-- Performance indexes for 1M+ scale
CREATE INDEX IF NOT EXISTS idx_inter_user_action ON user_interactions(user_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inter_target ON user_interactions(target_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inter_anon ON user_interactions(anon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inter_platform ON user_interactions(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_inter_created ON user_interactions(created_at DESC);

-- 2. For velocity tracking (trending like Instagram Reels)
CREATE TABLE IF NOT EXISTS profile_stats_hourly (
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  hour TIMESTAMP,
  upvotes_gained INT DEFAULT 0,
  roasts_gained INT DEFAULT 0,
  PRIMARY KEY (profile_id, hour)
);

CREATE INDEX IF NOT EXISTS idx_psh_hour ON profile_stats_hourly(hour DESC);

-- 3. Row Level Security
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (anon + logged in)
CREATE POLICY "Users insert own inter" ON user_interactions
  FOR INSERT WITH CHECK (true);

-- Users can read their own interactions, anon users can read anon ones
CREATE POLICY "Users read own inter" ON user_interactions
  FOR SELECT USING (auth.uid() = user_id OR anon_id IS NOT NULL);

-- Allow reading for feed algorithm (needs target data)
CREATE POLICY "Feed algorithm read" ON user_interactions
  FOR SELECT USING (true);

-- RLS for profile_stats_hourly
ALTER TABLE profile_stats_hourly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stats read public" ON profile_stats_hourly
  FOR SELECT USING (true);

CREATE POLICY "Stats insert service" ON profile_stats_hourly
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Stats update service" ON profile_stats_hourly
  FOR UPDATE USING (true);
