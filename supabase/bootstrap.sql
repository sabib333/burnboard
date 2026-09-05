-- ============================================================
-- BURNXBOARD — FULL DATABASE BOOTSTRAP (CLEAN)
-- Run this ONE TIME in Supabase SQL Editor
-- DROPS all tables first, then recreates from scratch
-- This avoids issues from partially-created tables
-- ============================================================

-- ============================================================
-- STEP 1: DROP EVERYTHING (clean slate)
-- ============================================================
-- Drop in reverse dependency order

-- Tables with no FK dependencies first
DROP TABLE IF EXISTS hot_seat_roast_reactions CASCADE;
DROP TABLE IF EXISTS hot_seat_roasts CASCADE;
DROP TABLE IF EXISTS hot_seats CASCADE;
DROP TABLE IF EXISTS leaderboard_snapshots CASCADE;
DROP TABLE IF EXISTS battle_history CASCADE;
DROP TABLE IF EXISTS battle_rounds CASCADE;
DROP TABLE IF EXISTS user_challenges CASCADE;
DROP TABLE IF EXISTS moderation_rules CASCADE;
DROP TABLE IF EXISTS user_blocks CASCADE;
DROP TABLE IF EXISTS user_karma CASCADE;
DROP TABLE IF EXISTS notification_queue CASCADE;
DROP TABLE IF EXISTS email_subscribers CASCADE;
DROP TABLE IF EXISTS sponsors CASCADE;
DROP TABLE IF EXISTS waitlist CASCADE;
DROP TABLE IF EXISTS daily_challenges CASCADE;
DROP TABLE IF EXISTS blocked_ips CASCADE;
DROP TABLE IF EXISTS security_logs CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS user_interactions CASCADE;
DROP TABLE IF EXISTS roast_remixes CASCADE;
DROP TABLE IF EXISTS story_views CASCADE;
DROP TABLE IF EXISTS stories CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS dm_messages CASCADE;
DROP TABLE IF EXISTS dm_threads CASCADE;
DROP TABLE IF EXISTS follows CASCADE;
DROP TABLE IF EXISTS challenges CASCADE;
DROP TABLE IF EXISTS roasts CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_stories() CASCADE;
DROP FUNCTION IF EXISTS sync_follow_counts_on_insert() CASCADE;
DROP FUNCTION IF EXISTS sync_follow_counts_on_delete() CASCADE;
DROP FUNCTION IF EXISTS auto_hide_roast() CASCADE;
DROP FUNCTION IF EXISTS increment_karma(UUID, INT, INT) CASCADE;
DROP FUNCTION IF EXISTS increment_burn_score(UUID, INT, INT, INT, INT) CASCADE;
DROP FUNCTION IF EXISTS increment_follow_counts(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS decrement_follow_counts(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS mark_notifications_read(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_streak(UUID) CASCADE;

-- ============================================================
-- STEP 2: CREATE EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- STEP 3: CREATE ALL TABLES
-- ============================================================

-- PROFILES (Roast Targets)
CREATE TABLE profiles (
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

-- ROASTS
CREATE TABLE roasts (
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

-- USER PROFILES (Registered Users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT DEFAULT '',
  avatar_url TEXT,
  karma INT DEFAULT 0,
  level TEXT DEFAULT 'Newbie',
  follower_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  streak INT DEFAULT 0,
  last_active TIMESTAMP DEFAULT now(),
  is_banned BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  roast_alerts BOOLEAN DEFAULT true,
  follow_alerts BOOLEAN DEFAULT true,
  dm_alerts BOOLEAN DEFAULT true,
  upvote_alerts BOOLEAN DEFAULT true,
  levelup_alerts BOOLEAN DEFAULT true,
  battle_alerts BOOLEAN DEFAULT true,
  notification_sounds JSONB DEFAULT '{"global_sound":true,"global_vibration":true}'::jsonb,
  created_at TIMESTAMP DEFAULT now()
);

-- FOLLOWS
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- NOTIFICATIONS
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

-- STORIES
CREATE TABLE stories (
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

-- STORY VIEWS
CREATE TABLE story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id TEXT,
  viewed_at TIMESTAMP DEFAULT now()
);

-- ROAST REMIXES
CREATE TABLE roast_remixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_roast_id UUID REFERENCES roasts(id) ON DELETE CASCADE,
  original_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id TEXT,
  remix_text TEXT,
  upvotes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

-- USER INTERACTIONS
CREATE TABLE user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id TEXT,
  target_user_id UUID,
  target_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT,
  platform TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- REPORTS
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roast_id UUID REFERENCES roasts(id) ON DELETE SET NULL,
  story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  reporter_id UUID,
  reporter_ip TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT now()
);

-- BATTLES
CREATE TABLE battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile1_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  profile2_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  votes1 INT DEFAULT 0,
  votes2 INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- SECURITY LOGS
CREATE TABLE security_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT now()
);

-- BLOCKED IPS
CREATE TABLE blocked_ips (
  ip_hash TEXT PRIMARY KEY,
  reason TEXT,
  blocked_by UUID,
  created_at TIMESTAMP DEFAULT now()
);

-- CHALLENGES
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'roast',
  target_count INT NOT NULL DEFAULT 1,
  reward_karma INT NOT NULL DEFAULT 5,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- USER KARMA
CREATE TABLE user_karma (
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

-- NOTIFICATION QUEUE
CREATE TABLE notification_queue (
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

-- DM THREADS
CREATE TABLE dm_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID REFERENCES auth.users(id),
  user2_id UUID REFERENCES auth.users(id),
  last_message TEXT,
  last_message_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);

-- DM MESSAGES
CREATE TABLE dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES dm_threads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  message TEXT NOT NULL,
  is_roast BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- WAITLIST
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- SPONSORS
CREATE TABLE sponsors (
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

-- EMAIL SUBSCRIBERS
CREATE TABLE email_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- HOT SEATS
CREATE TABLE hot_seats (
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

-- HOT SEAT ROASTS
CREATE TABLE hot_seat_roasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hot_seat_id UUID REFERENCES hot_seats(id) ON DELETE CASCADE,
  roast_text TEXT NOT NULL,
  anon_id TEXT NOT NULL DEFAULT 'Anonymous Roaster',
  ip_hash TEXT,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- HOT SEAT REACTIONS
CREATE TABLE hot_seat_roast_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roast_id UUID NOT NULL REFERENCES hot_seat_roasts(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- USER CHALLENGES
CREATE TABLE user_challenges (
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

-- BATTLE ROUNDS
CREATE TABLE battle_rounds (
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

-- BATTLE HISTORY
CREATE TABLE battle_history (
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

-- LEADERBOARD SNAPSHOTS
CREATE TABLE leaderboard_snapshots (
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

-- USER BLOCKS
CREATE TABLE user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- MODERATION RULES
CREATE TABLE moderation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'flag',
  severity INT DEFAULT 1,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STEP 4: INDEXES
-- ============================================================
CREATE INDEX idx_profiles_platform ON profiles(platform, is_banned, roast_count DESC);
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_user ON profiles(user_id);
CREATE INDEX idx_profiles_created ON profiles(created_at DESC);

CREATE INDEX idx_roasts_profile ON roasts(profile_id, created_at DESC);
CREATE INDEX idx_roasts_upvotes ON roasts(upvotes DESC);
CREATE INDEX idx_roasts_created ON roasts(created_at DESC);
CREATE INDEX idx_roasts_user ON roasts(user_id);
CREATE INDEX idx_roasts_savage_level ON roasts(savage_level);

CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_user_profiles_karma ON user_profiles(karma DESC);

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

CREATE INDEX idx_notif_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_stories_expires ON stories(expires_at);
CREATE INDEX idx_story_views_story ON story_views(story_id);
CREATE INDEX idx_remix_original ON roast_remixes(original_roast_id);
CREATE INDEX idx_inter_user ON user_interactions(user_id, action, created_at DESC);
CREATE INDEX idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX idx_battles_active ON battles(is_active, created_at DESC);
CREATE INDEX idx_security_ip ON security_logs(ip_hash, created_at DESC);
CREATE INDEX idx_user_karma_user ON user_karma(user_id);
CREATE INDEX idx_user_karma_level ON user_karma(level DESC, total_upvotes_received DESC);
CREATE INDEX idx_notif_queue_unprocessed ON notification_queue(processed, priority DESC, created_at ASC);
CREATE INDEX idx_dm_messages_thread ON dm_messages(thread_id);
CREATE INDEX idx_hot_seat_roasts_seat ON hot_seat_roasts(hot_seat_id);
CREATE INDEX idx_reactions_roast ON hot_seat_roast_reactions(roast_id);
CREATE INDEX idx_sponsors_active ON sponsors(active, position) WHERE active = true;

-- ============================================================
-- STEP 5: TRIGGERS & FUNCTIONS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Follow count sync
CREATE OR REPLACE FUNCTION sync_follow_counts_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
  UPDATE user_profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_follow_counts_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles SET follower_count = greatest(0, follower_count - 1) WHERE id = OLD.following_id;
  UPDATE user_profiles SET following_count = greatest(0, following_count - 1) WHERE id = OLD.follower_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_follow_insert
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION sync_follow_counts_on_insert();

CREATE TRIGGER trigger_follow_delete
  AFTER DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION sync_follow_counts_on_delete();

-- Auto-hide roast on 3+ reports
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

CREATE OR REPLACE FUNCTION increment_follow_counts(follower UUID, following UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles SET following_count = following_count + 1 WHERE id = follower;
  UPDATE user_profiles SET follower_count = follower_count + 1 WHERE id = following;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_follow_counts(follower UUID, following UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles SET following_count = greatest(0, following_count - 1) WHERE id = follower;
  UPDATE user_profiles SET follower_count = greatest(0, follower_count - 1) WHERE id = following;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mark_notifications_read(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE notifications SET is_read = true WHERE user_id = target_user_id AND is_read = false;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_streak(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  current_streak INT;
  last_date DATE;
  today DATE := current_date;
  yesterday DATE := current_date - 1;
BEGIN
  SELECT streak, last_roast_date INTO current_streak, last_date
  FROM user_karma WHERE user_id = p_user_id;
  IF current_streak IS NULL THEN current_streak := 0; END IF;
  IF last_date = today THEN
    RETURN current_streak;
  ELSIF last_date = yesterday THEN
    current_streak := current_streak + 1;
  ELSE
    current_streak := 1;
  END IF;
  UPDATE user_karma SET streak = current_streak, last_roast_date = today WHERE user_id = p_user_id;
  RETURN current_streak;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS void AS $$
BEGIN
  DELETE FROM stories WHERE expires_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 6: ROW LEVEL SECURITY
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
ALTER TABLE user_karma ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (is_banned = false AND is_hidden = false);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- ROASTS
CREATE POLICY "roasts_select" ON roasts FOR SELECT USING (is_hidden = false);
CREATE POLICY "roasts_insert" ON roasts FOR INSERT WITH CHECK (true);
CREATE POLICY "roasts_update" ON roasts FOR UPDATE USING (true);

-- USER_PROFILES
CREATE POLICY "user_profiles_select" ON user_profiles FOR SELECT USING (is_banned = false);
CREATE POLICY "user_profiles_insert" ON user_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "user_profiles_update" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- FOLLOWS
CREATE POLICY "follows_select" ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- NOTIFICATIONS
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- STORIES
CREATE POLICY "stories_select" ON stories FOR SELECT USING (expires_at > now() AND is_hidden = false);
CREATE POLICY "stories_insert" ON stories FOR INSERT WITH CHECK (true);

-- STORY VIEWS
CREATE POLICY "story_views_select" ON story_views FOR SELECT USING (true);
CREATE POLICY "story_views_insert" ON story_views FOR INSERT WITH CHECK (true);

-- ROAST REMIXES
CREATE POLICY "remixes_select" ON roast_remixes FOR SELECT USING (true);
CREATE POLICY "remixes_insert" ON roast_remixes FOR INSERT WITH CHECK (true);

-- USER INTERACTIONS
CREATE POLICY "interactions_select" ON user_interactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "interactions_insert" ON user_interactions FOR INSERT WITH CHECK (true);

-- REPORTS
CREATE POLICY "reports_select" ON reports FOR SELECT USING (true);
CREATE POLICY "reports_insert" ON reports FOR INSERT WITH CHECK (true);

-- BATTLES
CREATE POLICY "battles_select" ON battles FOR SELECT USING (true);
CREATE POLICY "battles_insert" ON battles FOR INSERT WITH CHECK (true);
CREATE POLICY "battles_update" ON battles FOR UPDATE USING (true);

-- SECURITY LOGS
CREATE POLICY "security_insert" ON security_logs FOR INSERT WITH CHECK (true);

-- BLOCKED IPS
CREATE POLICY "blocked_select" ON blocked_ips FOR SELECT USING (true);
CREATE POLICY "blocked_manage" ON blocked_ips FOR ALL USING (true);

-- CHALLENGES
CREATE POLICY "challenges_select" ON challenges FOR SELECT USING (active = true);
CREATE POLICY "challenges_manage" ON challenges FOR ALL USING (true);

-- USER KARMA
CREATE POLICY "karma_select" ON user_karma FOR SELECT USING (true);
CREATE POLICY "karma_insert" ON user_karma FOR INSERT WITH CHECK (true);
CREATE POLICY "karma_update" ON user_karma FOR UPDATE USING (auth.uid() = user_id);

-- NOTIFICATION QUEUE
CREATE POLICY "queue_insert" ON notification_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "queue_select" ON notification_queue FOR SELECT USING (auth.uid() = user_id);

-- DM THREADS
CREATE POLICY "dm_threads_select" ON dm_threads FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "dm_threads_insert" ON dm_threads FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "dm_threads_update" ON dm_threads FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- DM MESSAGES
CREATE POLICY "dm_messages_select" ON dm_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM dm_threads WHERE dm_threads.id = dm_messages.thread_id
  AND (auth.uid() = dm_threads.user1_id OR auth.uid() = dm_threads.user2_id))
);
CREATE POLICY "dm_messages_insert" ON dm_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- WAITLIST
CREATE POLICY "waitlist_insert" ON waitlist FOR INSERT WITH CHECK (true);
CREATE POLICY "waitlist_select" ON waitlist FOR SELECT USING (true);

-- SPONSORS
CREATE POLICY "sponsors_select" ON sponsors FOR SELECT USING (active = true);
CREATE POLICY "sponsors_manage" ON sponsors FOR ALL USING (true);

-- EMAIL SUBSCRIBERS
CREATE POLICY "email_subscribe" ON email_subscribers FOR INSERT WITH CHECK (true);

-- HOT SEATS
CREATE POLICY "hotseats_select" ON hot_seats FOR SELECT USING (status != 'deleted');
CREATE POLICY "hotseats_insert" ON hot_seats FOR INSERT WITH CHECK (true);
CREATE POLICY "hotseats_update" ON hot_seats FOR UPDATE USING (auth.uid() = creator_id OR creator_id IS NULL);

-- HOT SEAT ROASTS
CREATE POLICY "hs_roasts_select" ON hot_seat_roasts FOR SELECT USING (is_hidden = false);
CREATE POLICY "hs_roasts_insert" ON hot_seat_roasts FOR INSERT WITH CHECK (true);

-- HOT SEAT REACTIONS
CREATE POLICY "hs_reactions_select" ON hot_seat_roast_reactions FOR SELECT USING (true);
CREATE POLICY "hs_reactions_insert" ON hot_seat_roast_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "hs_reactions_update" ON hot_seat_roast_reactions FOR UPDATE USING (true);

-- USER CHALLENGES
CREATE POLICY "uc_select" ON user_challenges FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);
CREATE POLICY "uc_insert" ON user_challenges FOR INSERT WITH CHECK (auth.uid() = challenger_id);

-- BATTLE ROUNDS
CREATE POLICY "br_select" ON battle_rounds FOR SELECT USING (true);
CREATE POLICY "br_insert" ON battle_rounds FOR INSERT WITH CHECK (true);

-- BATTLE HISTORY
CREATE POLICY "bh_select" ON battle_history FOR SELECT USING (true);
CREATE POLICY "bh_insert" ON battle_history FOR INSERT WITH CHECK (true);

-- LEADERBOARD
CREATE POLICY "lb_select" ON leaderboard_snapshots FOR SELECT USING (true);
CREATE POLICY "lb_insert" ON leaderboard_snapshots FOR INSERT WITH CHECK (true);

-- USER BLOCKS
CREATE POLICY "blocks_select" ON user_blocks FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "blocks_insert" ON user_blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocks_delete" ON user_blocks FOR DELETE USING (auth.uid() = blocker_id);

-- MODERATION
CREATE POLICY "mod_select" ON moderation_rules FOR SELECT USING (true);
CREATE POLICY "mod_manage" ON moderation_rules FOR ALL USING (true);

-- ============================================================
-- STEP 7: REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE stories;
ALTER PUBLICATION supabase_realtime ADD TABLE roasts;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE follows;
ALTER PUBLICATION supabase_realtime ADD TABLE battles;
ALTER PUBLICATION supabase_realtime ADD TABLE reports;
ALTER PUBLICATION supabase_realtime ADD TABLE hot_seat_roasts;
ALTER PUBLICATION supabase_realtime ADD TABLE hot_seat_roast_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE dm_messages;

-- ============================================================
-- STEP 8: SEED DATA
-- ============================================================
INSERT INTO challenges (title, description, type, target_count, reward_karma) VALUES
  ('First Blood', 'Roast 1 person today', 'roast', 1, 5),
  ('Roast Rampage', 'Roast 5 people today', 'roast', 5, 15),
  ('LinkedIn Hunter', 'Roast 3 LinkedIn profiles today', 'linkedin', 3, 10),
  ('Upvote Magnet', 'Get 10 total upvotes on your roasts', 'upvote', 10, 20),
  ('Battle Judge', 'Vote in 3 roast battles today', 'vote', 3, 10),
  ('Viral Share', 'Share 1 roast card to socials', 'share', 1, 5),
  ('Brutal Week', 'Roast 7 days in a row (streak)', 'streak', 7, 50),
  ('Century Club', 'Get 100 total upvotes across all roasts', 'upvote', 100, 100);

-- ============================================================
-- DONE — Full database bootstrap complete
-- All 30+ tables, indexes, RLS policies, triggers, functions
-- ============================================================
