-- ============================================================
-- BURNXBOARD — PATCH: Create only MISSING tables
-- Safe to run — only creates tables that don't exist yet
-- Does NOT drop any existing tables or data
-- ============================================================

-- ============================================================
-- PROFILES (Roast Targets) — CRITICAL, app won't load without this
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  platform TEXT NOT NULL,
  url TEXT,
  bio TEXT,
  avatar_url TEXT,
  avatar_letter TEXT,
  avatar_color TEXT,
  tagline TEXT,
  featured BOOLEAN DEFAULT false,
  roast_count INT DEFAULT 0,
  total_upvotes INT DEFAULT 0,
  reaction_brutal INT DEFAULT 0,
  reaction_haha INT DEFAULT 0,
  reaction_cry INT DEFAULT 0,
  is_banned BOOLEAN DEFAULT false,
  is_hidden BOOLEAN DEFAULT false,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_hash TEXT,
  hot_seat_token TEXT UNIQUE,
  hot_seat_expires_at TIMESTAMPTZ,
  hot_seat_share_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- ROASTS — CRITICAL for roast posting
-- ============================================================
CREATE TABLE IF NOT EXISTS roasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  roast_text TEXT NOT NULL,
  anon_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  upvotes INT DEFAULT 0,
  reaction_brutal INT DEFAULT 0,
  reaction_haha INT DEFAULT 0,
  reaction_cry INT DEFAULT 0,
  is_hidden BOOLEAN DEFAULT false,
  is_clean BOOLEAN DEFAULT true,
  ip_hash TEXT,
  savage_level TEXT DEFAULT 'savage',
  created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- BATTLES — CRITICAL for battle feature
-- ============================================================
CREATE TABLE IF NOT EXISTS battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile1_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  profile2_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  votes1 INT DEFAULT 0,
  votes2 INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- STORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id TEXT,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  text TEXT,
  background_color TEXT DEFAULT '#ff4500',
  view_count INT DEFAULT 0,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP DEFAULT (now() + interval '24 hours')
);

-- ============================================================
-- STORY VIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id TEXT,
  viewed_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roast_id UUID REFERENCES roasts(id) ON DELETE SET NULL,
  story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  reporter_id UUID,
  reporter_ip TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- SECURITY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS security_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- BLOCKED IPS
-- ============================================================
CREATE TABLE IF NOT EXISTS blocked_ips (
  ip_hash TEXT PRIMARY KEY,
  reason TEXT,
  blocked_by UUID,
  created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- CHALLENGES
-- ============================================================
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'roast',
  target_count INT NOT NULL DEFAULT 1,
  reward_karma INT NOT NULL DEFAULT 5,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- DAILY CHALLENGES
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  reward TEXT,
  target_count INT DEFAULT 10,
  current_count INT DEFAULT 0,
  type TEXT,
  date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- USER KARMA
-- ============================================================
CREATE TABLE IF NOT EXISTS user_karma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anon_id TEXT,
  total_upvotes_received INT DEFAULT 0,
  total_roasts_given INT DEFAULT 0,
  total_upvotes_given INT DEFAULT 0,
  level TEXT DEFAULT 'Newbie',
  streak INT DEFAULT 0,
  last_roast_date DATE,
  burn_score INT DEFAULT 0,
  total_reactions_received INT DEFAULT 0,
  total_battles_won INT DEFAULT 0,
  total_challenges_completed INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(anon_id)
);

-- ============================================================
-- NOTIFICATION QUEUE
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  priority INT DEFAULT 0,
  dedup_key TEXT,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- ROAST REMIXES
-- ============================================================
CREATE TABLE IF NOT EXISTS roast_remixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_roast_id UUID REFERENCES roasts(id) ON DELETE CASCADE,
  original_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id TEXT,
  remix_text TEXT,
  upvotes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- USER INTERACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id TEXT,
  target_user_id UUID,
  target_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT,
  platform TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- WAITLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- SPONSORS
-- ============================================================
CREATE TABLE IF NOT EXISTS sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sponsor_name TEXT NOT NULL,
  sponsor_text TEXT,
  cta_link TEXT,
  image_url TEXT,
  position TEXT DEFAULT 'feed',
  active BOOLEAN DEFAULT true,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- EMAIL SUBSCRIBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS email_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- HOT SEATS
-- ============================================================
CREATE TABLE IF NOT EXISTS hot_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL DEFAULT 'Anonymous',
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  context TEXT DEFAULT '',
  image_url TEXT DEFAULT NULL,
  heat_level TEXT NOT NULL DEFAULT 'savage',
  status TEXT NOT NULL DEFAULT 'active',
  roast_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- HOT SEAT ROASTS
-- ============================================================
CREATE TABLE IF NOT EXISTS hot_seat_roasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hot_seat_id UUID REFERENCES hot_seats(id) ON DELETE CASCADE,
  roast_text TEXT NOT NULL,
  anon_id TEXT NOT NULL DEFAULT 'Anonymous Roaster',
  ip_hash TEXT,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- HOT SEAT REACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS hot_seat_roast_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roast_id UUID NOT NULL REFERENCES hot_seat_roasts(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- USER CHALLENGES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  challenged_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  challenger_score INT DEFAULT 0,
  challenged_score INT DEFAULT 0,
  status TEXT DEFAULT 'pending',
  challenge_type TEXT DEFAULT 'roast_battle',
  description TEXT,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- BATTLE ROUNDS
-- ============================================================
CREATE TABLE IF NOT EXISTS battle_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID REFERENCES battles(id) ON DELETE CASCADE,
  round_number INT NOT NULL DEFAULT 1,
  profile1_roast_id UUID REFERENCES roasts(id) ON DELETE SET NULL,
  profile2_roast_id UUID REFERENCES roasts(id) ON DELETE SET NULL,
  votes1 INT DEFAULT 0,
  votes2 INT DEFAULT 0,
  winner INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- BATTLE HISTORY
-- ============================================================
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

-- ============================================================
-- LEADERBOARD SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  burn_score INT DEFAULT 0,
  total_upvotes INT DEFAULT 0,
  total_roasts INT DEFAULT 0,
  level TEXT DEFAULT 'Newbie',
  category TEXT DEFAULT 'alltime',
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- USER BLOCKS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- ============================================================
-- MODERATION RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS moderation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'flag',
  severity INT DEFAULT 1,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES (safe — IF NOT EXISTS)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_platform ON profiles(platform, is_banned, roast_count DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_created ON profiles(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_roasts_profile ON roasts(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_roasts_upvotes ON roasts(upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_roasts_created ON roasts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_roasts_user ON roasts(user_id);
CREATE INDEX IF NOT EXISTS idx_roasts_savage_level ON roasts(savage_level);

CREATE INDEX IF NOT EXISTS idx_battles_active ON battles(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_ip ON security_logs(ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_karma_user ON user_karma(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_queue_unprocessed ON notification_queue(processed, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_hot_seat_roasts_seat ON hot_seat_roasts(hot_seat_id);
CREATE INDEX IF NOT EXISTS idx_reactions_roast ON hot_seat_roast_reactions(roast_id);
CREATE INDEX IF NOT EXISTS idx_sponsors_active ON sponsors(active, position) WHERE active = true;

-- ============================================================
-- TRIGGERS (safe — use CREATE OR REPLACE)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- RPC Functions
CREATE OR REPLACE FUNCTION increment_karma(p_user_id UUID, p_upvotes_delta INT DEFAULT 0, p_roasts_delta INT DEFAULT 0)
RETURNS VOID AS $$
BEGIN
  UPDATE user_karma SET
    total_upvotes_received = total_upvotes_received + p_upvotes_delta,
    total_roasts_given = total_roasts_given + p_roasts_delta
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_burn_score(
  p_user_id UUID, p_score_delta INT DEFAULT 0, p_reactions_delta INT DEFAULT 0,
  p_battles_won_delta INT DEFAULT 0, p_challenges_delta INT DEFAULT 0
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

CREATE OR REPLACE FUNCTION mark_notifications_read(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE notifications SET is_read = true WHERE user_id = target_user_id AND is_read = false;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS void AS $$
BEGIN
  DELETE FROM stories WHERE expires_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RLS — ENABLE + CREATE POLICIES (safe names)
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_karma ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE roast_remixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hot_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE hot_seat_roasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hot_seat_roast_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_rules ENABLE ROW LEVEL SECURITY;

-- PROFILES
DO $$ BEGIN CREATE POLICY "patch_profiles_select" ON profiles FOR SELECT USING (is_banned = false AND is_hidden = false); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_profiles_insert" ON profiles FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_profiles_update" ON profiles FOR UPDATE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ROASTS
DO $$ BEGIN CREATE POLICY "patch_roasts_select" ON roasts FOR SELECT USING (is_hidden = false); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_roasts_insert" ON roasts FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_roasts_update" ON roasts FOR UPDATE USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- BATTLES
DO $$ BEGIN CREATE POLICY "patch_battles_select" ON battles FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_battles_insert" ON battles FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_battles_update" ON battles FOR UPDATE USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- STORIES
DO $$ BEGIN CREATE POLICY "patch_stories_select" ON stories FOR SELECT USING (expires_at > now() AND is_hidden = false); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_stories_insert" ON stories FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- STORY VIEWS
DO $$ BEGIN CREATE POLICY "patch_story_views_select" ON story_views FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_story_views_insert" ON story_views FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- REPORTS
DO $$ BEGIN CREATE POLICY "patch_reports_select" ON reports FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_reports_insert" ON reports FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- SECURITY LOGS
DO $$ BEGIN CREATE POLICY "patch_security_insert" ON security_logs FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- BLOCKED IPS
DO $$ BEGIN CREATE POLICY "patch_blocked_select" ON blocked_ips FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_blocked_manage" ON blocked_ips FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CHALLENGES
DO $$ BEGIN CREATE POLICY "patch_challenges_select" ON challenges FOR SELECT USING (active = true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_challenges_manage" ON challenges FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- USER KARMA
DO $$ BEGIN CREATE POLICY "patch_karma_select" ON user_karma FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_karma_insert" ON user_karma FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_karma_update" ON user_karma FOR UPDATE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- NOTIFICATION QUEUE
DO $$ BEGIN CREATE POLICY "patch_queue_insert" ON notification_queue FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_queue_select" ON notification_queue FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ROAST REMIXES
DO $$ BEGIN CREATE POLICY "patch_remixes_select" ON roast_remixes FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_remixes_insert" ON roast_remixes FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- USER INTERACTIONS
DO $$ BEGIN CREATE POLICY "patch_interactions_select" ON user_interactions FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_interactions_insert" ON user_interactions FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- WAITLIST
DO $$ BEGIN CREATE POLICY "patch_waitlist_insert" ON waitlist FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- SPONSORS
DO $$ BEGIN CREATE POLICY "patch_sponsors_select" ON sponsors FOR SELECT USING (active = true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- EMAIL SUBSCRIBERS
DO $$ BEGIN CREATE POLICY "patch_email_subscribe" ON email_subscribers FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- HOT SEATS
DO $$ BEGIN CREATE POLICY "patch_hotseats_select" ON hot_seats FOR SELECT USING (status != 'deleted'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_hotseats_insert" ON hot_seats FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_hotseats_update" ON hot_seats FOR UPDATE USING (auth.uid() = creator_id OR creator_id IS NULL); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- HOT SEAT ROASTS
DO $$ BEGIN CREATE POLICY "patch_hs_roasts_select" ON hot_seat_roasts FOR SELECT USING (is_hidden = false); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_hs_roasts_insert" ON hot_seat_roasts FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- HOT SEAT REACTIONS
DO $$ BEGIN CREATE POLICY "patch_hs_reactions_select" ON hot_seat_roast_reactions FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_hs_reactions_insert" ON hot_seat_roast_reactions FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_hs_reactions_update" ON hot_seat_roast_reactions FOR UPDATE USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- USER CHALLENGES
DO $$ BEGIN CREATE POLICY "patch_uc_select" ON user_challenges FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = challenged_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_uc_insert" ON user_challenges FOR INSERT WITH CHECK (auth.uid() = challenger_id); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- BATTLE ROUNDS
DO $$ BEGIN CREATE POLICY "patch_br_select" ON battle_rounds FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_br_insert" ON battle_rounds FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- BATTLE HISTORY
DO $$ BEGIN CREATE POLICY "patch_bh_select" ON battle_history FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_bh_insert" ON battle_history FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- LEADERBOARD
DO $$ BEGIN CREATE POLICY "patch_lb_select" ON leaderboard_snapshots FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_lb_insert" ON leaderboard_snapshots FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- USER BLOCKS
DO $$ BEGIN CREATE POLICY "patch_blocks_select" ON user_blocks FOR SELECT USING (auth.uid() = blocker_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_blocks_insert" ON user_blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_blocks_delete" ON user_blocks FOR DELETE USING (auth.uid() = blocker_id); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- MODERATION
DO $$ BEGIN CREATE POLICY "patch_mod_select" ON moderation_rules FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "patch_mod_manage" ON moderation_rules FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- REALTIME (safe — duplicate_object ignored)
-- ============================================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE roasts; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE profiles; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE battles; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE stories; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE reports; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE hot_seat_roasts; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE hot_seat_roast_reactions; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO challenges (title, description, type, target_count, reward_karma) VALUES
  ('First Blood', 'Roast 1 person today', 'roast', 1, 5),
  ('Roast Rampage', 'Roast 5 people today', 'roast', 5, 15),
  ('LinkedIn Hunter', 'Roast 3 LinkedIn profiles today', 'linkedin', 3, 10),
  ('Upvote Magnet', 'Get 10 total upvotes on your roasts', 'upvote', 10, 20),
  ('Battle Judge', 'Vote in 3 roast battles today', 'vote', 3, 10),
  ('Viral Share', 'Share 1 roast card to socials', 'share', 1, 5),
  ('Brutal Week', 'Roast 7 days in a row (streak)', 'streak', 7, 50),
  ('Century Club', 'Get 100 total upvotes across all roasts', 'upvote', 100, 100)
ON CONFLICT DO NOTHING;

-- ============================================================
-- DONE — All missing tables created, existing data preserved
-- ============================================================
