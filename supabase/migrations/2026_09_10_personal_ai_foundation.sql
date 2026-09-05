-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Personal AI Foundation (Master Prompt 22)
-- NON-DESTRUCTIVE: adds tables + RPCs only.
--
-- AI memory model (privacy-first by construction):
--   * There is NO opaque, model-generated "memory" of user activity. The
--     only persisted AI state is what the USER explicitly saves (topics /
--     preferences they want surfaced) — fully visible, editable, deletable.
--   * The personal digest is computed at request time from real authorized
--     rows (follows, communities) and is never persisted.
--   * ai_usage_log already governs inference observability (90-day
--     retention) — this migration only adds the user-owned preference row.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS personal_ai_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Explicit topics the user asked the assistant to keep surfacing.
  favorite_topics TEXT[] NOT NULL DEFAULT '{}',
  -- Coarse capability toggles (opt-out controls). Absent = enabled.
  disabled_capabilities TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE personal_ai_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Owners manage own AI preferences" ON personal_ai_preferences
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Upsert the calling user's preference row (owner-only by RLS + uid check).
CREATE OR REPLACE FUNCTION upsert_ai_preferences(
  p_favorite_topics TEXT[] DEFAULT NULL,
  p_disabled_capabilities TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;
  INSERT INTO personal_ai_preferences (user_id, favorite_topics, disabled_capabilities)
  VALUES (
    v_uid,
    COALESCE(p_favorite_topics, '{}'),
    COALESCE(p_disabled_capabilities, '{}')
  )
  ON CONFLICT (user_id) DO UPDATE
    SET favorite_topics = COALESCE(p_favorite_topics, personal_ai_preferences.favorite_topics),
        disabled_capabilities = COALESCE(p_disabled_capabilities, personal_ai_preferences.disabled_capabilities),
        updated_at = now();
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION upsert_ai_preferences(TEXT[], TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_ai_preferences(TEXT[], TEXT[]) TO authenticated;

-- Hard-delete the calling user's AI preference state (used by the
-- "clear my AI preferences" control and by account deletion flows).
CREATE OR REPLACE FUNCTION clear_ai_preferences()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;
  DELETE FROM personal_ai_preferences WHERE user_id = v_uid;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION clear_ai_preferences() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clear_ai_preferences() TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- DONE — Personal AI foundation added (additive only)
-- ═══════════════════════════════════════════════════════════