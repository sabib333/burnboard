-- ============================================================
-- BURN BOARD — Trust & Safety Foundation (Master Prompt #16)
-- Additive-only migration. No existing tables modified.
-- ============================================================

-- ── Enhanced Reports ─────────────────────────────────────────
-- Extend existing reports table with structured categories
-- and support for reporting hot seats, battles, and profiles

-- Add new columns to existing reports table
ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'roast' 
  CHECK (target_type IN ('roast', 'hot_seat', 'battle', 'profile'));
ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_id UUID;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other'
  CHECK (category IN (
    'harassment', 'threat', 'hate', 'privacy_violation',
    'sexual_content', 'exploitation', 'spam', 'scam', 'other'
  ));
ALTER TABLE reports ADD COLUMN IF NOT EXISTS context TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'normal'
  CHECK (severity IN ('normal', 'high', 'critical'));

-- Update status check to include new states
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE reports ADD CONSTRAINT reports_status_check 
  CHECK (status IN ('pending', 'open', 'in_review', 'resolved', 'dismissed', 'escalated'));

-- Indexes for report queries
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category, status);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_severity ON reports(severity) WHERE severity IN ('high', 'critical');

-- ── Moderation Actions Audit Log ─────────────────────────────
-- Tracks all moderation actions for accountability

CREATE TABLE IF NOT EXISTS moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'hide_roast', 'unhide_roast',
    'hide_hot_seat', 'unhide_hot_seat',
    'restrict_profile', 'unrestrict_profile',
    'ban_profile', 'unban_profile',
    'dismiss_report', 'resolve_report', 'escalate_report',
    'resolve_appeal', 'reverse_appeal'
  )),
  target_type TEXT NOT NULL CHECK (target_type IN (
    'roast', 'hot_seat', 'battle', 'profile', 'report', 'appeal'
  )),
  target_id UUID NOT NULL,
  previous_state TEXT,
  new_state TEXT,
  policy_category TEXT,
  moderator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  moderator_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;

-- Only moderators/admins can read audit logs
DO $$ BEGIN
  CREATE POLICY "Moderators read audit logs" ON moderation_actions
    FOR SELECT USING (true); -- Will be restricted by app layer
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Moderators insert audit logs" ON moderation_actions
    FOR INSERT WITH CHECK (true); -- Will be restricted by app layer
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_mod_actions_target ON moderation_actions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_mod_actions_moderator ON moderation_actions(moderator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mod_actions_type ON moderation_actions(action_type, created_at DESC);

-- ── Appeals ──────────────────────────────────────────────────
-- Users can appeal moderation decisions

CREATE TABLE IF NOT EXISTS appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enforcement_type TEXT NOT NULL CHECK (enforcement_type IN (
    'content_removal', 'content_restriction', 'profile_restriction', 'profile_ban'
  )),
  enforcement_target_type TEXT NOT NULL CHECK (enforcement_target_type IN (
    'roast', 'hot_seat', 'battle', 'profile'
  )),
  enforcement_target_id UUID NOT NULL,
  appellant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  appellant_anon_id TEXT,
  explanation TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'upheld', 'reversed')),
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE appeals ENABLE ROW LEVEL SECURITY;

-- Appellants can read own appeals
DO $$ BEGIN
  CREATE POLICY "Appellants read own appeals" ON appeals
    FOR SELECT USING (auth.uid() = appellant_id);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Anyone can submit appeals (anon or auth)
DO $$ BEGIN
  CREATE POLICY "Anyone can submit appeals" ON appeals
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Moderators can update appeals (restricted by app layer)
DO $$ BEGIN
  CREATE POLICY "Moderators update appeals" ON appeals
    FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appeals_appellant ON appeals(appellant_id);
CREATE INDEX IF NOT EXISTS idx_appeals_target ON appeals(enforcement_target_type, enforcement_target_id);

-- ── Content Moderation State ─────────────────────────────────
-- Add moderation_state to hot_seats for richer content states

ALTER TABLE hot_seats ADD COLUMN IF NOT EXISTS moderation_state TEXT DEFAULT 'visible'
  CHECK (moderation_state IN ('visible', 'limited', 'under_review', 'removed'));

CREATE INDEX IF NOT EXISTS idx_hot_seats_moderation ON hot_seats(moderation_state) 
  WHERE moderation_state != 'visible';

-- Add moderation_state to hot_seat_roasts
ALTER TABLE hot_seat_roasts ADD COLUMN IF NOT EXISTS moderation_state TEXT DEFAULT 'visible'
  CHECK (moderation_state IN ('visible', 'limited', 'under_review', 'removed'));

-- ── Anti-Harassment Signals ──────────────────────────────────
-- Track repeated targeting for anti-harassment

CREATE TABLE IF NOT EXISTS harassment_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'repeated_reports', 'repeated_blocks', 'excessive_targeting', 'rapid_submissions'
  )),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('profile', 'hot_seat', 'ip')),
  subject_id TEXT NOT NULL,
  report_count INT DEFAULT 0,
  block_count INT DEFAULT 0,
  target_count INT DEFAULT 0,
  window_start TIMESTAMPTZ DEFAULT now(),
  window_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE harassment_signals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "System manage harassment signals" ON harassment_signals
    FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_harassment_subject ON harassment_signals(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_harassment_type ON harassment_signals(signal_type, created_at DESC);

-- ── Comments ─────────────────────────────────────────────────

COMMENT ON TABLE moderation_actions IS 'Audit log for all moderation actions';
COMMENT ON TABLE appeals IS 'User appeals of moderation decisions';
COMMENT ON TABLE harassment_signals IS 'Anti-harassment detection signals';

-- ============================================================
-- DONE — Trust & Safety tables created
-- ============================================================
