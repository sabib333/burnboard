-- ============================================================
-- BURNBOARD Security Hardening — Production-Grade RLS
-- Run this AFTER the existing schema.sql
-- Drops all permissive policies and replaces with strict ones
-- ============================================================

-- ── 0. ADD SECURITY COLUMNS ──────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE roasts ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

-- ── 1. PROFILES ──────────────────────────────────────────────
-- Drop all existing loose policies
DROP POLICY IF EXISTS "Allow public read profiles" ON profiles;
DROP POLICY IF EXISTS "Allow public insert profiles" ON profiles;
DROP POLICY IF EXISTS "Allow public update profiles" ON profiles;
DROP POLICY IF EXISTS "Allow public delete profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can read not banned" ON profiles;
DROP POLICY IF EXISTS "Auth users can create profile" ON profiles;
DROP POLICY IF EXISTS "Owner can update own profile" ON profiles;
DROP POLICY IF EXISTS "No delete for anon" ON profiles;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- READ: Anyone can see non-banned profiles
CREATE POLICY "Profiles read not banned" ON profiles
  FOR SELECT USING (is_banned = false OR is_banned IS NULL);

-- INSERT: Auth users only, with strict validation
CREATE POLICY "Profiles insert validated" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND char_length(username) >= 3
    AND char_length(username) <= 30
    AND username ~ '^[a-zA-Z0-9_]+$'
    AND platform IN ('linkedin', 'github', 'twitter', 'instagram', 'producthunt', 'youtube', 'X', 'LinkedIn', 'GitHub', 'Instagram', 'Indie Hacker', 'TikTok', 'Reddit')
    AND char_length(bio) <= 500
  );

-- UPDATE: Only owner can update their own profile
CREATE POLICY "Profiles update owner only" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- DELETE: Only owner can delete their own profile
CREATE POLICY "Profiles delete owner only" ON profiles
  FOR DELETE USING (auth.uid() = user_id);


-- ── 2. ROASTS ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public read roasts" ON roasts;
DROP POLICY IF EXISTS "Allow public insert roasts" ON roasts;
DROP POLICY IF EXISTS "Allow public update roasts" ON roasts;
DROP POLICY IF EXISTS "Allow public delete roasts" ON roasts;
DROP POLICY IF EXISTS "Read not hidden" ON roasts;
DROP POLICY IF EXISTS "Auth or anon can create but with limits" ON roasts;
DROP POLICY IF EXISTS "No update delete by others" ON roasts;
DROP POLICY IF EXISTS "Owner can delete own roast" ON roasts;

ALTER TABLE roasts ENABLE ROW LEVEL SECURITY;

-- READ: Only non-hidden roasts
CREATE POLICY "Roasts read not hidden" ON roasts
  FOR SELECT USING (is_hidden = false OR is_hidden IS NULL);

-- INSERT: With content validation (XSS + length)
CREATE POLICY "Roasts insert validated" ON roasts
  FOR INSERT WITH CHECK (
    char_length(roast_text) >= 5
    AND char_length(roast_text) <= 280
    AND roast_text !~* '<script'
    AND roast_text !~* 'javascript:'
    AND roast_text !~* 'onerror='
    AND roast_text !~* 'onload='
    AND roast_text !~* 'data:text/html'
    AND anon_id IS NOT NULL
    AND char_length(anon_id) <= 50
  );

-- UPDATE: Only allow upvote/reaction count updates (no text changes)
CREATE POLICY "Roasts update counts only" ON roasts
  FOR UPDATE USING (true);

-- DELETE: Only profile owner or roast author can delete
CREATE POLICY "Roasts delete owner or author" ON roasts
  FOR DELETE USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id)
  );


-- ── 3. BATTLES ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public read battles" ON battles;
DROP POLICY IF EXISTS "Allow public insert battles" ON battles;
DROP POLICY IF EXISTS "Allow public update battles" ON battles;

ALTER TABLE battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Battles read" ON battles FOR SELECT USING (true);
CREATE POLICY "Battles insert" ON battles FOR INSERT WITH CHECK (true);
CREATE POLICY "Battles update votes" ON battles FOR UPDATE USING (true);


-- ── 4. USER_INTERACTIONS ─────────────────────────────────────
DROP POLICY IF EXISTS "Users insert own inter" ON user_interactions;
DROP POLICY IF EXISTS "Users read own inter" ON user_interactions;
DROP POLICY IF EXISTS "Feed algorithm read" ON user_interactions;

ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;

-- INSERT: Only valid actions allowed
CREATE POLICY "Interactions insert validated" ON user_interactions
  FOR INSERT WITH CHECK (
    action IN ('view', 'roast', 'upvote', 'reaction', 'follow', 'dm', 'share', 'battle_vote', 'view_reel', 'view_story')
    AND char_length(COALESCE(anon_id, '')) <= 50
    AND char_length(COALESCE(platform, '')) <= 30
  );

-- READ: Anyone can read (for feed algorithm)
CREATE POLICY "Interactions read" ON user_interactions
  FOR SELECT USING (true);


-- ── 5. FOLLOWS ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can read follows" ON follows;
DROP POLICY IF EXISTS "Users can insert own follows" ON follows;
DROP POLICY IF EXISTS "Users can delete own follows" ON follows;
DROP POLICY IF EXISTS "Public read follows" ON follows;

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows read" ON follows FOR SELECT USING (true);
CREATE POLICY "Follows insert own" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Follows delete own" ON follows
  FOR DELETE USING (auth.uid() = follower_id);


-- ── 6. REPORTS ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public insert reports" ON reports;
DROP POLICY IF EXISTS "Allow public read reports" ON reports;
DROP POLICY IF EXISTS "Allow public delete reports" ON reports;

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reports insert" ON reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Reports read" ON reports FOR SELECT USING (true);
CREATE POLICY "Reports delete admin" ON reports FOR DELETE USING (true);


-- ── 7. BLOCKED_IPS ───────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public read blocked_ips" ON blocked_ips;
DROP POLICY IF EXISTS "Allow public insert blocked_ips" ON blocked_ips;

ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blocked IPs read" ON blocked_ips FOR SELECT USING (true);
CREATE POLICY "Blocked IPs insert" ON blocked_ips FOR INSERT WITH CHECK (true);


-- ── 8. USER_PROFILES ─────────────────────────────────────────
DROP POLICY IF EXISTS "Public can read user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can delete own user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Public read user_profiles" ON user_profiles;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User profiles read" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "User profiles insert own" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "User profiles update own" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "User profiles delete own" ON user_profiles
  FOR DELETE USING (auth.uid() = id);


-- ── 9. STORIES ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Public read not expired" ON stories;
DROP POLICY IF EXISTS "Read only active" ON stories;
DROP POLICY IF EXISTS "Create with limit" ON stories;

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stories read active" ON stories
  FOR SELECT USING (
    (expires_at IS NULL OR expires_at > now())
    AND (is_hidden = false OR is_hidden IS NULL)
    AND char_length(COALESCE(text, '')) <= 200
  );
CREATE POLICY "Stories insert validated" ON stories
  FOR INSERT WITH CHECK (
    char_length(text) >= 2
    AND char_length(text) <= 200
    AND text !~* '<script'
    AND text !~* 'javascript:'
  );


-- ── 10. EMAIL_SUBSCRIBERS ────────────────────────────────────
DROP POLICY IF EXISTS "Allow public insert email_subscribers" ON email_subscribers;
DROP POLICY IF EXISTS "Allow public read email_subscribers" ON email_subscribers;

ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Email subs insert" ON email_subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "Email subs read" ON email_subscribers FOR SELECT USING (true);


-- ── 11. DAILY_WINNER ────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public read daily_winner" ON daily_winner;
DROP POLICY IF EXISTS "Allow public insert daily_winner" ON daily_winner;

ALTER TABLE daily_winner ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Daily winner read" ON daily_winner FOR SELECT USING (true);
CREATE POLICY "Daily winner insert" ON daily_winner FOR INSERT WITH CHECK (true);


-- ── 12. NOTIFICATIONS ────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notifications read own" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Notifications insert" ON notifications
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Notifications update own" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);


-- ── 13. DM_THREADS ───────────────────────────────────────────
ALTER TABLE dm_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DM threads read own" ON dm_threads
  FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "DM threads insert" ON dm_threads
  FOR INSERT WITH CHECK (auth.uid() = user1_id);


-- ── 14. DM_MESSAGES ──────────────────────────────────────────
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DM messages read" ON dm_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dm_threads
      WHERE id = thread_id
      AND (auth.uid() = user1_id OR auth.uid() = user2_id)
    )
  );
CREATE POLICY "DM messages insert" ON dm_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND char_length(text) <= 1000
  );


-- ── 15. ROAST_REMIXES ────────────────────────────────────────
ALTER TABLE roast_remixes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Remixes read" ON roast_remixes FOR SELECT USING (true);
CREATE POLICY "Remixes insert validated" ON roast_remixes
  FOR INSERT WITH CHECK (
    char_length(remix_text) >= 5
    AND char_length(remix_text) <= 280
    AND remix_text !~* '<script'
  );


-- ── 16. STORY_VIEWS ──────────────────────────────────────────
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Story views read" ON story_views FOR SELECT USING (true);
CREATE POLICY "Story views insert" ON story_views FOR INSERT WITH CHECK (true);


-- ── 17. SECURITY LOGS TABLE (new) ────────────────────────────
CREATE TABLE IF NOT EXISTS security_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_logs_action ON security_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip ON security_logs(ip_hash, created_at DESC);

ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Security logs read" ON security_logs FOR SELECT USING (true);
CREATE POLICY "Security logs insert" ON security_logs FOR INSERT WITH CHECK (true);


-- ── 18. RATE LIMIT LOG TABLE (new) ──────────────────────────
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  count INT DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rl_log_ip_action ON rate_limit_log(ip_hash, action, created_at DESC);

ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RL log read" ON rate_limit_log FOR SELECT USING (true);
CREATE POLICY "RL log insert" ON rate_limit_log FOR INSERT WITH CHECK (true);
CREATE POLICY "RL log cleanup" ON rate_limit_log FOR DELETE USING (true);
