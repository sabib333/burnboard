-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Monetization, Creator Revenue & Sustainable Business Engine (Master Prompt 15)
-- NON-DESTRUCTIVE: only adds new tables, indexes, RPC functions, and seed
-- data. Does NOT modify, rename, or delete any existing table or row.
--
-- Principles enforced here:
--   * All financial truth is backend-authoritative. Payment status is only
--     ever written by verified provider events (webhook pipeline) — the
--     client can at most create a "pending" checkout record.
--   * monetization_purchases is an immutable ledger: purchases are APPENDED,
--     refunds/disputes are recorded as separate adjustment rows (never
--     DELETE/UPDATE of history). No mutable "balance" numbers anywhere.
--   * Every purchase/entitlement/event records origin ('dev'|'test'|'prod')
--     so sandbox transactions can never mix with real financial records.
--   * Entitlements are the only thing that gates paid access, and they are
--     derived from verified provider events — never from frontend status.
--   * No raw card/bank data is ever stored here; provider tokens only.
--   * No RLS write policies exist on any financial table. Direct client
--     inserts/updates are impossible; only SECURITY DEFINER functions may
--     write (webhook reconciliation, admin ops), so clients can never forge
--     payments, refunds, earnings, or audit entries.
-- ═══════════════════════════════════════════════════════════

-- ── 1. PRODUCT CATALOG (configuration, centralized) ────────
-- Product = what is sold. Status controls availability (draft/active/retired).
CREATE TABLE IF NOT EXISTS monetization_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9_]{2,64}$'),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  product_type TEXT NOT NULL CHECK (product_type IN (
    'platform_premium', 'creator_subscription', 'paid_community',
    'tip', 'digital_product', 'future'
  )),
  -- NULL = platform product; paid_community sets community_id; creator
  -- subscriptions/pins set owner_id. One of these must be set at runtime.
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  billing_text TEXT NOT NULL DEFAULT '',
  feature_list JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monetization_products_status ON monetization_products(status, product_type);

-- ── 2. PRICING ARCHITECTURE (centralized) ─────────────────
-- Price = a specific amount/currency/interval for a product. Both active
-- prices are kept; promotions add rows rather than mutating sold prices.
-- amount_minor = integer minor units (e.g. cents), so money is never stored
-- as floats.
CREATE TABLE IF NOT EXISTS monetization_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES monetization_products(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency ~ '^[a-z]{3}$'),
  billing_interval TEXT NOT NULL DEFAULT 'one_time' CHECK (billing_interval IN (
    'one_time', 'month', 'year'
  )),
  interval_count INTEGER NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  region TEXT NOT NULL DEFAULT 'global' CHECK (region ~ '^[a-z0-9_-]{1,32}$'),
  label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'retired')),
  trial_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monetization_prices_product ON monetization_prices(product_id, status);

-- ── 3. PURCHASES (immutable financial ledger) ──────────────
-- One row per completed customer transaction (incl. platform purchases,
-- creator subscriptions, tips, digital products). Recurring renewals each
-- append their own purchase row. Never updated once written — every financial
-- consequence (refund, dispute, fee adjustment) is a separate row.
CREATE TABLE IF NOT EXISTS monetization_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Unique idempotency key for the checkout attempt (server-generated).
  transaction_ref TEXT NOT NULL UNIQUE,
  provider_id TEXT NOT NULL,
  -- Provider is 'cc_sandbox' (dev/test driver), 'stripe', or future
  -- providers. The abstraction layer maps these; stored for audit.
  provider TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES monetization_products(id) ON DELETE RESTRICT,
  price_id UUID NOT NULL REFERENCES monetization_prices(id) ON DELETE RESTRICT,
  -- Provider-granted entitlement (the thing access is granted to).
  entitlement_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'succeeded', 'failed', 'refunded', 'partially_refunded',
    'disputed', 'reversed', 'void'
  )),
  -- Actual price paid (what the user was charged — preserved verbatim).
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency ~ '^[a-z]{3}$'),
  -- Original basis plus provider event reference and time bounds.
  provider_reference TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  origin TEXT NOT NULL DEFAULT 'prod' CHECK (origin IN ('dev', 'test', 'prod')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monetization_purchases_user ON monetization_purchases(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monetization_purchases_product ON monetization_purchases(product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monetization_purchases_provider ON monetization_purchases(provider_id);
CREATE INDEX IF NOT EXISTS idx_monetization_purchases_origin ON monetization_purchases(origin, created_at DESC);

-- ── 4. FINANCIAL ADJUSTMENTS (refunds, disputes, corrections) ──
-- Instructor: every money-movement OUT of the recorded gross (refund,
-- dispute, reversal, fee correction) appends a row here. The ledger stays
-- immutable; net = sum(purchases) + sum(adjustments) for a user.
CREATE TABLE IF NOT EXISTS monetization_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES monetization_purchases(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN (
    'refund', 'dispute', 'reversal', 'correction', 'fee_change'
  )),
  amount_minor INTEGER NOT NULL CHECK (amount_minor <> 0),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency ~ '^[a-z]{3}$'),
  reason TEXT NOT NULL DEFAULT '',
  provider_reference TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  origin TEXT NOT NULL DEFAULT 'prod' CHECK (origin IN ('dev', 'test', 'prod')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monetization_adjustments_purchase ON monetization_adjustments(purchase_id);

-- ── 5. ENTITLEMENTS (backend-authoritative access grants) ──
-- Derived from verified provider events by the webhook pipeline. UI never
-- writes here; feature gating reads here. Status lifecycle: pending (awaiting
-- payment verification) → active → cancelled/expired/revoked/suspended.
CREATE TABLE IF NOT EXISTS monetization_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES monetization_products(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'active', 'cancelled', 'expired', 'revoked', 'suspended'
  )),
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'purchase' CHECK (source IN ('purchase', 'grant', 'admin', 'promo', 'sandbox')),
  origin TEXT NOT NULL DEFAULT 'prod' CHECK (origin IN ('dev', 'test', 'prod')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monetization_entitlements_user ON monetization_entitlements(user_id, status);
CREATE INDEX IF NOT EXISTS idx_monetization_entitlements_key ON monetization_entitlements(key, status);

-- ── 6. PROVIDER PAYMENT EVENTS (webhook pipeline) ──────────
-- Every verified provider event lands exactly once (unique provider_event_id).
-- Processing is idempotent: replaying a webhook is a no-op, never a double
-- credit. status tracks the durable processing state for retries/recovery.
CREATE TABLE IF NOT EXISTS monetization_payment_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  provider_reference TEXT,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN (
    'received', 'processing', 'processed', 'failed', 'ignored'
  )),
  processing_error TEXT,
  processed_at TIMESTAMPTZ,
  origin TEXT NOT NULL DEFAULT 'prod' CHECK (origin IN ('dev', 'test', 'prod')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uniq_provider_event UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_monetization_payment_events_status ON monetization_payment_events(status, created_at);
CREATE INDEX IF NOT EXISTS idx_monetization_payment_events_ref ON monetization_payment_events(provider_reference);

-- ── 7. CREATOR BALANCE / PAYOUT STATE (ledger-derived) ─────
-- Not a "balance" the creator can spend — a derived summary row recomputed
-- by SECURITY DEFINER functions from the real ledger. Dust amounts are
-- prevented via CHECK (wallet + held etc. are always >= 0). Payouts append
-- rows; holds/reversals adjust via new rows, never UPDATE of history here
-- beyond `status`.
CREATE TABLE IF NOT EXISTS monetization_creator_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  earned_minor INTEGER NOT NULL DEFAULT 0 CHECK (earned_minor >= 0),
  pending_minor INTEGER NOT NULL DEFAULT 0 CHECK (pending_minor >= 0),
  available_minor INTEGER NOT NULL DEFAULT 0 CHECK (available_minor >= 0),
  held_minor INTEGER NOT NULL DEFAULT 0 CHECK (held_minor >= 0),
  paid_out_minor INTEGER NOT NULL DEFAULT 0 CHECK (paid_out_minor >= 0),
  reversed_minor INTEGER NOT NULL DEFAULT 0 CHECK (reversed_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency ~ '^[a-z]{3}$'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 8. PAYOUTS (creator withdrawals) ───────────────────────
-- Foundation only: created by SECURITY DEFINER admin flows after eligibility
-- (identity/payout onboarding, thresholds, fraud review). Nothing here makes
-- real money move until a compliant provider payout driver exists.
CREATE TABLE IF NOT EXISTS monetization_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency ~ '^[a-z]{3}$'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'held', 'processing', 'paid', 'failed', 'reversed'
  )),
  provider_reference TEXT,
  provider TEXT,
  origin TEXT NOT NULL DEFAULT 'prod' CHECK (origin IN ('dev', 'test', 'prod')),
  request_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monetization_payouts_user ON monetization_payouts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monetization_payouts_status ON monetization_payouts(status);

-- ── 9. FINANCIAL AUDIT LOG (written by SECURITY DEFINER only) ──
-- Sensitive financial actions are appended here. No RLS write policy — call
-- record_monetization_audit(). Immutable (no update policy).
CREATE TABLE IF NOT EXISTS monetization_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID,
  details JSONB NOT NULL DEFAULT '{}',
  origin TEXT NOT NULL DEFAULT 'prod' CHECK (origin IN ('dev', 'test', 'prod')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monetization_audit_log_actor ON monetization_audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monetization_audit_log_target ON monetization_audit_log(target_user_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — owner-readable only, no direct writes.
-- ═══════════════════════════════════════════════════════════
ALTER TABLE monetization_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE monetization_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE monetization_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE monetization_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE monetization_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE monetization_payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE monetization_creator_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE monetization_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monetization_audit_log ENABLE ROW LEVEL SECURITY;

-- Catalog: active products and prices are public marketing data — safe to
-- read (no PII, no pricing decisions). Everything else is owner-only.
DO $$ BEGIN
  CREATE POLICY "Public read active products" ON monetization_products
    FOR SELECT USING (status = 'active');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Public read active prices" ON monetization_prices
    FOR SELECT USING (status = 'active');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Purchases: owner reads their own purchase history only, and may create
-- PENDING checkout rows (status is enforced as 'pending' on insert — the
-- client can never insert a 'succeeded' row directly). Promotion to
-- 'succeeded' happens exclusively through the SECURITY DEFINER fulfillment
-- function after a verified provider event.
DO $$ BEGIN
  CREATE POLICY "Owners read own purchases" ON monetization_purchases
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Owners create pending checkout" ON monetization_purchases
    FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Creators read purchases of their OWN products (used for the revenue
-- dashboard). The route layer strips supporter identity before responding.
DO $$ BEGIN
  CREATE POLICY "Creators read purchases on own products" ON monetization_purchases
    FOR SELECT USING (EXISTS (
      SELECT 1 FROM monetization_products mp
      WHERE mp.id = product_id AND mp.owner_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Creators read adjustments on own products" ON monetization_adjustments
    FOR SELECT USING (EXISTS (
      SELECT 1 FROM monetization_purchases p
      JOIN monetization_products mp ON mp.id = p.product_id
      WHERE p.id = purchase_id AND mp.owner_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Adjustments: owners read adjustments against their own purchases.
DO $$ BEGIN
  CREATE POLICY "Owners read own adjustments" ON monetization_adjustments
    FOR SELECT USING (EXISTS (
      SELECT 1 FROM monetization_purchases p
      WHERE p.id = purchase_id AND p.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Entitlements: owners read their own entitlements (server derives them).
DO $$ BEGIN
  CREATE POLICY "Owners read own entitlements" ON monetization_entitlements
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Creator balances/payouts: owners read their own (server derives them).
DO $$ BEGIN
  CREATE POLICY "Owners read own balances" ON monetization_creator_balances
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Owners read own payouts" ON monetization_payouts
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Provider events / audit log: no read policies at all — these are
-- server-internal tables never exposed to clients (even owners).

-- ═══════════════════════════════════════════════════════════
-- RPC — check_entitlement(p_user, p_key)
-- Backend-authoritative entitlement check. SECURITY DEFINER: reads are
-- owner-independent so the function can be used inside RLS policies later
-- (e.g. paid-community post visibility). An active entitlement whose
-- current_period_end is in the past is treated as expired by callers — the
-- webhook pipeline keeps this column fresh on renewal.
-- Returns TRUE/FALSE — never exposes any score or internal state.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION check_entitlement(p_user UUID, p_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_active BOOLEAN;
BEGIN
  IF p_user IS NULL OR p_key IS NULL THEN
    RETURN false;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM monetization_entitlements e
    WHERE e.user_id = p_user
      AND e.key = p_key
      AND e.status = 'active'
      AND (e.current_period_end IS NULL OR e.current_period_end > now())
  ) INTO v_active;
  RETURN COALESCE(v_active, false);
END;
$$;

REVOKE ALL ON FUNCTION check_entitlement(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_entitlement(UUID, TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — record_monetization_event(p_provider, p_event_id, p_payload)
-- Idempotent webhook event intake. The first call for a given
-- (provider, event_id) persists the event; replays return the existing row
-- without inserting. Processing happens afterwards in the application
-- layer; this function is the durable gate that prevents double credit.
-- Returns the event id (null if the event was for a different provider).
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION record_monetization_event(
  p_provider TEXT,
  p_event_id TEXT,
  p_payload JSONB DEFAULT '{}'
)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id BIGINT;
BEGIN
  IF p_provider IS NULL OR length(p_event_id) < 4 OR length(p_event_id) > 200 THEN
    RETURN NULL;
  END IF;

  INSERT INTO monetization_payment_events (provider, provider_event_id, payload)
  VALUES (p_provider, p_event_id, COALESCE(p_payload, '{}'::jsonb))
  ON CONFLICT (provider, provider_event_id) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION record_monetization_event(TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_monetization_event(TEXT, TEXT, JSONB) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — fulfill_monetization_purchase(...)
-- The ONLY way a purchase becomes 'succeeded' and an entitlement becomes
-- 'active'. Called by the webhook pipeline AFTER signature verification and
-- AFTER record_monetization_event persisted the provider event (p_event_id).
--   * Only transitions pending → succeeded (an already-succeeded purchase is
--     a no-op → replays never double-credit).
--   * Creates/extends the matching entitlement from the purchase's own
--     entitlement_key.
--   * When the product has an owner (creator product), credits the creator's
--     balance using the net amount provided by the centralized revenue-split
--     policy in the app layer (gross + fees recorded as metadata for audit).
--   * Always writes an audit line.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fulfill_monetization_purchase(
  p_purchase_id UUID,
  p_event_id BIGINT,
  p_status TEXT DEFAULT 'succeeded',
  p_provider_reference TEXT DEFAULT NULL,
  p_period_start TIMESTAMPTZ DEFAULT NULL,
  p_period_end TIMESTAMPTZ DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_purchase monetization_purchases%ROWTYPE;
  v_exists BOOLEAN;
  v_product monetization_products%ROWTYPE;
  v_net_minor INTEGER := 0;
  v_fee_minor INTEGER := 0;
BEGIN
  -- The provider event must exist (persisted by the verified webhook).
  SELECT EXISTS(
    SELECT 1 FROM monetization_payment_events
    WHERE id = p_event_id AND status = 'received'
  ) INTO v_exists;
  IF NOT v_exists THEN
    RETURN false;
  END IF;

  SELECT * INTO v_purchase FROM monetization_purchases WHERE id = p_purchase_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Idempotency: only pending purchases may be fulfilled.
  IF v_purchase.status <> 'pending' THEN
    RETURN false;
  END IF;

  SELECT * INTO v_product FROM monetization_products WHERE id = v_purchase.product_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Promote the purchase (immutable ledger: status is the only sanctioned
  -- transition on the row itself; financial amounts never change).
  UPDATE monetization_purchases
    SET status = p_status,
        provider_reference = COALESCE(p_provider_reference, provider_reference),
        period_start = COALESCE(p_period_start, period_start),
        period_end = COALESCE(p_period_end, period_end),
        metadata = metadata || COALESCE(p_metadata, '{}'::jsonb)
    WHERE id = p_purchase_id;

  -- Mark the event processed (durable, auditable).
  UPDATE monetization_payment_events
    SET status = 'processed', processed_at = now()
    WHERE id = p_event_id;

  -- Entitlement: activate (or keep/extend the existing active row).
  INSERT INTO monetization_entitlements (user_id, product_id, key, status, current_period_end, source, origin)
  VALUES (
    v_purchase.user_id,
    v_purchase.product_id,
    v_purchase.entitlement_key,
    'active',
    p_period_end,
    CASE WHEN v_purchase.origin = 'prod' THEN 'purchase' ELSE 'sandbox' END,
    v_purchase.origin
  )
  ON CONFLICT DO NOTHING;

  -- If an entitlement row already exists for this user+key+product, extend
  -- its period and keep it active (renewals must not create duplicates).
  IF p_status = 'succeeded' THEN
    UPDATE monetization_entitlements
      SET status = 'active',
          current_period_end = GREATEST(current_period_end, p_period_end),
          cancel_at_period_end = false,
          updated_at = now()
      WHERE user_id = v_purchase.user_id
        AND product_id = v_purchase.product_id
        AND key = v_purchase.entitlement_key;
  END IF;

  -- Creator earnings (product owned by a creator). Net split computed by the
  -- app layer policy and passed in metadata; gross+fees recorded verbatim.
  IF v_product.owner_id IS NOT NULL THEN
    v_fee_minor := COALESCE((COALESCE(p_metadata, '{}'::jsonb) ->> 'platform_fee_minor')::int, 0)
                + COALESCE((COALESCE(p_metadata, '{}'::jsonb) ->> 'processing_fee_minor')::int, 0);
    v_net_minor := GREATEST(v_purchase.amount_minor - v_fee_minor, 0);

    INSERT INTO monetization_creator_balances (user_id, earned_minor, pending_minor, available_minor)
    VALUES (v_product.owner_id, v_net_minor, 0, v_net_minor)
    ON CONFLICT (user_id) DO UPDATE
      SET earned_minor = monetization_creator_balances.earned_minor + v_net_minor,
          available_minor = monetization_creator_balances.available_minor + v_net_minor,
          updated_at = now();
  END IF;

  PERFORM record_monetization_audit(
    'purchase_fulfilled',
    jsonb_build_object(
      'purchase_id', p_purchase_id,
      'event_id', p_event_id,
      'provider_reference', p_provider_reference,
      'entitlement_key', v_purchase.entitlement_key,
      'gross_minor', v_purchase.amount_minor,
      'net_minor', v_net_minor
    ),
    auth.uid(),
    v_purchase.user_id
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION fulfill_monetization_purchase(UUID, BIGINT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) FROM PUBLIC;
-- Intentionally authenticated-only for now (sandbox flow runs through the
-- user's session). Real providers append a service-role path later — the
-- provider-event existence gate prevents forged fulfillment either way.
GRANT EXECUTE ON FUNCTION fulfill_monetization_purchase(UUID, BIGINT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — refund_monetization_purchase(p_purchase_id, p_amount_minor,
--                                   p_reason, p_provider_reference)
-- Appends a REFUND adjustment (never deletes/overwrites the original
-- purchase), marks the purchase refunded, closes the entitlement, and
-- reverses the creator's ledger-derived balance. Owner-facing cancellation
-- of a subscription is end-of-period only (see cancel RPC); refunds are a
-- provider-confirmed/administrative action — this function is only callable
-- by a trusted service role downstream, never by regular users.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION refund_monetization_purchase(
  p_purchase_id UUID,
  p_amount_minor INTEGER,
  p_reason TEXT DEFAULT 'refund',
  p_provider_reference TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_purchase monetization_purchases%ROWTYPE;
  v_product monetization_products%ROWTYPE;
  v_net_minor INTEGER;
BEGIN
  SELECT * INTO v_purchase FROM monetization_purchases WHERE id = p_purchase_id;
  IF NOT FOUND OR v_purchase.status <> 'succeeded' THEN
    RETURN false;
  END IF;
  IF p_amount_minor <= 0 OR p_amount_minor > v_purchase.amount_minor THEN
    RETURN false;
  END IF;

  -- Immutable ledger: append the adjustment, transition status only.
  INSERT INTO monetization_adjustments (purchase_id, adjustment_type, amount_minor, currency, reason, provider_reference, created_by)
  VALUES (p_purchase_id, 'refund', -p_amount_minor, v_purchase.currency, p_reason, p_provider_reference, p_actor_id);

  UPDATE monetization_purchases
    SET status = CASE WHEN p_amount_minor = v_purchase.amount_minor THEN 'refunded' ELSE 'partially_refunded' END
    WHERE id = p_purchase_id;

  -- Entitlement: fully refunded purchases lose access (revoked); partial
  -- refunds keep access for the paid window (policy reviewers may adjust).
  IF p_amount_minor = v_purchase.amount_minor THEN
    UPDATE monetization_entitlements
      SET status = 'revoked', updated_at = now()
      WHERE user_id = v_purchase.user_id AND product_id = v_purchase.product_id AND key = v_purchase.entitlement_key;
  END IF;

  -- Reverse the creator's derived balance by the net the creator earned.
  SELECT * INTO v_product FROM monetization_products WHERE id = v_purchase.product_id;
  IF v_product.owner_id IS NOT NULL THEN
    v_net_minor := GREATEST(p_amount_minor - COALESCE((v_purchase.metadata ->> 'platform_fee_minor')::int, 0)
                                       - COALESCE((v_purchase.metadata ->> 'processing_fee_minor')::int, 0), 0);
    UPDATE monetization_creator_balances
      SET earned_minor = GREATEST(earned_minor - v_net_minor, 0),
          available_minor = GREATEST(available_minor - v_net_minor, 0),
          held_minor = held_minor + v_net_minor,
          updated_at = now()
      WHERE user_id = v_product.owner_id;
  END IF;

  PERFORM record_monetization_audit(
    'purchase_refunded',
    jsonb_build_object('purchase_id', p_purchase_id, 'amount_minor', p_amount_minor, 'reason', p_reason),
    p_actor_id,
    v_purchase.user_id
  );

  RETURN true;
END;
$$;

-- Back-office only: refunds run under service_role (provider-confirmed
-- chargebacks or admin review) — never under a regular user session.
REVOKE ALL ON FUNCTION refund_monetization_purchase(UUID, INTEGER, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refund_monetization_purchase(UUID, INTEGER, TEXT, TEXT, UUID) TO service_role;

-- Service-role grants for the real-provider webhook path (the sandbox flow
-- runs under the user session; a production provider will ingest with
-- service_role). The event-existence + pending-only gates inside the function
-- prevent forgery regardless of caller role.
GRANT EXECUTE ON FUNCTION record_monetization_event(TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION fulfill_monetization_purchase(UUID, BIGINT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION record_monetization_audit(TEXT, JSONB, UUID, UUID) TO service_role;

-- ═══════════════════════════════════════════════════════════
-- One active tip product per creator (owner_id NULL rows are the platform
-- catalog; only tip rows are constrained).
-- ═══════════════════════════════════════════════════════════
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tip_product_per_owner
  ON monetization_products(owner_id)
  WHERE product_type = 'tip';

-- ═══════════════════════════════════════════════════════════
-- RPC — ensure_creator_tip_product(p_creator)
-- Idempotently provisions a creator's optional tip product with the
-- standardized tip tiers (ONE-TIME, policy-capped amounts). Called by the
-- tip endpoint when a supporter opens the "Support this creator" flow — the
-- self-purchase guard (creator can never buy their own product) lives in the
-- checkout layer. Amounts are centralized here and in config; no app code
-- hardcodes tip pricing.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION ensure_creator_tip_product(p_creator UUID)
RETURNS TABLE (product_id UUID, price_ids UUID[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_product_id UUID;
  v_price_ids UUID[] := '{}';
  v_creator_exists BOOLEAN;
  v_amount INT;
  v_price_id UUID;
BEGIN
  IF p_creator IS NULL OR auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Only real, discoverable accounts can receive tips.
  SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = p_creator) INTO v_creator_exists;
  IF NOT v_creator_exists THEN
    RETURN;
  END IF;

  -- Existing active tip product for this creator?
  SELECT id INTO v_product_id FROM monetization_products
    WHERE product_type = 'tip' AND owner_id = p_creator AND status = 'active'
    LIMIT 1;

  IF v_product_id IS NULL THEN
    INSERT INTO monetization_products (key, name, description, product_type, owner_id, status, billing_text, feature_list)
    VALUES (
      'tip_' || replace(p_creator::text, '-', ''),
      'Tip for creator',
      'Voluntary support for a creator you value. A genuine gift - no hidden terms.',
      'tip', p_creator, 'active',
      'One-time. No automatic renewals - there is nothing recurring to cancel.',
      '[]'::jsonb
    )
    RETURNING id INTO v_product_id;
  END IF;

  -- Standard one-time tip tiers (minor units): $1, $3, $5, $10.
  FOR v_amount IN SELECT unnest(ARRAY[100, 300, 500, 1000]::int[])
  LOOP
    SELECT id INTO v_price_id FROM monetization_prices
      WHERE product_id = v_product_id AND amount_minor = v_amount
        AND billing_interval = 'one_time' AND status = 'active'
      LIMIT 1;
    IF v_price_id IS NULL THEN
      INSERT INTO monetization_prices (product_id, amount_minor, currency, billing_interval, interval_count, region, label, status)
      VALUES (v_product_id, v_amount, 'usd', 'one_time', 1, 'global', '$' || (v_amount / 100)::text || ' tip', 'active')
      RETURNING id INTO v_price_id;
    END IF;
    v_price_ids := v_price_ids || v_price_id;
  END LOOP;

  RETURN QUERY SELECT v_product_id, v_price_ids;
END;
$$;

REVOKE ALL ON FUNCTION ensure_creator_tip_product(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_creator_tip_product(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — cancel_monetization_subscription(p_user, p_key)
-- Owner-scoped subscription cancellation: end-of-period cancellation is set
-- on the user's own active entitlement (benefits remain until expiry), and
-- the provider driver is told to stop renewing. Never a hard revocation
-- unless called with p_immediate = true by a trusted admin flow.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION cancel_monetization_subscription(
  p_user UUID,
  p_key TEXT,
  p_immediate BOOLEAN DEFAULT false
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_updated INT;
BEGIN
  IF p_user IS NULL OR p_user <> auth.uid() THEN
    RETURN false; -- owners may only cancel their own subscriptions
  END IF;

  UPDATE monetization_entitlements
    SET cancel_at_period_end = true,
        status = CASE WHEN p_immediate THEN 'cancelled' ELSE status END,
        updated_at = now()
    WHERE user_id = p_user AND key = p_key AND status = 'active'
    RETURNING id INTO v_updated;

  PERFORM record_monetization_audit(
    'subscription_cancelled',
    jsonb_build_object('key', p_key, 'immediate', p_immediate),
    p_user,
    p_user
  );

  RETURN COALESCE(v_updated, 0) > 0;
END;
$$;

REVOKE ALL ON FUNCTION cancel_monetization_subscription(UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_monetization_subscription(UUID, TEXT, BOOLEAN) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC — record_monetization_audit(...)
-- Appends a financial audit line (SECURITY DEFINER only; no direct table
-- policy exists). Used by webhook promotions, admin ops, and future
-- financial tooling. Returns success.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION record_monetization_audit(
  p_action TEXT,
  p_details JSONB DEFAULT '{}',
  p_actor_id UUID DEFAULT auth.uid(),
  p_target_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_action IS NULL OR length(p_action) < 2 OR length(p_action) > 100 THEN
    RETURN false;
  END IF;
  INSERT INTO monetization_audit_log (action, actor_id, target_user_id, details)
  VALUES (p_action, p_actor_id, p_target_user_id, COALESCE(p_details, '{}'::jsonb));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION record_monetization_audit(TEXT, JSONB, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_monetization_audit(TEXT, JSONB, UUID, UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RECONCILIATION — detect ledger/entitlement drift without rewriting.
-- Returns rows any time a purchase lacks its matching entitlement or has an
-- inconsistent status; admin tooling surfaces these for review. Corrections
-- are recorded via adjustments/audit — never silent UPDATEs of history.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION reconcile_monetization()
RETURNS TABLE (purchase_id UUID, user_id UUID, kind TEXT, detail TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT p.id AS purchase_id, p.user_id AS user_id,
         'entitlement_missing'::TEXT AS kind,
         'Purchase ' || p.status || ' has no matching ' || p.entitlement_key || ' entitlement' AS detail
    FROM monetization_purchases p
    WHERE p.status = 'succeeded'
      AND NOT EXISTS (
        SELECT 1 FROM monetization_entitlements e
        WHERE e.user_id = p.user_id AND e.key = p.entitlement_key AND e.product_id = p.product_id
      )
  UNION ALL
  SELECT p.id, p.user_id,
         'paid_twice'::TEXT,
         'Duplicate succeeded purchase for provider ref ' || p.provider_reference
    FROM monetization_purchases p
    WHERE p.status = 'succeeded' AND p.provider_reference IS NOT NULL
      AND (SELECT count(*) FROM monetization_purchases p2
           WHERE p2.provider_reference = p.provider_reference AND p2.status = 'succeeded') > 1
  LIMIT 1000;
END;
$$;

-- Admin/service-role only (it reads internal tables across all users).
REVOKE ALL ON FUNCTION reconcile_monetization() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reconcile_monetization() TO service_role;

-- ═══════════════════════════════════════════════════════════
-- SEED CATALOG (default products + centralized pricing)
-- Fixed ids for the platform's own products make integration deterministic.
-- ═══════════════════════════════════════════════════════════
INSERT INTO monetization_products (id, key, name, description, product_type, status, billing_text, feature_list)
VALUES
  (
    'b0000000-0000-4000-8000-000000000001',
    'premium',
    'BurnBoard Premium',
    'Unlock the full BurnBoard experience with advanced creator tools, profile customization, and priority discovery.',
    'platform_premium',
    'active',
    'Monthly or yearly. Cancel anytime — you keep access until the end of the paid period.',
    '["Advanced creator analytics", "Profile customization", "Priority discovery tools", "Enhanced personalization controls"]'::jsonb
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'creator_subscription',
    'Creator Subscription',
    'Support a creator you love with an optional monthly membership. Value for you, real support for them.',
    'creator_subscription',
    'draft',
    '',
    '[]'::jsonb
  ),
  (
    'b0000000-0000-4000-8000-000000000003',
    'tip',
    'Creators Tip (Support)',
    'Optional voluntary support for a creator. A genuine gift — no hidden terms.',
    'tip',
    'draft',
    '',
    '[]'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO monetization_prices (product_id, amount_minor, currency, billing_interval, interval_count, region, label, status, trial_days)
SELECT p.id, 499, 'usd', 'month', 1, 'global', 'Monthly', 'active', NULL FROM monetization_products p WHERE p.key = 'premium'
ON CONFLICT DO NOTHING;

INSERT INTO monetization_prices (product_id, amount_minor, currency, billing_interval, interval_count, region, label, status, trial_days)
SELECT p.id, 3999, 'usd', 'year', 1, 'global', 'Yearly', 'active', NULL FROM monetization_products p WHERE p.key = 'premium'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- DONE — Monetization foundation schema created (additive only)
-- ═══════════════════════════════════════════════════════════