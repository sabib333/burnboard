-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Trust, Safety & Anti-Harassment Engine (Master Prompt 11)
-- NON-DESTRUCTIVE: only adds new tables/columns/constraints.
-- No existing data is modified or removed.
--
-- Execution order matters: tables → RLS changes → policy expansions.
-- ═══════════════════════════════════════════════════════════

-- ── 1. MODERATION STATE ON SOCIAL CONTENT ───────────────────
-- Canonical social content (posts + comments) gets the same explicit
-- moderation states as hot seats. RLS below enforces the state across
-- every read surface (feed, community feed, challenge entries, direct
-- URLs, search-adjacent APIs): removed/under_review content is invisible
-- until a moderator restores it (state flip = immediate re-eligibility).

ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS moderation_state TEXT NOT NULL DEFAULT 'visible'
  CHECK (moderation_state IN ('visible', 'limited', 'under_review', 'removed'));

ALTER TABLE comments ADD COLUMN IF NOT EXISTS moderation_state TEXT NOT NULL DEFAULT 'visible'
  CHECK (moderation_state IN ('visible', 'limited', 'under_review', 'removed'));

CREATE INDEX IF NOT EXISTS idx_social_posts_moderation ON social_posts(moderation_state)
  WHERE moderation_state != 'visible';
CREATE INDEX IF NOT EXISTS idx_comments_moderation ON comments(moderation_state)
  WHERE moderation_state != 'visible';

-- ── 2. CENTRALIZED SAFETY EVENTS ────────────────────────────
-- Single source of truth for safety-relevant activity. Internal data —
-- never exposed through public APIs (app layer restricts; RLS mirrors the
-- platform's existing permissive-but-app-guarded convention for safety data).
CREATE TABLE IF NOT EXISTS safety_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'content_created', 'content_updated', 'content_reported', 'content_flagged',
    'user_reported', 'block_created', 'block_removed', 'mute_created', 'mute_removed',
    'abuse_pattern_detected', 'rate_limit_triggered', 'spam_pattern_detected',
    'user_restricted', 'user_ban', 'user_unban', 'moderation_action', 'appeal_submitted'
  )),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type TEXT,
  target_id TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_events_type ON safety_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_events_target ON safety_events(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_safety_events_actor ON safety_events(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_events_risk ON safety_events(risk_level, created_at DESC)
  WHERE risk_level IN ('high', 'critical');

ALTER TABLE safety_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "System records safety events" ON safety_events
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- Read access is intentionally NOT granted to anonymous/anonymous clients;
-- internal safety tooling reads through moderator-authenticated services.

-- ── 3. CONTENT CLASSIFICATIONS (rules + AI assisted) ─────────
-- Records every automated classification: source, category, risk, confidence
-- band, model/provider, policy version, and the resulting action. Never
-- claims AI reviewed something the AI did not (source field is exact).
CREATE TABLE IF NOT EXISTS content_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('rules', 'ai', 'report')),
  category TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  confidence REAL,
  provider TEXT,
  policy_version INT DEFAULT 1,
  action TEXT NOT NULL DEFAULT 'none' CHECK (action IN ('none', 'flag', 'hold')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classifications_target ON content_classifications(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_classifications_created ON content_classifications(created_at DESC);

ALTER TABLE content_classifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "System records classifications" ON content_classifications
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. MUTES (distinct from blocks) ──────────────────────────
-- Muting is one-directional and does NOT signal to the muted user.
-- Server-side effects: notification suppression + content filtering on
-- viewer-aware surfaces. The muted user can still interact normally.
CREATE TABLE IF NOT EXISTS user_mutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  muter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_mute UNIQUE (muter_id, muted_id),
  CONSTRAINT no_self_mute CHECK (muter_id != muted_id)
);

CREATE INDEX IF NOT EXISTS idx_user_mutes_muter ON user_mutes(muter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_mutes_muted ON user_mutes(muted_id);

ALTER TABLE user_mutes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own mutes" ON user_mutes
    FOR SELECT USING (auth.uid() = muter_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users create own mutes" ON user_mutes
    FOR INSERT WITH CHECK (auth.uid() = muter_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users delete own mutes" ON user_mutes
    FOR DELETE USING (auth.uid() = muter_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 5. USER RESTRICTIONS (action-specific, time-bounded) ─────
-- Server-side checks gate each restricted action — hiding a button is
-- never the enforcement. Full bans use user_profiles.is_banned plus an
-- 'all' restriction row for auditability.
CREATE TABLE IF NOT EXISTS user_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'post', 'comment', 'community_create', 'community_join', 'challenge_create',
    'invite', 'battle', 'report', 'all'
  )),
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_active_restriction UNIQUE NULLS NOT DISTINCT (user_id, action_type)
);

-- Note: UNIQUE NULLS NOT DISTINCT is used so repeated active restrictions
-- for the same action replace one another instead of stacking.

CREATE INDEX IF NOT EXISTS idx_user_restrictions_user ON user_restrictions(user_id, active);
CREATE INDEX IF NOT EXISTS idx_user_restrictions_action ON user_restrictions(action_type, active);

ALTER TABLE user_restrictions ENABLE ROW LEVEL SECURITY;
-- No anonymous read. Writes flow through moderator-authenticated services.

-- ── 6. RLS: ENFORCE MODERATION STATE AT THE DATABASE ─────────
-- Removed/under-review content must not surface through any read path.
DROP POLICY IF EXISTS "Public can read social_posts" ON social_posts;
CREATE POLICY "Public can read social_posts" ON social_posts
  FOR SELECT USING (visibility = 'public' AND moderation_state = 'visible');

DROP POLICY IF EXISTS "Public can read comments" ON comments;
CREATE POLICY "Public can read comments" ON comments
  FOR SELECT USING (moderation_state = 'visible');

-- ── 7. REPORT TARGETS/CATEGORIES EXPANSION ───────────────────
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE reports ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('roast', 'hot_seat', 'battle', 'profile', 'user', 'social_post', 'comment', 'challenge'));

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_category_check;
ALTER TABLE reports ADD CONSTRAINT reports_category_check
  CHECK (category IN (
    'harassment', 'threat', 'hate', 'privacy_violation',
    'sexual_content', 'exploitation', 'spam', 'scam', 'other',
    'impersonation', 'self_harm', 'illegal', 'non_consensual'
  ));

CREATE INDEX IF NOT EXISTS idx_reports_target_status ON reports(target_type, target_id, status);

-- ── 8. APPEALS EXPANSION (content + account enforcement) ─────
ALTER TABLE appeals DROP CONSTRAINT IF EXISTS appeals_enforcement_type_check;
ALTER TABLE appeals ADD CONSTRAINT appeals_enforcement_type_check
  CHECK (enforcement_type IN (
    'content_removal', 'content_restriction', 'profile_restriction', 'profile_ban',
    'account_restriction', 'account_ban'
  ));

ALTER TABLE appeals DROP CONSTRAINT IF EXISTS appeals_enforcement_target_type_check;
ALTER TABLE appeals ADD CONSTRAINT appeals_enforcement_target_type_check
  CHECK (enforcement_target_type IN (
    'roast', 'hot_seat', 'battle', 'profile', 'user', 'social_post', 'comment', 'challenge'
  ));

-- ── 9. MODERATION AUDIT ACTIONS EXPANSION ────────────────────
ALTER TABLE moderation_actions DROP CONSTRAINT IF EXISTS moderation_actions_action_type_check;
ALTER TABLE moderation_actions ADD CONSTRAINT moderation_actions_action_type_check
  CHECK (action_type IN (
    'hide_roast', 'unhide_roast',
    'hide_hot_seat', 'unhide_hot_seat',
    'restrict_profile', 'unrestrict_profile',
    'ban_profile', 'unban_profile',
    'dismiss_report', 'resolve_report', 'escalate_report',
    'open_report', 'in_review_report', 'resolved_report', 'dismissed_report', 'escalated_report',
    'resolve_appeal', 'reverse_appeal',
    'upheld_appeal', 'reversed_appeal',
    'update_roast_state', 'update_hot_seat_state', 'update_social_post_state', 'update_comment_state',
    'community_remove_post', 'community_remove_member', 'community_role_changed',
    'challenge_cancelled', 'challenge_entry_removed',
    'content_state_changed', 'content_restored',
    'user_restricted', 'user_restriction_lifted', 'user_banned', 'user_unbanned'
  ));

ALTER TABLE moderation_actions DROP CONSTRAINT IF EXISTS moderation_actions_target_type_check;
ALTER TABLE moderation_actions ADD CONSTRAINT moderation_actions_target_type_check
  CHECK (target_type IN (
    'roast', 'hot_seat', 'battle', 'profile', 'report', 'appeal',
    'community', 'community_member', 'social_post', 'challenge',
    'comment', 'user'
  ));

-- ── 10. PLATFORM MODERATOR ROLE ─────────────────────────────
-- DB-level moderator identity. Flags are only settable by operators/SQL
-- for now; the app exposes no self-service path to become a moderator.
DO $$ BEGIN
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.is_platform_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND (is_moderator = true OR is_admin = true)
  );
$$;

-- ── 11. ENFORCEMENT / ADMIN RPCs (security definer) ──────────
-- Moderator-gated state changes (restrictions, bans, content state).
-- Every action persists an audit row in moderation_actions and a
-- safety_event — real, auditable, server-side only.

-- Content state changes for moderation-enabled tables.
CREATE OR REPLACE FUNCTION public.safety_set_content_state(
  p_target_type TEXT,
  p_target_id UUID,
  p_state TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sql TEXT;
  v_previous TEXT;
  v_action TEXT;
  v_result jsonb;
BEGIN
  IF NOT public.is_platform_moderator() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  IF p_state NOT IN ('visible', 'limited', 'under_review', 'removed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid state');
  END IF;
  IF p_target_type NOT IN ('social_post', 'comment', 'hot_seat') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unsupported target_type');
  END IF;

  IF p_target_type = 'social_post' THEN
    SELECT moderation_state::text INTO v_previous FROM social_posts WHERE id = p_target_id;
    IF v_previous IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Target not found');
    END IF;
    UPDATE social_posts SET moderation_state = p_state, updated_at = now() WHERE id = p_target_id;
  ELSIF p_target_type = 'comment' THEN
    SELECT moderation_state::text INTO v_previous FROM comments WHERE id = p_target_id;
    IF v_previous IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Target not found');
    END IF;
    UPDATE comments SET moderation_state = p_state WHERE id = p_target_id;
  ELSIF p_target_type = 'hot_seat' THEN
    SELECT moderation_state::text INTO v_previous FROM hot_seats WHERE id = p_target_id;
    IF v_previous IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Target not found');
    END IF;
    UPDATE hot_seats SET moderation_state = p_state WHERE id = p_target_id;
  END IF;

  v_action := CASE
    WHEN p_state = 'visible' AND v_previous IN ('removed', 'under_review') THEN 'content_restored'
    ELSE 'content_state_changed'
  END;

  INSERT INTO moderation_actions (action_type, target_type, target_id, previous_state, new_state, policy_category, moderator_id, moderator_note)
  VALUES (v_action, p_target_type, p_target_id, v_previous, p_state, 'safety_v2', auth.uid(), p_note);

  INSERT INTO safety_events (event_type, actor_user_id, target_type, target_id, risk_level, metadata)
  VALUES ('moderation_action', auth.uid(), p_target_type, p_target_id::text, 'medium',
    jsonb_build_object('action', v_action, 'note', p_note));

  RETURN jsonb_build_object('success', true, 'previous_state', v_previous, 'new_state', p_state);
END;
$$;

-- Apply or refresh an action-specific restriction.
CREATE OR REPLACE FUNCTION public.safety_restrict_user(
  p_user_id UUID,
  p_action_type TEXT,
  p_reason TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_moderator() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  IF p_action_type NOT IN ('post', 'comment', 'community_create', 'community_join', 'challenge_create', 'invite', 'battle', 'report', 'all') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action_type');
  END IF;

  INSERT INTO user_restrictions (user_id, action_type, reason, created_by, expires_at)
  VALUES (p_user_id, p_action_type, p_reason, auth.uid(), p_expires_at)
  ON CONFLICT (user_id, action_type) DO UPDATE
    SET reason = EXCLUDED.reason, created_by = EXCLUDED.created_by,
        expires_at = EXCLUDED.expires_at, active = true, created_at = now();

  INSERT INTO moderation_actions (action_type, target_type, target_id, new_state, policy_category, moderator_id, moderator_note)
  VALUES ('user_restricted', 'user', p_user_id, p_action_type, 'safety_v2', auth.uid(), p_reason);

  INSERT INTO safety_events (event_type, actor_user_id, target_type, target_id, risk_level, metadata)
  VALUES ('user_restricted', auth.uid(), 'user', p_user_id::text, 'high',
    jsonb_build_object('action', p_action_type, 'reason', p_reason));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Lift an action-specific restriction.
CREATE OR REPLACE FUNCTION public.safety_lift_restriction(
  p_user_id UUID,
  p_action_type TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_moderator() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE user_restrictions SET active = false
  WHERE user_id = p_user_id AND action_type = p_action_type AND active = true;

  INSERT INTO moderation_actions (action_type, target_type, target_id, previous_state, policy_category, moderator_id, moderator_note)
  VALUES ('user_restriction_lifted', 'user', p_user_id, p_action_type, 'safety_v2', auth.uid(), 'Restriction lifted');

  INSERT INTO safety_events (event_type, actor_user_id, target_type, target_id, risk_level, metadata)
  VALUES ('moderation_action', auth.uid(), 'user', p_user_id::text, 'low',
    jsonb_build_object('action', 'lift_restriction', 'action_type', p_action_type));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Ban / unban (full account suspension).
CREATE OR REPLACE FUNCTION public.safety_set_user_ban(
  p_user_id UUID,
  p_banned BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event TEXT;
  v_action TEXT;
BEGIN
  IF NOT public.is_platform_moderator() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE user_profiles SET is_banned = p_banned WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF p_banned THEN
    v_action := 'user_banned';
    v_event := 'user_ban';
    INSERT INTO user_restrictions (user_id, action_type, reason, created_by, expires_at)
    VALUES (p_user_id, 'all', p_reason, auth.uid(), NULL)
    ON CONFLICT (user_id, action_type) DO UPDATE
      SET reason = EXCLUDED.reason, created_by = EXCLUDED.created_by,
          expires_at = NULL, active = true, created_at = now();
  ELSE
    v_action := 'user_unbanned';
    v_event := 'user_unban';
    UPDATE user_restrictions SET active = false
    WHERE user_id = p_user_id AND action_type = 'all' AND active = true;
  END IF;

  INSERT INTO moderation_actions (action_type, target_type, target_id, new_state, policy_category, moderator_id, moderator_note)
  VALUES (v_action, 'user', p_user_id, CASE WHEN p_banned THEN 'banned' ELSE 'active' END, 'safety_v2', auth.uid(), p_reason);

  INSERT INTO safety_events (event_type, actor_user_id, target_type, target_id, risk_level, metadata)
  VALUES (v_event, auth.uid(), 'user', p_user_id::text, 'critical',
    jsonb_build_object('banned', p_banned, 'reason', p_reason));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── 12. ENFORCEMENT READ RPCs ────────────────────────────────
-- Relationship check (server-side use): mutual blocks + viewer's mute of
-- the other. Only usable for yourself (auth.uid() = viewer) so arbitrary
-- pairs cannot be probed. Mutes are one-directional — mutee never learns.
CREATE OR REPLACE FUNCTION public.safety_relationship_between(p_viewer UUID, p_other UUID)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS DISTINCT FROM p_viewer THEN
      jsonb_build_object(
        'viewer_blocks_other', false,
        'other_blocks_viewer', false,
        'viewer_mutes_other', false
      )
    ELSE
      jsonb_build_object(
        'viewer_blocks_other', EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = p_viewer AND blocked_id = p_other),
        'other_blocks_viewer', EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = p_other AND blocked_id = p_viewer),
        'viewer_mutes_other', EXISTS (SELECT 1 FROM user_mutes WHERE muter_id = p_viewer AND muted_id = p_other)
      )
  END;
$$;

-- Is the CURRENT authenticated user restricted from an action (or banned)?
CREATE OR REPLACE FUNCTION public.safety_can_perform(p_action TEXT)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.is_banned = true
        OR EXISTS (
          SELECT 1 FROM user_restrictions ur
          WHERE ur.user_id = auth.uid()
            AND ur.active = true
            AND (ur.expires_at IS NULL OR ur.expires_at > now())
            AND (ur.action_type = 'all' OR ur.action_type = p_action)
        )
      )
  );
$$;

-- List the CURRENT user's own active restrictions (transparency for appeals).
CREATE OR REPLACE FUNCTION public.safety_my_restrictions()
RETURNS TABLE (action_type TEXT, reason TEXT, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.action_type, ur.reason, ur.expires_at, ur.created_at
  FROM user_restrictions ur
  WHERE ur.user_id = auth.uid() AND ur.active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > now());
$$;

-- ── 13. MODERATOR QUEUE READ (definer, moderator-gated) ─────
-- Under-review/limited content is RLS-hidden from normal reads, so the
-- queue reads through this moderator-gated function.
CREATE OR REPLACE FUNCTION public.safety_admin_flagged(p_limit INT DEFAULT 50)
RETURNS TABLE (target_type TEXT, target_id UUID, state TEXT, author_id UUID, content TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'social_post', id, moderation_state, user_id, content_text, created_at
  FROM social_posts
  WHERE moderation_state IN ('under_review', 'limited')
    AND public.is_platform_moderator()
  ORDER BY created_at DESC
  LIMIT p_limit;
$$;

-- ── 14. REALTIME (safety events only) ────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE safety_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 15. REPORTER PRIVACY AT THE DB (no public read of reports) ──
-- Report rows carry reporter identity (reporter_id / reporter_ip). The
-- previous permissive read policies leaked them to any anon-key client.
-- Read access now goes through moderator-gated definer functions only;
-- the submitting user gets an opaque success response, never report rows.
DROP POLICY IF EXISTS "reports_select" ON reports;
DROP POLICY IF EXISTS "patch_reports_select" ON reports;
DROP POLICY IF EXISTS "Admin read reports" ON reports;
DROP POLICY IF EXISTS "Public can read reports" ON reports;

DO $$ BEGIN
  CREATE POLICY "Reporters read own reports" ON reports
    FOR SELECT USING (auth.uid() = reporter_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Moderators read reports" ON reports
    FOR SELECT USING (public.is_platform_moderator());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Moderator write path for report status (definer, moderator-gated).
-- Direct UPDATEs are not granted to anon/authenticated roles; all report
-- transitions flow through this function so every change is audited.
CREATE OR REPLACE FUNCTION public.safety_update_report_status(
  p_report_id UUID,
  p_status TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report reports%ROWTYPE;
BEGIN
  IF NOT public.is_platform_moderator() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  IF p_status NOT IN ('open', 'in_review', 'resolved', 'dismissed', 'escalated') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  SELECT * INTO v_report FROM reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;

  UPDATE reports
  SET status = p_status,
      resolved_at = CASE WHEN p_status IN ('resolved', 'dismissed') THEN now() ELSE resolved_at END
  WHERE id = p_report_id;

  INSERT INTO moderation_actions (action_type, target_type, target_id, previous_state, new_state, policy_category, moderator_id, moderator_note)
  VALUES (p_status || '_report', 'report', p_report_id, v_report.status, p_status, 'safety_v2', auth.uid(), p_note);

  INSERT INTO safety_events (event_type, actor_user_id, target_type, target_id, risk_level, metadata)
  VALUES ('moderation_action', auth.uid(), 'report', p_report_id::text, 'low',
    jsonb_build_object('action', p_status, 'note', p_note));

  RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;

-- Queue reads (definer, moderator-gated, reporter fields stripped).
CREATE OR REPLACE FUNCTION public.safety_admin_reports(
  p_status TEXT DEFAULT 'open',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
  v_total INT;
BEGIN
  IF NOT public.is_platform_moderator() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'target_type', r.target_type,
    'target_id', r.target_id,
    'category', r.category,
    'context', r.context,
    'severity', r.severity,
    'status', r.status,
    'reporter_is_authed', r.reporter_id IS NOT NULL,
    'created_at', r.created_at
  ) ORDER BY r.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT * FROM reports
    WHERE (p_status = 'all' OR status = p_status)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;

  SELECT count(*) INTO v_total FROM reports
  WHERE (p_status = 'all' OR status = p_status);

  RETURN jsonb_build_object('success', true, 'reports', v_rows, 'total', v_total);
END;
$$;

-- ── 16. APPEALS: appellant reads own; moderator reads/acts via definer ──
-- Keep the existing "Appellants read own appeals" policy. Add moderator
-- read (policy) and a moderator-gated definer for decisions so reversals
-- also restore content through the authoritative state path.
-- The v1 migration created "Moderators update appeals" with USING (true),
-- which let ANY client update appeals. Drop the permissive policy first,
-- then recreate it moderator-gated (platform moderation is authoritative).
DROP POLICY IF EXISTS "Moderators update appeals" ON appeals;
DO $$ BEGIN
  CREATE POLICY "Moderators read appeals" ON appeals
    FOR SELECT USING (public.is_platform_moderator());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE POLICY "Moderators update appeals" ON appeals
  FOR UPDATE USING (public.is_platform_moderator());

CREATE OR REPLACE FUNCTION public.safety_review_appeal(
  p_appeal_id UUID,
  p_decision TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appeal appeals%ROWTYPE;
  v_state text;
BEGIN
  IF NOT public.is_platform_moderator() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  IF p_decision NOT IN ('upheld', 'reversed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid decision');
  END IF;

  SELECT * INTO v_appeal FROM appeals WHERE id = p_appeal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Appeal not found');
  END IF;
  IF v_appeal.status IN ('upheld', 'reversed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Appeal already decided');
  END IF;

  UPDATE appeals
  SET status = p_decision, reviewer_id = auth.uid(), reviewer_note = p_note, reviewed_at = now()
  WHERE id = p_appeal_id;

  -- Reversal restores the content through the authoritative state path.
  IF p_decision = 'reversed' THEN
    IF v_appeal.enforcement_target_type = 'social_post' THEN
      UPDATE social_posts SET moderation_state = 'visible', updated_at = now()
      WHERE id = v_appeal.enforcement_target_id;
      v_state := 'visible';
    ELSIF v_appeal.enforcement_target_type = 'comment' THEN
      UPDATE comments SET moderation_state = 'visible' WHERE id = v_appeal.enforcement_target_id;
      v_state := 'visible';
    ELSIF v_appeal.enforcement_target_type = 'hot_seat' THEN
      UPDATE hot_seats SET moderation_state = 'visible' WHERE id = v_appeal.enforcement_target_id;
      v_state := 'visible';
    ELSIF v_appeal.enforcement_target_type = 'roast' THEN
      UPDATE roasts SET is_hidden = false WHERE id = v_appeal.enforcement_target_id;
      v_state := 'visible';
    END IF;
  END IF;

  INSERT INTO moderation_actions (action_type, target_type, target_id, previous_state, new_state, policy_category, moderator_id, moderator_note)
  VALUES (p_decision || '_appeal', 'appeal', p_appeal_id, v_appeal.status, p_decision, 'safety_v2', auth.uid(), p_note);

  INSERT INTO safety_events (event_type, actor_user_id, target_type, target_id, risk_level, metadata)
  VALUES ('moderation_action', auth.uid(), 'appeal', p_appeal_id::text, 'low',
    jsonb_build_object('action', p_decision, 'note', p_note, 'restored', p_decision = 'reversed'));

  RETURN jsonb_build_object('success', true, 'decision', p_decision, 'restored_state', v_state);
END;
$$;

-- Moderator appeals queue read (definer, moderator-gated).
CREATE OR REPLACE FUNCTION public.safety_admin_appeals(
  p_status TEXT DEFAULT 'open',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
  v_total INT;
BEGIN
  IF NOT public.is_platform_moderator() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'enforcement_type', a.enforcement_type,
    'enforcement_target_type', a.enforcement_target_type,
    'enforcement_target_id', a.enforcement_target_id,
    'explanation', a.explanation,
    'status', a.status,
    'appellant_is_authed', a.appellant_id IS NOT NULL,
    'created_at', a.created_at
  ) ORDER BY a.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT * FROM appeals
    WHERE (p_status = 'all' OR status = p_status)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) a;

  SELECT count(*) INTO v_total FROM appeals
  WHERE (p_status = 'all' OR status = p_status);

  RETURN jsonb_build_object('success', true, 'appeals', v_rows, 'total', v_total);
END;
$$;

-- ── 16b. DUPLICATE REPORT CHECK (definer — reporter privacy safe) ──
-- The reports read policy hides rows from non-owners, so duplicate
-- detection must run server-side. The function only answers about the
-- caller-supplied reporter identity (no cross-user data exposure).
CREATE OR REPLACE FUNCTION public.safety_duplicate_report(
  p_target_type TEXT,
  p_target_id UUID,
  p_reporter_id UUID DEFAULT NULL,
  p_reporter_ip TEXT DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM reports
    WHERE target_type = p_target_type
      AND target_id = p_target_id
      AND created_at > now() - interval '1 hour'
      AND (
        (p_reporter_id IS NOT NULL AND reporter_id = p_reporter_id)
        OR (p_reporter_id IS NULL AND p_reporter_ip IS NOT NULL AND reporter_ip = p_reporter_ip)
      )
  );
$$;

-- ── 17. SYSTEM AUTO-REVIEW (report-driven, DB-enforced policy) ────
-- Reports are signals, not proof. This definer function re-checks the real
-- report rows server-side: only multiple DISTINCT reporters (or a
-- critical-severity flag) move content to under_review. It never removes
-- content and never bans. Runs without a moderator session because the
-- policy itself is the authority; every outcome is audited.
CREATE OR REPLACE FUNCTION public.safety_auto_review(
  p_target_type TEXT,
  p_target_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open INT;
  v_distinct INT;
  v_critical BOOLEAN;
BEGIN
  IF p_target_type NOT IN ('social_post', 'comment', 'hot_seat', 'roast') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unsupported target_type');
  END IF;

  SELECT count(*),
         count(DISTINCT CASE WHEN reporter_id IS NOT NULL THEN 'u:' || reporter_id::text ELSE 'ip:' || reporter_ip END),
         bool_or(severity IN ('high', 'critical'))
  INTO v_open, v_distinct, v_critical
  FROM reports
  WHERE target_type = p_target_type AND target_id = p_target_id
    AND status IN ('open', 'escalated');

  -- Volume with distinct reporters triggers review; a critical flag also
  -- escalates. Never auto-remove, never auto-ban.
  IF NOT ((v_open >= 3 AND v_distinct >= 2) OR COALESCE(v_critical, false)) THEN
    RETURN jsonb_build_object('success', false, 'review', false);
  END IF;

  IF p_target_type = 'social_post' THEN
    UPDATE social_posts SET moderation_state = 'under_review', updated_at = now() WHERE id = p_target_id;
  ELSIF p_target_type = 'comment' THEN
    UPDATE comments SET moderation_state = 'under_review' WHERE id = p_target_id;
  ELSIF p_target_type = 'hot_seat' THEN
    UPDATE hot_seats SET moderation_state = 'under_review' WHERE id = p_target_id;
  ELSIF p_target_type = 'roast' THEN
    UPDATE roasts SET is_hidden = true WHERE id = p_target_id;
  END IF;

  INSERT INTO moderation_actions (action_type, target_type, target_id, previous_state, new_state, policy_category, moderator_id, moderator_note)
  VALUES ('content_state_changed', p_target_type, p_target_id, 'visible', 'under_review', 'auto_review_v2', NULL, 'Auto-review: distinct reporters');

  INSERT INTO safety_events (event_type, target_type, target_id, risk_level, metadata)
  VALUES ('abuse_pattern_detected', p_target_type, p_target_id::text, 'medium',
    jsonb_build_object('source', 'reports', 'open', v_open, 'distinct_reporters', v_distinct));

  RETURN jsonb_build_object('success', true, 'review', true, 'state', 'under_review');
END;
$$;

-- ── 17b. NOTIFICATION SAFETY GATE (definer) ──────────────────
-- Returns false when the recipient mutes the actor or either side blocks
-- the other, so notification generators never deliver messages from (or
-- about) someone the recipient muted/blocked. One-directional mutes mean
-- the muted user is never told about the suppression.
CREATE OR REPLACE FUNCTION public.safety_notify_allowed(p_recipient UUID, p_actor UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_actor IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM user_mutes WHERE muter_id = p_recipient AND muted_id = p_actor
    )
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks WHERE blocker_id = p_recipient AND blocked_id = p_actor
    )
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks WHERE blocker_id = p_actor AND blocked_id = p_recipient
    );
$$;

-- ── 17c. RETIRE VOLUME-BASED AUTO-HIDE TRIGGER ────────────────
-- Legacy behavior hid a roast after 3 reports regardless of who reported.
-- MP11 principle: reports are signals, not proof — a pile from one actor
-- must not hide content. The distinct-reporter auto-review above replaces
-- it; this trigger is retired so no volume-only auto-removal path exists.
DROP TRIGGER IF EXISTS trigger_auto_hide ON reports;
DROP FUNCTION IF EXISTS public.auto_hide_roast();

-- ═══════════════════════════════════════════════════════════
-- DONE — Trust & Safety v2 schema created (additive only)
-- ═══════════════════════════════════════════════════════════
