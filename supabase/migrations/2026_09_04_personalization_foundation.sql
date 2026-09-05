-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Personalization, Recommendation & For You Engine (Master Prompt 12)
-- NON-DESTRUCTIVE: only adds new tables, indexes, and RLS policies.
-- Does NOT modify, rename, or delete any existing data or table.
--
-- Execution order matters: tables → indexes → RLS.
--
-- Principles enforced here:
--   * Signals are only ever written for the authenticated actor
--     (auth.uid() = user_id) — no client can record behavior for others.
--   * Derived interest data is readable only by its owner. Nothing here is
--     visible to anonymous/anonymous-key clients, other users, or search.
--   * No fake data is inserted — every table starts empty.
--   * Moderation/safety data stays authoritative and untouched.
-- ═══════════════════════════════════════════════════════════

-- ── 1. BEHAVIORAL SIGNAL LOG (server-validated) ─────────────
-- One row per legitimate platform behavior (react, comment, follow, join,
-- participate, negative feedback...). Idempotency keys protect against
-- duplicate/replayed writes; weights are assigned server-side only.
CREATE TABLE IF NOT EXISTS rec_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'content_viewed', 'content_opened',
    'content_reacted', 'content_commented', 'content_replied', 'content_shared',
    'content_hidden', 'not_interested', 'show_less_creator',
    'user_followed', 'user_unfollowed',
    'community_joined', 'community_left',
    'challenge_participated', 'challenge_invite_accepted',
    'battle_voted', 'topic_viewed'
  )),
  target_type TEXT NOT NULL CHECK (target_type IN (
    'social_post', 'roast', 'comment', 'user', 'community', 'challenge', 'battle', 'topic'
  )),
  target_id UUID,
  weight REAL NOT NULL DEFAULT 1 CHECK (weight > 0 AND weight <= 10),
  -- Context enriches the raw event: author_id, community_id, content_type,
  -- polarity ('positive' | 'negative'), topic_ids, source...
  context JSONB NOT NULL DEFAULT '{}',
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rec_events_user ON rec_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rec_events_user_event ON rec_events(user_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rec_events_target ON rec_events(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_rec_events_recent ON rec_events(created_at DESC);

-- Replay protection: a given (user, idempotency key) may only land once.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rec_events_idempotency
  ON rec_events(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── 2. USER FEEDBACK (content-level, real user-content relationship) ──
-- Hiding / "Not interested" lives in the database (never only browser
-- state), so hidden content cannot keep returning across sessions/devices.
CREATE TABLE IF NOT EXISTS rec_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('social_post', 'roast')),
  target_id UUID NOT NULL,
  -- 'hide' suppresses this item only; 'not_interested' also applies
  -- proportional negative learning to the captured scopes below.
  action TEXT NOT NULL CHECK (action IN ('hide', 'not_interested')),
  -- Snapshot of the content's attributes at feedback time so negative
  -- learning stays proportional and explainable:
  --   { author_id, community_id, content_type, community_topic_ids }
  scope JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_content_feedback UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_rec_feedback_user ON rec_feedback(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rec_feedback_target ON rec_feedback(target_type, target_id);

-- ── 3. INTEREST GRAPH (derived affinity, owner-readable only) ──
-- Conceptually: USER → signals → TOPICS / COMMUNITIES / CREATORS /
-- CONTENT TYPES. Scores are derived server-side from real behavior or
-- explicit choices — never guessed, never public.
CREATE TABLE IF NOT EXISTS user_affinities (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL CHECK (dimension IN ('topic', 'creator', 'community', 'content_type')),
  key TEXT NOT NULL,
  label TEXT,
  positive REAL NOT NULL DEFAULT 0,
  negative REAL NOT NULL DEFAULT 0,
  signal_count INT NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_positive_at TIMESTAMPTZ,
  last_negative_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dimension, key)
);

CREATE INDEX IF NOT EXISTS idx_user_affinities_user ON user_affinities(user_id, dimension, positive DESC);

-- ── 4. EXPLICIT INTERESTS (cold start / onboarding) ─────────
-- Explicit Topic selection reuses the Master Prompt 8 `topics` table —
-- no duplicate topic system is created.
CREATE TABLE IF NOT EXISTS user_interests (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'onboarding',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_user_interests_topic ON user_interests(topic_id);

-- ── 5. PERSONALIZATION SETTINGS (user-controlled) ───────────
-- Supports: personalization on/off, interest reset tracking, and future
-- data controls without schema churn.
CREATE TABLE IF NOT EXISTS user_personalization (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  interests_selected BOOLEAN NOT NULL DEFAULT false,
  interests_updated_at TIMESTAMPTZ,
  reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — every table is strictly owner-scoped.
-- Anonymous/anonymous-key reads return nothing (no auth.uid()).
-- ═══════════════════════════════════════════════════════════

-- rec_events: owner reads + writes only
ALTER TABLE rec_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own rec events" ON rec_events
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users record own rec events" ON rec_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- Owner delete only: used by the viewer's own "Reset personalization"
-- control. Nothing else may delete signals.
DO $$ BEGIN
  CREATE POLICY "Users delete own rec events" ON rec_events
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- rec_feedback: owner full CRUD
ALTER TABLE rec_feedback ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own feedback" ON rec_feedback
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users write own feedback" ON rec_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users update own feedback" ON rec_feedback
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users delete own feedback" ON rec_feedback
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- user_affinities: owner reads + maintenance writes only
ALTER TABLE user_affinities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own affinities" ON user_affinities
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users update own affinities" ON user_affinities
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users maintain own affinities" ON user_affinities
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- Owner delete only: used by the viewer's own "Reset personalization".
DO $$ BEGIN
  CREATE POLICY "Users delete own affinities" ON user_affinities
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- user_interests: owner reads + explicit writes
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own interests" ON user_interests
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users set own interests" ON user_interests
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users clear own interests" ON user_interests
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- user_personalization: owner reads + writes
ALTER TABLE user_personalization ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own personalization" ON user_personalization
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users create own personalization" ON user_personalization
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users update own personalization" ON user_personalization
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- DONE — Personalization foundation schema created (additive only)
-- ═══════════════════════════════════════════════════════════
