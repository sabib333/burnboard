-- ============================================================
-- BURNBOARD Analytics & Monetization Tables
-- Run after the main schema and security hardening
-- ============================================================

-- 1. ANALYTICS EVENTS TABLE
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id, created_at DESC);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Analytics read" ON analytics_events FOR SELECT USING (true);
CREATE POLICY "Analytics insert" ON analytics_events FOR INSERT WITH CHECK (true);

-- 2. WAITLIST TABLE (PRO tier interest)
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  feature TEXT DEFAULT 'pro',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_waitlist_email UNIQUE(email, feature)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Waitlist read" ON waitlist FOR SELECT USING (true);
CREATE POLICY "Waitlist insert" ON waitlist FOR INSERT WITH CHECK (true);

-- 3. REFERRALS TABLE (Viral growth tracking)
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referrer_username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Referrals read" ON referrals FOR SELECT USING (true);
CREATE POLICY "Referrals insert" ON referrals FOR INSERT WITH CHECK (true);
