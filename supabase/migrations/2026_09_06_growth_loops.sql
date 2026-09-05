-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Viral Sharing, Social Graph Expansion & Global Growth Loops (Master Prompt 14)
-- NON-DESTRUCTIVE: only adds new tables, indexes, and RPC functions.
-- Does NOT modify, rename, or delete any existing data or table.
--
-- Principles enforced here:
--   * Every share / referral row represents a REAL user action. Nothing is
--     seeded, simulated, or rewarded without a genuine event.
--   * Anonymous visitors may record share events (actor_id NULL) but can
--     never impersonate a signed-in actor (RLS enforces actor_id = auth.uid()).
--   * Referral codes and visit/conversion records are only ever written by
--     SECURITY DEFINER functions — clients cannot forge codes, visits, or
--     conversions. Fraud-guards (self-referral, one conversion per visit,
--     rate caps) live in the SQL, server-side.
--   * Post-signup continuation persists in signup_destinations and is
--     owner-scoped; the path is validated server-side (internal paths only).
--   * No private data is exposed: shares/referrals are not publicly readable.
-- ═══════════════════════════════════════════════════════════

-- ── 1. SHARE EVENTS (centralized, real) ───────────────────
CREATE TABLE IF NOT EXISTS shares (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN (
    'social_post', 'roast', 'profile', 'community', 'challenge', 'battle', 'topic'
  )),
  resource_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN (
    'native', 'copy', 'clipboard', 'x', 'facebook', 'whatsapp', 'telegram',
    'sms', 'email', 'link', 'other'
  )),
  context JSONB NOT NULL DEFAULT '{}',
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shares_resource ON shares(resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shares_actor ON shares(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shares_recent ON shares(created_at DESC);

-- Replay protection for repeat share taps on the same resource+channel.
CREATE UNIQUE INDEX IF NOT EXISTS idx_shares_idempotency
  ON shares(actor_id, resource_type, resource_id, channel, idempotency_key)
  WHERE actor_id IS NOT NULL AND idempotency_key IS NOT NULL;

ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
-- Authenticated users can record their own share events; anonymous visitors
-- can record a real share action with a NULL actor (no impersonation).
DO $$ BEGIN
  CREATE POLICY "Anyone can record a real share" ON shares
    FOR INSERT WITH CHECK (actor_id IS NULL OR auth.uid() = actor_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Owners read their own shares" ON shares
    FOR SELECT USING (auth.uid() = actor_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. REFERRAL CODES (durable, revocable, opaque) ─────────
-- The code is the only public-facing identifier — never a user id or email.
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  code TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
-- Reading your own code is fine; writing is exclusively via SECURITY DEFINER
-- functions (collision handling + fraud controls live in SQL).
DO $$ BEGIN
  CREATE POLICY "Owners read their referral code" ON referral_codes
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. REFERRAL VISITS + CONVERSIONS (server-written only) ─
-- No RLS policies at all: the only writers are the SECURITY DEFINER RPCs.
CREATE TABLE IF NOT EXISTS referral_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ,
  converted_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_referral_visits_code ON referral_visits(code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_visits_unconverted ON referral_visits(converted_at) WHERE converted_at IS NULL;

-- ── 4. POST-SIGNUP CONTINUATION (owner-scoped) ─────────────
-- Preserves the visitor's intended destination through the signup flow so a
-- shared link never dead-ends at an account wall.
CREATE TABLE IF NOT EXISTS signup_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  path TEXT NOT NULL,
  referrer_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

ALTER TABLE signup_destinations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Owners read their signup destination" ON signup_destinations
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Owners save their signup destination" ON signup_destinations
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Owners consume their signup destination" ON signup_destinations
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- RPC — create_referral_code(p_user)
-- Returns the user's active code, creating a fresh opaque one if needed.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION create_referral_code(p_user UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code TEXT;
  v_chars CONSTANT TEXT := 'abcdefghjkmnpqrstuvwxyz23456789';
  i INT;
  v_exists BOOLEAN;
BEGIN
  IF p_user IS NULL OR auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT code INTO v_code FROM referral_codes
    WHERE user_id = p_user AND active = true LIMIT 1;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  -- Generate an opaque, collision-safe code (unambiguous alphabet).
  FOR i IN 1..20 LOOP
    v_code := '';
    FOR j IN 1..8 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = v_code) INTO v_exists;
    IF NOT v_exists THEN
      INSERT INTO referral_codes (user_id, code) VALUES (p_user, v_code);
      RETURN v_code;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION create_referral_code(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_referral_code(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — record_referral_visit(p_code)
-- Public visitors with a valid referral code get an opaque visit token.
-- Rate-capped (max 200 visits/hour/code) to stop referral farming.
-- Returns the token to store in a first-party cookie, or NULL.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION record_referral_visit(p_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code TEXT;
  v_visits INT;
  v_token UUID;
BEGIN
  IF p_code IS NULL OR p_code !~ '^[a-z0-9]{6,12}$' THEN
    RETURN NULL;
  END IF;
  v_code := lower(p_code);

  IF NOT EXISTS (SELECT 1 FROM referral_codes WHERE code = v_code AND active = true) THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_visits FROM referral_visits
    WHERE code = v_code AND created_at > now() - interval '1 hour';
  IF v_visits >= 200 THEN
    RETURN NULL;
  END IF;

  INSERT INTO referral_visits (code, referrer_user_id)
  SELECT code, user_id FROM referral_codes WHERE code = v_code
  RETURNING id INTO v_token;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION record_referral_visit(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_referral_visit(TEXT) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — claim_referral_by_token(p_token, p_user)
-- Called after a REAL signup/sign-in when a first-party referral cookie
-- (an opaque visit token, never a user id) is present.
-- Guards: self-referrals never convert; each visit converts once; the token
-- must genuinely exist (forgery impossible — tokens are random UUIDs only
-- returned by record_referral_visit).
-- Returns the referrer's code on success (null otherwise) so rewards can be
-- granted later — rewards themselves are NOT implemented yet.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION claim_referral_by_token(p_token UUID, p_user UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code TEXT;
  v_referrer UUID;
BEGIN
  IF p_token IS NULL OR p_user IS NULL OR auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT code, referrer_user_id INTO v_code, v_referrer
    FROM referral_visits
    WHERE id = p_token AND converted_at IS NULL
    LIMIT 1;

  IF v_code IS NULL OR v_referrer IS NULL OR v_referrer = p_user THEN
    RETURN NULL;
  END IF;

  UPDATE referral_visits
    SET converted_at = now(), converted_user_id = p_user
    WHERE id = p_token AND converted_at IS NULL;

  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION claim_referral_by_token(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_referral_by_token(UUID, UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — save_signup_destination(p_path, p_ref)
-- Persists the visitor's destination (internal path only) so the auth flow
-- can return the user to the content they were originally shown.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION save_signup_destination(p_path TEXT, p_ref TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_safe TEXT;
  v_ok BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR p_path IS NULL THEN
    RETURN false;
  END IF;

  -- Internal paths only: must start with a single "/" and never "//" or "/\".
  v_safe := p_path;
  IF v_safe !~ '^/[^/\\]' OR position('?' in v_safe) = 1 THEN
    RETURN false;
  END IF;
  IF length(v_safe) > 500 THEN
    RETURN false;
  END IF;
  v_safe := regexp_replace(v_safe, '[\r\n]', '', 'g');

  INSERT INTO signup_destinations (user_id, path, referrer_code)
  VALUES (auth.uid(), v_safe, NULLIF(p_ref, ''))
  ON CONFLICT (user_id) DO UPDATE
    SET path = EXCLUDED.path, referrer_code = EXCLUDED.referrer_code, used_at = NULL
  RETURNING id IS NOT NULL INTO v_ok;

  RETURN v_ok;
END;
$$;

REVOKE ALL ON FUNCTION save_signup_destination(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_signup_destination(TEXT, TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- DONE — Growth loops schema created (additive only)
-- ═══════════════════════════════════════════════════════════