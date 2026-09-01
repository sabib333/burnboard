-- ============================================================
-- BURNBOARD V2.0 — MONETIZATION + SCALING
-- Run after the main production migration
-- ============================================================

-- ============================================================
-- WAITLIST (Pro + Sponsor)
-- ============================================================
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pro', 'sponsor')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_type ON waitlist(type, created_at DESC);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insert waitlist" ON waitlist
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin read waitlist" ON waitlist
  FOR SELECT USING (true);

-- ============================================================
-- SPONSORS (Future ad slots)
-- ============================================================
CREATE TABLE IF NOT EXISTS sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sponsor_name TEXT NOT NULL,
  sponsor_text TEXT,
  cta_link TEXT,
  image_url TEXT,
  position TEXT DEFAULT 'feed' CHECK (position IN ('feed', 'sidebar', 'reels')),
  active BOOLEAN DEFAULT true,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsors_active ON sponsors(active, position) WHERE active = true;

ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active sponsors" ON sponsors
  FOR SELECT USING (active = true);

CREATE POLICY "Admin manage sponsors" ON sponsors
  FOR ALL USING (true);

-- ============================================================
-- CHALLENGES (Daily challenges)
-- ============================================================
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  reward_karma INT DEFAULT 10,
  target_count INT DEFAULT 10,
  current_count INT DEFAULT 0,
  type TEXT CHECK (type IN ('roast', 'vote', 'share', 'follow')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_challenges_active ON challenges(is_active, created_at DESC) WHERE is_active = true;

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active challenges" ON challenges
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admin manage challenges" ON challenges
  FOR ALL USING (true);

-- ============================================================
-- PROFILES TABLE — Add missing columns if not present
-- ============================================================
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_letter TEXT;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_color TEXT;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tagline TEXT;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reaction_brutal INT DEFAULT 0;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reaction_haha INT DEFAULT 0;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reaction_cry INT DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- ROASTS TABLE — Add missing columns if not present
-- ============================================================
DO $$ BEGIN
  ALTER TABLE roasts ADD COLUMN IF NOT EXISTS reaction_cry INT DEFAULT 0;
  ALTER TABLE roasts ADD COLUMN IF NOT EXISTS is_clean BOOLEAN DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- USER_PROFILES TABLE — Add missing columns if not present
-- ============================================================
DO $$ BEGIN
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
