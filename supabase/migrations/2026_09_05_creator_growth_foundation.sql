-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Creator Economy, Identity & Creator Growth Engine (Master Prompt 13)
-- NON-DESTRUCTIVE: only adds new tables, columns, indexes, and RPC functions.
-- Does NOT modify, rename, or delete any existing data or table.
--
-- Principles enforced here:
--   * Every creator metric derives from REAL platform data (posts, roasts,
--     follows, reactions, comments). No table is ever pre-seeded with fake
--     activity.
--   * Milestones cannot be forged: clients have NO direct write access to
--     creator_milestones. A SECURITY DEFINER function recomputes thresholds
--     from live tables and inserts only genuinely earned milestones.
--   * Creator topics are public identity (like a bio) but only the owner can
--     write them.
--   * The views counter reads the Master Prompt 12 rec_events log (real feed
--     impressions recorded server-side per signed-in member, deduped per day).
--     If rec_events is absent the function is simply not created — the app
--     degrades gracefully and shows no fake number.
-- ═══════════════════════════════════════════════════════════

-- ── 1. CREATOR TOPICS (controlled identity associations) ───
-- Reuses the Master Prompt 8 `topics` table — no duplicate topic system.
-- A creator associates with a small, controlled set of Topics describing what
-- they create. Public identity; owner-only writes.
CREATE TABLE IF NOT EXISTS creator_topics (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_topics_topic ON creator_topics(topic_id);

ALTER TABLE creator_topics ENABLE ROW LEVEL SECURITY;
-- Public read: these are identity tags shown on a public profile (like bio).
DO $$ BEGIN
  CREATE POLICY "Anyone can read creator topics" ON creator_topics
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Owners set their creator topics" ON creator_topics
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Owners remove their creator topics" ON creator_topics
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. CREATOR MILESTONES (real, unforgeable achievements) ─
-- Written ONLY by the SECURITY DEFINER function below after recomputing real
-- thresholds. No direct client insert/update/delete policies exist.
CREATE TABLE IF NOT EXISTS creator_milestones (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_key TEXT NOT NULL,
  value BIGINT NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}',
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, milestone_key)
);

CREATE INDEX IF NOT EXISTS idx_creator_milestones_user ON creator_milestones(user_id, achieved_at DESC);

ALTER TABLE creator_milestones ENABLE ROW LEVEL SECURITY;
-- Owner-only read: personal growth history is not public until BurnBoard
-- ships an explicit profile-celebration surface.
DO $$ BEGIN
  CREATE POLICY "Owners read their milestones" ON creator_milestones
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. ENHANCED PROFILE COLUMNS (additive) ────────────────
-- website_url: a creator's link-in-bio (public identity).
-- featured_post_id: optional pinned content, validated for ownership +
--   moderation at set-time and again at read-time. FK keeps it coherent when
--   the post is deleted (auto-clears) — never points at missing content.
DO $$ BEGIN
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS website_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS featured_post_id UUID
    REFERENCES social_posts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── 4. ANALYTICS INDEXES (query efficiency, additive) ─────
-- Follower-growth series + audience queries group by following_id + date.
CREATE INDEX IF NOT EXISTS idx_follows_following_created
  ON follows(following_id, created_at DESC);

-- Creator content library: own posts newest-first.
CREATE INDEX IF NOT EXISTS idx_social_posts_user_created
  ON social_posts(user_id, created_at DESC);

-- Engagement lookups target a content id across types.
CREATE INDEX IF NOT EXISTS idx_comments_target_created
  ON comments(target_type, target_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- RPC — creator_totals(p_user, p_days)
-- Real aggregate counts (posts, roasts, followers, reactions received,
-- comments received) for one creator over a window (0 = all time).
-- SECURITY DEFINER so the owner can see engagement on their own content
-- regardless of per-row read policies. Mirrors exactly what the platform
-- tables hold — nothing derived or invented.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION creator_totals(p_user UUID, p_days INTEGER DEFAULT 0)
RETURNS TABLE(posts BIGINT, roasts BIGINT, followers BIGINT, reactions BIGINT, comments BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d INTERVAL;
BEGIN
  IF p_user IS NULL THEN
    RETURN;
  END IF;
  d := CASE WHEN p_days > 0 THEN make_interval(days => p_days) ELSE NULL END;

  RETURN QUERY
  SELECT
    (SELECT count(*)::BIGINT FROM social_posts sp
      WHERE sp.user_id = p_user AND (d IS NULL OR sp.created_at >= now() - d)),
    (SELECT count(*)::BIGINT FROM roasts rw
      WHERE rw.user_id = p_user AND (d IS NULL OR rw.created_at >= now() - d)),
    (SELECT count(*)::BIGINT FROM follows f
      WHERE f.following_id = p_user AND (d IS NULL OR f.created_at >= now() - d)),
    (SELECT count(*)::BIGINT FROM reactions r
      WHERE (d IS NULL OR r.created_at >= now() - d)
        AND ((r.target_type = 'social_post' AND EXISTS
                (SELECT 1 FROM social_posts sp WHERE sp.id = r.target_id AND sp.user_id = p_user))
          OR (r.target_type = 'roast' AND EXISTS
                (SELECT 1 FROM roasts rw WHERE rw.id = r.target_id AND rw.user_id = p_user)))),
    (SELECT count(*)::BIGINT FROM comments c
      WHERE (d IS NULL OR c.created_at >= now() - d)
        AND ((c.target_type = 'social_post' AND EXISTS
                (SELECT 1 FROM social_posts sp WHERE sp.id = c.target_id AND sp.user_id = p_user))
          OR (c.target_type = 'roast' AND EXISTS
                (SELECT 1 FROM roasts rw WHERE rw.id = c.target_id AND rw.user_id = p_user))))
  ;
END;
$$;

REVOKE ALL ON FUNCTION creator_totals(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION creator_totals(UUID, INTEGER) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — ensure_creator_milestones(p_user)
-- Recomputes genuine thresholds from live platform data and inserts any
-- milestones the creator has actually earned but not yet recorded.
-- Returns ONLY the newly-created rows (drives one-time notifications).
-- Unforgeable: direct table writes are impossible via RLS (no policies), and
-- the thresholds are computed server-side from real data.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION ensure_creator_milestones(p_user UUID)
RETURNS TABLE(milestone_key TEXT, value BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t RECORD;
  v_posts BIGINT;
  v_roasts BIGINT;
  v_followers BIGINT;
  v_reactions BIGINT;
  v_comments BIGINT;
BEGIN
  IF p_user IS NULL OR auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO t FROM creator_totals(p_user, 0);

  v_posts     := COALESCE(t.posts, 0);
  v_roasts    := COALESCE(t.roasts, 0);
  v_followers := COALESCE(t.followers, 0);
  v_reactions := COALESCE(t.reactions, 0);
  v_comments  := COALESCE(t.comments, 0);

  -- Each block returns the row ONLY when it was genuinely earned AND new.
  RETURN QUERY
    INSERT INTO creator_milestones (user_id, milestone_key, value)
    SELECT p_user, 'first_post', v_posts WHERE v_posts >= 1
    ON CONFLICT (user_id, milestone_key) DO NOTHING
    RETURNING milestone_key, value;

  RETURN QUERY
    INSERT INTO creator_milestones (user_id, milestone_key, value)
    SELECT p_user, 'posts_10', v_posts WHERE v_posts >= 10
    ON CONFLICT (user_id, milestone_key) DO NOTHING
    RETURNING milestone_key, value;

  RETURN QUERY
    INSERT INTO creator_milestones (user_id, milestone_key, value)
    SELECT p_user, 'posts_50', v_posts WHERE v_posts >= 50
    ON CONFLICT (user_id, milestone_key) DO NOTHING
    RETURNING milestone_key, value;

  RETURN QUERY
    INSERT INTO creator_milestones (user_id, milestone_key, value)
    SELECT p_user, 'posts_100', v_posts WHERE v_posts >= 100
    ON CONFLICT (user_id, milestone_key) DO NOTHING
    RETURNING milestone_key, value;

  RETURN QUERY
    INSERT INTO creator_milestones (user_id, milestone_key, value)
    SELECT p_user, 'first_roast', v_roasts WHERE v_roasts >= 1
    ON CONFLICT (user_id, milestone_key) DO NOTHING
    RETURNING milestone_key, value;

  RETURN QUERY
    INSERT INTO creator_milestones (user_id, milestone_key, value)
    SELECT p_user, 'first_reaction', v_reactions WHERE v_reactions >= 1
    ON CONFLICT (user_id, milestone_key) DO NOTHING
    RETURNING milestone_key, value;

  RETURN QUERY
    INSERT INTO creator_milestones (user_id, milestone_key, value)
    SELECT p_user, 'reactions_100', v_reactions WHERE v_reactions >= 100
    ON CONFLICT (user_id, milestone_key) DO NOTHING
    RETURNING milestone_key, value;

  RETURN QUERY
    INSERT INTO creator_milestones (user_id, milestone_key, value)
    SELECT p_user, 'first_comment', v_comments WHERE v_comments >= 1
    ON CONFLICT (user_id, milestone_key) DO NOTHING
    RETURNING milestone_key, value;

  RETURN QUERY
    INSERT INTO creator_milestones (user_id, milestone_key, value)
    SELECT p_user, 'first_follower', v_followers WHERE v_followers >= 1
    ON CONFLICT (user_id, milestone_key) DO NOTHING
    RETURNING milestone_key, value;

  RETURN QUERY
    INSERT INTO creator_milestones (user_id, milestone_key, value)
    SELECT p_user, 'followers_10', v_followers WHERE v_followers >= 10
    ON CONFLICT (user_id, milestone_key) DO NOTHING
    RETURNING milestone_key, value;

  RETURN QUERY
    INSERT INTO creator_milestones (user_id, milestone_key, value)
    SELECT p_user, 'followers_100', v_followers WHERE v_followers >= 100
    ON CONFLICT (user_id, milestone_key) DO NOTHING
    RETURNING milestone_key, value;

  RETURN QUERY
    INSERT INTO creator_milestones (user_id, milestone_key, value)
    SELECT p_user, 'followers_1000', v_followers WHERE v_followers >= 1000
    ON CONFLICT (user_id, milestone_key) DO NOTHING
    RETURNING milestone_key, value;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION ensure_creator_milestones(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_creator_milestones(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — count_creator_views(p_author, p_days)
-- Aggregate "views" = real feed impressions of the author's content recorded
-- in rec_events (Master Prompt 12) by signed-in members, deduped per member
-- per item per day at write time. Created only when rec_events exists so this
-- migration stays runnable on projects that skipped MP12 (graceful degrade).
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
  IF to_regclass('public.rec_events') IS NOT NULL THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION count_creator_views(p_author UUID, p_days INTEGER DEFAULT 0)
      RETURNS TABLE(content_id UUID, views BIGINT)
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $sql$
        SELECT target_id::UUID, count(*)::BIGINT
        FROM rec_events
        WHERE event_type = 'content_viewed'
          AND context->>'author_id' = p_author::TEXT
          AND (p_days <= 0 OR created_at >= now() - make_interval(days => p_days))
        GROUP BY target_id
      $sql$;
      REVOKE ALL ON FUNCTION count_creator_views(UUID, INTEGER) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION count_creator_views(UUID, INTEGER) TO authenticated;
    $func$;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- DONE — Creator growth foundation schema created (additive only)
-- ═══════════════════════════════════════════════════════════
