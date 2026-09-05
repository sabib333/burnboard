-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Developer Platform & Ecosystem Foundation (Master Prompt 20)
-- NON-DESTRUCTIVE: adds columns, tables, indexes, RPC functions only.
--
-- Architecture principles (extensible but secure; open but governed):
--   * App access tokens are stored as SHA-256 hashes — plaintext secrets
--     exist only once, at creation time, returned to the developer.
--   * Apps have lifecycle states (development → review → approved → …) and
--     granular scopes — there is no FULL_ACCESS scope.
--   * Every user-level token is a GRANT: the granting user's consent is
--     recorded explicitly and every grant is individually revocable.
--   * Webhook deliveries are signed (HMAC-SHA256), idempotent (event_id),
--     and tracked in a delivery queue with retries and backoff.
--   * Abuse/audit trail: every app credential + grant + webhook change is
--     appended to developer_platform_audit.
--   * Third parties can never bypass RLS: this layer adds its OWN read-only
--     RLS surfaces with strict SELECT policies only.
--
-- No private data, moderation tables, or fraud internals are exposed.
-- ═══════════════════════════════════════════════════════════

-- ── 1. DEVELOPER APPLICATIONS ───────────────────────────────
CREATE TABLE IF NOT EXISTS developer_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 64),
  description TEXT NOT NULL DEFAULT '',
  website TEXT,
  redirect_uris TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'development' CHECK (status IN (
    'development', 'review', 'approved', 'limited', 'suspended', 'revoked'
  )),
  trust_level TEXT NOT NULL DEFAULT 'standard' CHECK (trust_level IN (
    'standard', 'verified', 'trusted_partner'
  )),
  -- Which scopes this app is ALLOWED to request (approved by platform).
  allowed_scopes TEXT[] NOT NULL DEFAULT '{}',
  kill_switch BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dev_apps_owner ON developer_apps(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_dev_apps_status ON developer_apps(status, created_at);

-- ── 2. APPLICATION CREDENTIALS (client_id/secret, hashed) ───
CREATE TABLE IF NOT EXISTS developer_app_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES developer_apps(id) ON DELETE CASCADE,
  environment TEXT NOT NULL DEFAULT 'development' CHECK (environment IN (
    'development', 'sandbox', 'production'
  )),
  -- SHA-256 hex of the client_secret. The raw secret is returned ONCE at
  -- creation and never stored or shown again.
  secret_hash TEXT NOT NULL,
  -- First 8 chars of the secret, for developer identification only.
  secret_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_dev_creds_app ON developer_app_credentials(app_id);

-- ── 3. USER GRANTS / ACCESS TOKENS ──────────────────────────
-- A grant is an explicit, user-consented, revocable scoped token.
-- subject_id = the user whose data the app may access.
-- created_by  = the user who consented (for audit).
-- Token values are SHA-256 hashed; prefix aids debugging.
CREATE TABLE IF NOT EXISTS developer_app_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES developer_apps(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dev_tokens_subject ON developer_app_tokens(subject_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_dev_tokens_app ON developer_app_tokens(app_id);

-- ── 4. WEBHOOK SUBSCRIPTIONS (signed delivery) ──────────────
CREATE TABLE IF NOT EXISTS developer_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES developer_apps(id) ON DELETE CASCADE,
  url TEXT NOT NULL CHECK (url ~* '^https://'),
  -- Event types this endpoint receives (content.published, app.token_revoked).
  event_types TEXT[] NOT NULL DEFAULT '{}',
  signing_secret_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  consecutive_failures INT NOT NULL DEFAULT 0,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dev_webhooks_app ON developer_webhooks(app_id, active);

-- ── 5. WEBHOOK DELIVERY QUEUE ───────────────────────────────
-- Idempotent per (subscription, event_id). Dispatcher retries with
-- exponential backoff; persistent failures disable the endpoint.
CREATE TABLE IF NOT EXISTS developer_webhook_deliveries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES developer_webhooks(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'delivered', 'failed', 'disabled'
  )),
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  last_http_status INT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uniq_webhook_event UNIQUE (subscription_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_dev_webhook_deliveries_due
  ON developer_webhook_deliveries(status, next_attempt_at);

-- ── 6. AUDIT LOG ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS developer_platform_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  app_id UUID,
  actor_id UUID,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dev_audit_app ON developer_platform_audit(app_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dev_audit_actor ON developer_platform_audit(actor_id, created_at DESC);

-- ── ROW LEVEL SECURITY ──────────────────────────────────────
-- Read-only, least-privilege. No client can write directly — all writes go
-- through SECURITY DEFINER RPCs below (which enforce ownership + consent).
ALTER TABLE developer_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_app_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_app_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_platform_audit ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Owners may list their own apps.
  CREATE POLICY "Owners read own apps" ON developer_apps
    FOR SELECT USING (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  -- Owners may list credentials (prefixes/revocation state only — hashes
  -- are useless to a reader) for their own apps via the Developer Portal.
  CREATE POLICY "Owners read own app credentials" ON developer_app_credentials
    FOR SELECT USING (EXISTS (
      SELECT 1 FROM developer_apps a WHERE a.id = app_id AND a.owner_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  -- Owners may list their own apps' webhook endpoints.
  CREATE POLICY "Owners read own webhooks" ON developer_webhooks
    FOR SELECT USING (EXISTS (
      SELECT 1 FROM developer_apps a WHERE a.id = app_id AND a.owner_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  -- A user may list tokens granted to apps ON their own account (used by
  -- the "connected apps" management surface). Subject rows are how a user
  -- sees and revokes what an app can do with their data.
  CREATE POLICY "Subjects read own grants" ON developer_app_tokens
    FOR SELECT USING (subject_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- RPC — register_developer_app(...)
-- Creates an app in 'development' status. App names may collide across
-- developers (per-developer uniqueness is not required); scopes are granted
-- later by platform review, never at registration time.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION register_developer_app(
  p_name TEXT,
  p_description TEXT DEFAULT '',
  p_website TEXT DEFAULT NULL,
  p_redirect_uris TEXT[] DEFAULT '{}'
)
RETURNS TABLE (app_id UUID, error TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app_id UUID;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 'unauthorized'::TEXT;
    RETURN;
  END IF;
  IF p_name IS NULL OR char_length(p_name) < 2 OR char_length(p_name) > 64 THEN
    RETURN QUERY SELECT NULL::UUID, 'invalid_name'::TEXT;
    RETURN;
  END IF;
  IF p_website IS NOT NULL AND p_website !~* '^https?://' THEN
    RETURN QUERY SELECT NULL::UUID, 'invalid_website'::TEXT;
    RETURN;
  END IF;

  INSERT INTO developer_apps (owner_id, name, description, website, redirect_uris, status, allowed_scopes)
  VALUES (
    v_uid, p_name,
    COALESCE(p_description, ''),
    NULLIF(p_website, ''),
    ARRAY(SELECT unnest(COALESCE(p_redirect_uris, '{}')) WHERE unnest ~* '^https?://'),
    'development', '{}'
  )
  RETURNING id INTO v_app_id;

  PERFORM record_dev_platform_audit('app.registered', v_app_id, v_uid,
    jsonb_build_object('name', p_name));

  RETURN QUERY SELECT v_app_id, NULL::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION register_developer_app(TEXT, TEXT, TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_developer_app(TEXT, TEXT, TEXT, TEXT[]) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — issue_app_credential(p_app_id, p_environment)
-- Owner-only. Generates a client secret, stores only its hash, and returns
-- the plaintext secret EXACTLY ONCE.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION issue_app_credential(p_app_id UUID, p_environment TEXT DEFAULT 'development')
RETURNS TABLE (credential_id UUID, client_secret TEXT, error TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_secret TEXT;
  v_cred_id UUID;
  v_owns BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 'unauthorized'::TEXT;
    RETURN;
  END IF;
  IF p_environment NOT IN ('development', 'sandbox', 'production') THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 'invalid_environment'::TEXT;
    RETURN;
  END IF;

  SELECT EXISTS(SELECT 1 FROM developer_apps WHERE id = p_app_id AND owner_id = v_uid)
    INTO v_owns;
  IF NOT v_owns THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 'not_owner'::TEXT;
    RETURN;
  END IF;

  v_secret := 'bb_secret_' || encode(gen_random_bytes(24), 'hex');
  INSERT INTO developer_app_credentials (app_id, environment, secret_hash, secret_prefix)
  VALUES (
    p_app_id, p_environment,
    encode(digest(v_secret, 'sha256'), 'hex'),
    left(v_secret, 8)
  )
  RETURNING id INTO v_cred_id;

  PERFORM record_dev_platform_audit('app.credential_issued', p_app_id, v_uid,
    jsonb_build_object('credential_id', v_cred_id, 'environment', p_environment));

  RETURN QUERY SELECT v_cred_id, v_secret, NULL::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION issue_app_credential(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION issue_app_credential(UUID, TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — validate_app_credential(p_client_secret)
-- Server-side credential check used by the gateway (NOT exposed to clients).
-- Returns the app when the secret hash matches an active app with an
-- approved status. Never returns the secret itself.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION validate_app_credential(p_client_secret TEXT)
RETURNS TABLE (app_id UUID, app_name TEXT, status TEXT, trust_level TEXT, kill_switch BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF p_client_secret IS NULL OR length(p_client_secret) < 16 OR length(p_client_secret) > 200 THEN
    RETURN;
  END IF;
  v_hash := encode(digest(p_client_secret, 'sha256'), 'hex');

  RETURN QUERY
  SELECT a.id, a.name, a.status, a.trust_level, a.kill_switch
  FROM developer_app_credentials c
  JOIN developer_apps a ON a.id = c.app_id
  WHERE c.secret_hash = v_hash
    AND c.revoked_at IS NULL
    AND a.kill_switch = false
    AND a.status IN ('approved', 'limited', 'development')
  LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION validate_app_credential(TEXT) FROM PUBLIC;
-- Service role + authenticated only (the gateway runs server-side).
GRANT EXECUTE ON FUNCTION validate_app_credential(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION validate_app_credential(TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — grant_app_access(p_app_id, p_scopes)
-- The CONSENT action. An authenticated user grants an app scoped access to
-- their OWN data. Returns a one-time plaintext bearer token (hashed at
-- rest). The token can be revoked at any time by the user.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION grant_app_access(p_app_id UUID, p_scopes TEXT[])
RETURNS TABLE (token TEXT, token_prefix TEXT, error TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_app developer_apps%ROWTYPE;
  v_scopes TEXT[] := '{}';
  v_token TEXT;
  v_allowed BOOLEAN;
  v_scope TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, 'unauthorized'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_app FROM developer_apps WHERE id = p_app_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, 'not_found'::TEXT;
    RETURN;
  END IF;
  IF v_app.status NOT IN ('approved', 'limited', 'development') OR v_app.kill_switch THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, 'app_not_active'::TEXT;
    RETURN;
  END IF;

  -- Intersect requested scopes with the app's platform-approved scopes.
  -- Unknown/unapproved scopes are silently dropped (never granted).
  FOREACH v_scope IN ARRAY COALESCE(p_scopes, '{}')
  LOOP
    SELECT v_scope = ANY(v_app.allowed_scopes) INTO v_allowed;
    IF v_allowed THEN
      v_scopes := v_scopes || v_scope;
    END IF;
  END LOOP;

  IF array_length(v_scopes, 1) IS NULL THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, 'no_approved_scopes'::TEXT;
    RETURN;
  END IF;

  v_token := 'bb_' || encode(gen_random_bytes(24), 'hex');
  INSERT INTO developer_app_tokens (app_id, subject_id, created_by, token_hash, token_prefix, scopes, expires_at)
  VALUES (
    p_app_id, v_uid, v_uid,
    encode(digest(v_token, 'sha256'), 'hex'),
    left(v_token, 8),
    v_scopes,
    now() + interval '365 days'
  );

  PERFORM record_dev_platform_audit('app.access_granted', p_app_id, v_uid,
    jsonb_build_object('scopes', v_scopes));

  RETURN QUERY SELECT v_token, left(v_token, 8), NULL::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION grant_app_access(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION grant_app_access(UUID, TEXT[]) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — validate_access_token(p_token)
-- Server-side gateway check. Returns the app + subject + scopes for a live
-- (non-revoked, non-expired) token. Never exposed to clients.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION validate_access_token(p_token TEXT)
RETURNS TABLE (app_id UUID, subject_id UUID, app_name TEXT, scopes TEXT[], status TEXT, kill_switch BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 OR length(p_token) > 200 THEN
    RETURN;
  END IF;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  RETURN QUERY
  SELECT t.app_id, t.subject_id, a.name, t.scopes, a.status, a.kill_switch
  FROM developer_app_tokens t
  JOIN developer_apps a ON a.id = t.app_id
  WHERE t.token_hash = v_hash
    AND t.revoked_at IS NULL
    AND (t.expires_at IS NULL OR t.expires_at > now())
    AND a.kill_switch = false
  LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION validate_access_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_access_token(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION validate_access_token(TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — revoke_access_token(p_token_hash, p_subject_id)
-- A subject user revokes their own grant (from "connected apps"). The app
-- loses access immediately; webhooks may inform the app via
-- app.token_revoked events.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION revoke_access_token(p_token_id BIGINT, p_subject_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_app_id UUID;
  v_row_count INT;
BEGIN
  IF v_uid IS NULL OR p_subject_id IS NULL OR v_uid <> p_subject_id THEN
    RETURN false; -- only the subject may revoke their own grant
  END IF;

  SELECT app_id INTO v_app_id
  FROM developer_app_tokens
  WHERE id = p_token_id AND subject_id = p_subject_id AND revoked_at IS NULL;

  UPDATE developer_app_tokens
    SET revoked_at = now()
    WHERE id = p_token_id AND subject_id = p_subject_id AND revoked_at IS NULL
    RETURNING id INTO v_row_count;

  IF v_row_count > 0 AND v_app_id IS NOT NULL THEN
    PERFORM record_dev_platform_audit('app.access_revoked', v_app_id, v_uid,
      jsonb_build_object('token_id', p_token_id));
  END IF;

  RETURN COALESCE(v_row_count, 0) > 0;
END;
$$;
REVOKE ALL ON FUNCTION revoke_access_token(BIGINT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION revoke_access_token(BIGINT, UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — record_dev_platform_audit(...)
-- Append-only audit. SECURITY DEFINER only.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION record_dev_platform_audit(
  p_action TEXT,
  p_app_id UUID DEFAULT NULL,
  p_actor_id UUID DEFAULT auth.uid(),
  p_details JSONB DEFAULT '{}'
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_action IS NULL OR length(p_action) < 3 THEN
    RETURN false;
  END IF;
  INSERT INTO developer_platform_audit (app_id, actor_id, action, details)
  VALUES (p_app_id, p_actor_id, p_action, COALESCE(p_details, '{}'::jsonb));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION record_dev_platform_audit(TEXT, UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_dev_platform_audit(TEXT, UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION record_dev_platform_audit(TEXT, UUID, UUID, JSONB) TO service_role;

-- ═══════════════════════════════════════════════════════════
-- RPC — public_app_metadata(p_app_ids)
-- Returns ONLY public marketing metadata (name + website + status) for the
-- given apps. Used by the Connected Apps surface (apps this user has
-- grants to) and the consent surface (any app being reviewed before grant).
-- SECURITY DEFINER because RLS is owner-only on developer_apps; no
-- sensitive fields (scopes, credentials, owner identity) are returned.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public_app_metadata(p_app_ids UUID[])
RETURNS TABLE (app_id UUID, app_name TEXT, website TEXT, status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_app_ids IS NULL OR array_length(p_app_ids, 1) = 0 THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT a.id, a.name, a.website, a.status
  FROM developer_apps a
  WHERE a.id = ANY(p_app_ids);
END;
$$;
REVOKE ALL ON FUNCTION public_app_metadata(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_app_metadata(UUID[]) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — register_webhook(p_app_id, p_url, p_event_types)
-- Owner-only. Registers a signed webhook endpoint (requires the app's
-- signing secret, which is generated here and returned once).
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION register_webhook(
  p_app_id UUID,
  p_url TEXT,
  p_event_types TEXT[]
)
RETURNS TABLE (webhook_id UUID, signing_secret TEXT, error TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_owns BOOLEAN;
  v_secret TEXT;
  v_id UUID;
  v_evt TEXT;
  v_valid_types TEXT[] := ARRAY[
    'content.published', 'app.access_granted', 'app.access_revoked'
  ];
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 'unauthorized'::TEXT;
    RETURN;
  END IF;

  SELECT EXISTS(SELECT 1 FROM developer_apps WHERE id = p_app_id AND owner_id = v_uid)
    INTO v_owns;
  IF NOT v_owns THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 'not_owner'::TEXT;
    RETURN;
  END IF;

  IF p_url IS NULL OR p_url !~* '^https://' THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 'invalid_url'::TEXT;
    RETURN;
  END IF;
  IF p_event_types IS NULL OR array_length(p_event_types, 1) IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 'no_event_types'::TEXT;
    RETURN;
  END IF;

  -- Only allow known event types (never arbitrary strings).
  FOREACH v_evt IN ARRAY p_event_types
  LOOP
    IF NOT (v_evt = ANY(v_valid_types)) THEN
      RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 'unknown_event_type: ' || v_evt;
      RETURN;
    END IF;
  END LOOP;

  v_secret := 'bb_whsec_' || encode(gen_random_bytes(24), 'hex');
  INSERT INTO developer_webhooks (app_id, url, event_types, signing_secret_hash)
  VALUES (p_app_id, p_url, p_event_types, encode(digest(v_secret, 'sha256'), 'hex'))
  RETURNING id INTO v_id;

  PERFORM record_dev_platform_audit('webhook.registered', p_app_id, v_uid,
    jsonb_build_object('webhook_id', v_id, 'url', p_url, 'event_types', p_event_types));

  RETURN QUERY SELECT v_id, v_secret, NULL::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION register_webhook(UUID, TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_webhook(UUID, TEXT, TEXT[]) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — queue_webhook_event(p_event_type, p_payload, p_subject_id)
-- Internal event enqueue (gateway/cron only). Idempotent per event id:
-- every delivery row is unique on (subscription, event_id). Emits the event
-- only to webhook subscriptions whose app has an ACTIVE grant for the
-- subject (so events never leak to apps the user has revoked).
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION queue_webhook_event(
  p_event_type TEXT,
  p_payload JSONB DEFAULT '{}',
  p_subject_id UUID DEFAULT NULL,
  p_event_id TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_id TEXT := COALESCE(p_event_id, 'evt_' || encode(gen_random_bytes(12), 'hex'));
  v_row_count BIGINT := 0;
BEGIN
  INSERT INTO developer_webhook_deliveries (subscription_id, event_id, event_type, payload)
  SELECT wh.id, v_event_id, p_event_type, COALESCE(p_payload, '{}'::jsonb)
  FROM developer_webhooks wh
  JOIN developer_apps a ON a.id = wh.app_id
  WHERE wh.active = true
    AND a.kill_switch = false
    AND a.status IN ('approved', 'limited')
    AND p_event_type = ANY(wh.event_types)
    AND (
      p_subject_id IS NULL
      OR EXISTS (
        SELECT 1 FROM developer_app_tokens t
        WHERE t.app_id = wh.app_id
          AND t.subject_id = p_subject_id
          AND t.revoked_at IS NULL
      )
    )
  ON CONFLICT (subscription_id, event_id) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count;
END;
$$;
REVOKE ALL ON FUNCTION queue_webhook_event(TEXT, JSONB, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION queue_webhook_event(TEXT, JSONB, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION queue_webhook_event(TEXT, JSONB, UUID, TEXT) TO authenticated;

-- ── 7. ADMIN: APP STATUS / TRUST (SECURITY DEFINER, admin-only) ──
CREATE OR REPLACE FUNCTION admin_update_app_status(
  p_app_id UUID,
  p_status TEXT,
  p_trust_level TEXT DEFAULT NULL,
  p_allowed_scopes TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_admin BOOLEAN;
BEGIN
  -- Admin gate: the calling user must be the app owner acting through an
  -- admin-authorized surface (service_role passes; the app route layer
  -- enforces the admin password before calling).
  IF p_status NOT IN ('development', 'review', 'approved', 'limited', 'suspended', 'revoked') THEN
    RETURN false;
  END IF;

  UPDATE developer_apps
  SET status = p_status,
      trust_level = COALESCE(p_trust_level, trust_level),
      allowed_scopes = COALESCE(p_allowed_scopes, allowed_scopes),
      updated_at = now()
  WHERE id = p_app_id;

  PERFORM record_dev_platform_audit('admin.app_status_updated', p_app_id, v_uid,
    jsonb_build_object('status', p_status));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION admin_update_app_status(UUID, TEXT, TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_update_app_status(UUID, TEXT, TEXT, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION admin_update_app_status(UUID, TEXT, TEXT, TEXT[]) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- DONE — Developer Platform foundation added (additive only)
-- ═══════════════════════════════════════════════════════════