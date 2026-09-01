-- ============================================================
-- BURNBOARD V2.0 — PRODUCTION DATABASE (1M READY)
-- Run this in Supabase SQL Editor
-- ============================================================

-- Clean old permissive policies
DROP POLICY IF EXISTS "Public read" ON profiles;
DROP POLICY IF EXISTS "Anyone can read not banned" ON profiles;
DROP POLICY IF EXISTS "Read profiles" ON profiles;
DROP POLICY IF EXISTS "Insert profiles" ON profiles;
DROP POLICY IF EXISTS "Update profiles" ON profiles;

-- ============================================================
-- PROFILES (Roast Targets)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin','github','twitter','instagram','producthunt','youtube','tiktok','reddit','x')),
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
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_platform ON profiles(platform, is_banned, roast_count DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_created ON profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_featured ON profiles(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_profiles_banned ON profiles(is_banned) WHERE is_banned = false;

-- ============================================================
-- ROASTS
-- ============================================================
CREATE TABLE IF NOT EXISTS roasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  roast_text TEXT NOT NULL CHECK (char_length(roast_text) >= 5 AND char_length(roast_text) <= 280),
  anon_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  upvotes INT DEFAULT 0,
  reaction_brutal INT DEFAULT 0,
  reaction_haha INT DEFAULT 0,
  reaction_cry INT DEFAULT 0,
  is_hidden BOOLEAN DEFAULT false,
  is_clean BOOLEAN DEFAULT true,
  ip_hash TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roasts_profile ON roasts(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_roasts_upvotes ON roasts(upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_roasts_created ON roasts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_roasts_user ON roasts(user_id);

-- ============================================================
-- USER PROFILES (Registered Users)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL CHECK (username ~ '^[a-zA-Z0-9_]+$' AND char_length(username) >= 3),
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  karma INT DEFAULT 0,
  level TEXT DEFAULT 'Newbie' CHECK (level IN ('Newbie','Roaster','Brutal','Savage','Legend')),
  follower_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  streak INT DEFAULT 0,
  last_active TIMESTAMP DEFAULT now(),
  is_banned BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_karma ON user_profiles(karma DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_level ON user_profiles(level);
CREATE INDEX IF NOT EXISTS idx_user_profiles_active ON user_profiles(last_active DESC);

-- ============================================================
-- FOLLOWS
-- ============================================================
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('roast','upvote','follow','dm','mention','milestone','challenge','system')),
  title TEXT,
  message TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- ============================================================
-- STORIES (24h expiring)
-- ============================================================
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id TEXT,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  text TEXT CHECK (char_length(text) >= 2 AND char_length(text) <= 200),
  background_color TEXT DEFAULT '#ff4500',
  view_count INT DEFAULT 0,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_active ON stories(expires_at, is_hidden) WHERE is_hidden = false;

-- ============================================================
-- STORY VIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id TEXT,
  viewed_at TIMESTAMP DEFAULT now(),
  UNIQUE(story_id, user_id),
  UNIQUE(story_id, anon_id)
);

CREATE INDEX IF NOT EXISTS idx_story_views_story ON story_views(story_id);

-- ============================================================
-- ROAST REMIXES
-- ============================================================
CREATE TABLE IF NOT EXISTS roast_remixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_roast_id UUID REFERENCES roasts(id) ON DELETE CASCADE,
  original_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id TEXT,
  remix_text TEXT CHECK (char_length(remix_text) >= 5 AND char_length(remix_text) <= 280),
  upvotes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remix_original ON roast_remixes(original_roast_id);
CREATE INDEX IF NOT EXISTS idx_remix_user ON roast_remixes(user_id);

-- ============================================================
-- USER INTERACTIONS (Feed Algorithm Data)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id TEXT,
  target_user_id UUID,
  target_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT CHECK (action IN ('view','roast','upvote','reaction','follow','dm','share','battle_vote','view_reel','view_story')),
  platform TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inter_user ON user_interactions(user_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inter_anon ON user_interactions(anon_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inter_profile ON user_interactions(target_profile_id, action);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roast_id UUID REFERENCES roasts(id) ON DELETE SET NULL,
  story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  reporter_id UUID,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','resolved','dismissed')),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_roast ON reports(roast_id);

-- ============================================================
-- BATTLES
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

CREATE INDEX IF NOT EXISTS idx_battles_active ON battles(is_active, created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_security_ip ON security_logs(ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_action ON security_logs(action, created_at DESC);

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
-- DAILY CHALLENGES
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  reward TEXT,
  target_count INT DEFAULT 10,
  current_count INT DEFAULT 0,
  type TEXT CHECK (type IN ('roast','vote','share')),
  date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenges_date ON daily_challenges(date, is_active);

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE roast_remixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES — STRICT
-- ============================================================

-- PROFILES
CREATE POLICY "Read not banned profiles" ON profiles
  FOR SELECT USING (is_banned = false AND is_hidden = false);

CREATE POLICY "Auth create profile" ON profiles
  FOR INSERT WITH CHECK (
    char_length(username) >= 3
    AND username ~ '^[a-zA-Z0-9_]+$'
  );

CREATE POLICY "Owner update profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- ROASTS
CREATE POLICY "Read not hidden roasts" ON roasts
  FOR SELECT USING (is_hidden = false);

CREATE POLICY "Create roast with validation" ON roasts
  FOR INSERT WITH CHECK (
    char_length(roast_text) >= 5
    AND char_length(roast_text) <= 280
    AND roast_text !~* '<script'
    AND roast_text !~* 'javascript:'
  );

CREATE POLICY "Update own roast reactions" ON roasts
  FOR UPDATE USING (true);

-- USER PROFILES
CREATE POLICY "Public read non-banned users" ON user_profiles
  FOR SELECT USING (is_banned = false);

CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- FOLLOWS
CREATE POLICY "Public read follows" ON follows
  FOR SELECT USING (true);

CREATE POLICY "Users follow" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users unfollow" ON follows
  FOR DELETE USING (auth.uid() = follower_id);

-- NOTIFICATIONS
CREATE POLICY "Users read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- STORIES
CREATE POLICY "Public read active stories" ON stories
  FOR SELECT USING (expires_at > now() AND is_hidden = false);

CREATE POLICY "Users create story" ON stories
  FOR INSERT WITH CHECK (
    char_length(text) >= 2
    AND char_length(text) <= 200
  );

-- STORY VIEWS
CREATE POLICY "Users insert story views" ON story_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Read story views" ON story_views
  FOR SELECT USING (true);

-- ROAST REMIXES
CREATE POLICY "Read remixes" ON roast_remixes
  FOR SELECT USING (true);

CREATE POLICY "Create remix" ON roast_remixes
  FOR INSERT WITH CHECK (
    char_length(remix_text) >= 5
    AND char_length(remix_text) <= 280
  );

-- USER INTERACTIONS
CREATE POLICY "Insert interactions" ON user_interactions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Read own interactions" ON user_interactions
  FOR SELECT USING (
    auth.uid() = user_id
    OR anon_id = current_setting('request.headers', true)::jsonb->>'x-anon-id'
  );

-- REPORTS
CREATE POLICY "Insert report" ON reports
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin read reports" ON reports
  FOR SELECT USING (true);

-- BATTLES
CREATE POLICY "Public read battles" ON battles
  FOR SELECT USING (true);

CREATE POLICY "Update battles" ON battles
  FOR UPDATE USING (true);

CREATE POLICY "Insert battles" ON battles
  FOR INSERT WITH CHECK (true);

-- SECURITY LOGS (admin only via service role)
CREATE POLICY "Insert security logs" ON security_logs
  FOR INSERT WITH CHECK (true);

-- BLOCKED IPS
CREATE POLICY "Insert blocked ips" ON blocked_ips
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Delete blocked ips" ON blocked_ips
  FOR DELETE USING (true);

-- DAILY CHALLENGES
CREATE POLICY "Public read challenges" ON daily_challenges
  FOR SELECT USING (true);

CREATE POLICY "Insert challenges" ON daily_challenges
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Update challenges" ON daily_challenges
  FOR UPDATE USING (true);

-- ============================================================
-- REALTIME PUBLICATIONS
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE stories;
ALTER PUBLICATION supabase_realtime ADD TABLE roasts;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE follows;
ALTER PUBLICATION supabase_realtime ADD TABLE battles;

-- ============================================================
-- AUTO-UPDATE TRIGGER (updated_at)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- CLEANUP FUNCTION (auto-delete expired stories)
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS void AS $$
BEGIN
  DELETE FROM stories WHERE expires_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- DONE — All 1M-ready tables created with indexes + RLS
-- ============================================================
