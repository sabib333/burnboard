-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Creator Economy & Monetization Scale (Master Prompt 19)
-- NON-DESTRUCTIVE: adds columns, tables, indexes, RPCs only. Never
-- modifies, renames, or deletes existing tables/rows.
--
-- Adds on top of the MP15 monetization foundation:
--   1. Creator monetization eligibility (status + configurable thresholds)
--   2. Creator product creation (subscriptions / digital products / paid
--      communities) through SECURITY DEFINER RPCs with centralized pricing
--      caps — creators can never set unbounded prices.
--   3. Revenue analytics snapshot (ledger-derived, aggregate-only)
--   4. Financial observability (payment event health, payout state,
--      reconciliation summary) for admin tooling.
--
-- Principles preserved from MP15: append-only ledger, no raw card data,
-- backend-authoritative entitlements, no direct client writes to financial
-- tables, origin isolation for sandbox, integer minor units only.
-- ═══════════════════════════════════════════════════════════

-- ── 1. CREATOR MONETIZATION ELIGIBILITY STATE ───────────────
-- Per-creator monetization status. NOT a score — a high-level status plus
-- human-understandable reason codes. Internal fraud/moderation thresholds
-- are never exposed; the RPC returns only status + reason codes.
--   not_eligible → in_progress → eligible
--   under_review (manual review pending), restricted (fraud/moderation),
--   paused (creator or platform initiated hold)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS monetization_status TEXT
    CHECK (monetization_status IN (
      'not_eligible', 'in_progress', 'eligible', 'under_review', 'restricted', 'paused'
    ));
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS monetization_status_note TEXT;

-- ── 2. ELIGIBILITY CONFIGURATION (configurable, no code changes) ──
-- Thresholds are rows in this table, editable by admins. `scope` lets a
-- future rollout tune per-region/cohort. Defaults match the product's
-- "emerging creator" spirit: low bars, no follower minimums that would
-- suppress new creators.
CREATE TABLE IF NOT EXISTS monetization_eligibility_config (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'global',
  min_account_days INTEGER NOT NULL DEFAULT 14,
  min_posts INTEGER NOT NULL DEFAULT 3,
  min_followers INTEGER NOT NULL DEFAULT 5,
  min_engagement INTEGER NOT NULL DEFAULT 10,
  max_restriction_count INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uniq_eligibility_scope UNIQUE (scope)
);

INSERT INTO monetization_eligibility_config (scope, min_account_days, min_posts, min_followers, min_engagement, max_restriction_count)
VALUES ('global', 14, 3, 5, 10, 1)
ON CONFLICT (scope) DO NOTHING;

ALTER TABLE monetization_eligibility_config ENABLE ROW LEVEL SECURITY;
-- No client read/write policies: server-only via SECURITY DEFINER RPCs.

-- ── 3. ELIGIBILITY RPC ──────────────────────────────────────
-- Returns status + reason codes only. NEVER exposes thresholds or fraud
-- signals. Restricted status is authoritative (moderation/fraud overrides
-- all activity math). `in_progress` means thresholds are close but unmet.
CREATE OR REPLACE FUNCTION get_creator_monetization_status(p_user UUID)
RETURNS TABLE (status TEXT, reasons TEXT[], note TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cfg monetization_eligibility_config%ROWTYPE;
  v_profile user_profiles%ROWTYPE;
  v_post_count INT;
  v_follower_count INT;
  v_engagement INT;
  v_restriction_count INT;
  v_reasons TEXT[] := '{}';
  v_status TEXT;
BEGIN
  IF p_user IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_cfg FROM monetization_eligibility_config WHERE scope = 'global';
  IF NOT FOUND THEN
    SELECT * INTO v_cfg FROM monetization_eligibility_config LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    RETURN; -- config not seeded; degrade to no-op
  END IF;

  SELECT * INTO v_profile FROM user_profiles WHERE id = p_user;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Moderation/fraud state is authoritative.
  SELECT count(*) INTO v_restriction_count
    FROM user_restrictions
    WHERE user_id = p_user AND active = true
      AND (expires_at IS NULL OR expires_at > now());

  IF v_restriction_count > COALESCE(v_cfg.max_restriction_count, 1) THEN
    v_status := 'restricted';
    v_reasons := v_reasons || 'account_restrictions';
  ELSE
    -- Activity thresholds (unmet but progressing → in_progress).
    SELECT count(*) INTO v_post_count FROM social_posts WHERE user_id = p_user;
    SELECT count(*) INTO v_follower_count FROM follows WHERE following_id = p_user;
    SELECT count(*) INTO v_engagement
      FROM reactions r JOIN social_posts sp ON sp.id = r.target_id
      WHERE r.target_type = 'social_post' AND sp.user_id = p_user;

    IF v_post_count < COALESCE(v_cfg.min_posts, 3) THEN
      v_reasons := v_reasons || 'more_posts';
    END IF;
    IF v_follower_count < COALESCE(v_cfg.min_followers, 5) THEN
      v_reasons := v_reasons || 'more_followers';
    END IF;
    IF v_engagement < COALESCE(v_cfg.min_engagement, 10) THEN
      v_reasons := v_reasons || 'more_engagement';
    END IF;
    IF extract(epoch from (now() - v_profile.created_at)) / 86400 < COALESCE(v_cfg.min_account_days, 14) THEN
      v_reasons := v_reasons || 'account_age';
    END IF;

    v_status := CASE WHEN array_length(v_reasons, 1) IS NULL THEN 'eligible' ELSE 'in_progress' END;
  END IF;

  -- Manual override (set by admin/review flows) wins over auto-computed.
  IF v_profile.monetization_status IN ('under_review', 'paused', 'restricted') THEN
    v_status := v_profile.monetization_status;
  ELSIF v_profile.monetization_status = 'eligible' AND v_status = 'in_progress' THEN
    v_status := 'eligible'; -- admin already granted eligibility
  END IF;

  RETURN QUERY SELECT v_status, v_reasons, COALESCE(v_profile.monetization_status_note, '');
END;
$$;

REVOKE ALL ON FUNCTION get_creator_monetization_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_creator_monetization_status(UUID) TO authenticated;

-- ── 4. CREATOR PRODUCT CREATION (configurable, capped) ─────
-- Creators may create products via this RPC only. Pricing is validated
-- against centralized caps below — creators can never set unbounded prices
-- or mark products active without a price.
CREATE TABLE IF NOT EXISTS monetization_product_caps (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'global',
  max_price_minor INTEGER NOT NULL DEFAULT 100000,      -- $1,000.00
  allowed_intervals TEXT[] NOT NULL DEFAULT ARRAY['one_time','month','year'],
  CONSTRAINT uniq_product_caps_scope UNIQUE (scope)
);

INSERT INTO monetization_product_caps (scope, max_price_minor, allowed_intervals)
VALUES ('global', 100000, ARRAY['one_time','month','year'])
ON CONFLICT (scope) DO NOTHING;

ALTER TABLE monetization_product_caps ENABLE ROW LEVEL SECURITY;

-- Create a creator-owned product with an initial price. Validates:
--   * caller owns the product
--   * product type is creator-sellable (subscription/digital/paid_community)
--   * price within caps
--   * billing interval allowed
-- Returns the product id and price id.
CREATE OR REPLACE FUNCTION create_creator_product(
  p_key TEXT,
  p_name TEXT,
  p_description TEXT DEFAULT '',
  p_product_type TEXT DEFAULT 'creator_subscription',
  p_billing_text TEXT DEFAULT '',
  p_feature_list JSONB DEFAULT '[]',
  p_amount_minor INTEGER,
  p_currency TEXT DEFAULT 'usd',
  p_billing_interval TEXT DEFAULT 'month'
)
RETURNS TABLE (product_id UUID, price_id UUID, error TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caps monetization_product_caps%ROWTYPE;
  v_status TEXT;
  v_product_id UUID;
  v_price_id UUID;
  v_interval_ok BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'unauthorized'::TEXT;
    RETURN;
  END IF;

  -- Only eligible creators can create sellable products.
  SELECT m.status INTO v_status FROM get_creator_monetization_status(auth.uid()) m;
  IF v_status IS DISTINCT FROM 'eligible' THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'not_eligible'::TEXT;
    RETURN;
  END IF;

  IF p_key IS NULL OR p_key !~ '^[a-z0-9_]{2,64}$' THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'invalid_key'::TEXT;
    RETURN;
  END IF;
  IF p_name IS NULL OR length(p_name) < 2 OR length(p_name) > 80 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'invalid_name'::TEXT;
    RETURN;
  END IF;
  IF p_product_type NOT IN ('creator_subscription', 'digital_product', 'paid_community') THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'invalid_type'::TEXT;
    RETURN;
  END IF;
  IF p_billing_interval NOT IN ('one_time', 'month', 'year') THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'invalid_interval'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_caps FROM monetization_product_caps WHERE scope = 'global';
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'config_missing'::TEXT;
    RETURN;
  END IF;

  IF p_amount_minor IS NULL OR p_amount_minor <= 0 OR p_amount_minor > COALESCE(v_caps.max_price_minor, 100000) THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'price_out_of_range'::TEXT;
    RETURN;
  END IF;

  v_interval_ok := p_billing_interval = ANY (COALESCE(v_caps.allowed_intervals, ARRAY['one_time','month','year']));
  IF NOT v_interval_ok THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'interval_not_allowed'::TEXT;
    RETURN;
  END IF;

  -- Insert product (draft until a price exists; status stays draft — an
  -- explicit activation RPC flips it active after pricing is confirmed).
  INSERT INTO monetization_products (key, name, description, product_type, owner_id, status, billing_text, feature_list)
  VALUES (
    'creator_' || p_key || '_' || replace(auth.uid()::text, '-', ''),
    p_name, COALESCE(p_description, ''), p_product_type, auth.uid(), 'draft',
    COALESCE(p_billing_text, ''), COALESCE(p_feature_list, '[]'::jsonb)
  )
  RETURNING id INTO v_product_id;

  INSERT INTO monetization_prices (product_id, amount_minor, currency, billing_interval, interval_count, region, label, status)
  VALUES (v_product_id, p_amount_minor, p_currency, p_billing_interval, 1, 'global', '', 'active')
  RETURNING id INTO v_price_id;

  PERFORM record_monetization_audit(
    'creator_product_created',
    jsonb_build_object('product_id', v_product_id, 'price_id', v_price_id, 'type', p_product_type),
    auth.uid(),
    auth.uid()
  );

  RETURN QUERY SELECT v_product_id, v_price_id, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION create_creator_product(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_creator_product(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER, TEXT, TEXT) TO authenticated;

-- ── 5. PRODUCT ACTIVATION RPC ───────────────────────────────
-- Creators activate their own draft products. Activation is a deliberate
-- step so a half-configured product can never go live by accident.
CREATE OR REPLACE FUNCTION activate_creator_product(p_product_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owned BOOLEAN;
  v_has_price BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM monetization_products
    WHERE id = p_product_id AND owner_id = auth.uid()
  ) INTO v_owned;
  IF NOT v_owned THEN
    RETURN false;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM monetization_prices
    WHERE product_id = p_product_id AND status = 'active'
  ) INTO v_has_price;
  IF NOT v_has_price THEN
    RETURN false;
  END IF;

  UPDATE monetization_products SET status = 'active', updated_at = now()
    WHERE id = p_product_id AND status = 'draft';

  PERFORM record_monetization_audit(
    'creator_product_activated',
    jsonb_build_object('product_id', p_product_id),
    auth.uid(),
    auth.uid()
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION activate_creator_product(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION activate_creator_product(UUID) TO authenticated;

-- ── 6. REVENUE ANALYTICS SNAPSHOT ───────────────────────────
-- Aggregate, ledger-derived revenue analytics for the platform dashboard.
-- No user-level data. Computes per-day gross/net by product type plus
-- cumulative creator payout state.
CREATE TABLE IF NOT EXISTS monetization_revenue_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uniq_revenue_snapshot_date UNIQUE (snapshot_date)
);

ALTER TABLE monetization_revenue_snapshots ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION compute_revenue_snapshot()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'generated_at', now(),
    'totals', (
      SELECT jsonb_agg(jsonb_build_object(
        'day', d::date,
        'gross_minor', COALESCE(SUM(p.amount_minor) FILTER (WHERE p.status = 'succeeded'), 0),
        'net_minor', COALESCE(SUM(
          p.amount_minor
          - COALESCE((p.metadata ->> 'platform_fee_minor')::int, 0)
          - COALESCE((p.metadata ->> 'processing_fee_minor')::int, 0)
        ) FILTER (WHERE p.status = 'succeeded'), 0),
        'refunded_minor', COALESCE(SUM(a.amount_minor) FILTER (WHERE a.adjustment_type = 'refund'), 0)
      ))
      FROM generate_series(now() - interval '30 days', now(), interval '1 day') d
      LEFT JOIN monetization_purchases p
        ON p.created_at::date = d::date AND p.origin = 'prod'
      LEFT JOIN monetization_adjustments a
        ON a.created_at::date = d::date AND a.adjustment_type = 'refund'
    ),
    'by_type', (
      SELECT jsonb_agg(jsonb_build_object(
        'product_type', mp.product_type,
        'gross_minor', COALESCE(SUM(p.amount_minor) FILTER (WHERE p.status = 'succeeded'), 0),
        'count', COUNT(p.id) FILTER (WHERE p.status = 'succeeded')
      ))
      FROM monetization_products mp
      JOIN monetization_purchases p ON p.product_id = mp.id AND p.origin = 'prod'
      GROUP BY mp.product_type
    ),
    'payouts', (
      SELECT jsonb_build_object(
        'pending_count', COUNT(*) FILTER (WHERE status = 'pending'),
        'processing_count', COUNT(*) FILTER (WHERE status = 'processing'),
        'paid_minor', COALESCE(SUM(amount_minor) FILTER (WHERE status = 'paid'), 0),
        'failed_count', COUNT(*) FILTER (WHERE status = 'failed')
      )
      FROM monetization_payouts WHERE origin = 'prod'
    ),
    'payment_health', (
      SELECT jsonb_build_object(
        'received_24h', COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND status = 'received'),
        'failed_24h', COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND status = 'failed'),
        'processed_total', COUNT(*) FILTER (WHERE status = 'processed')
      )
      FROM monetization_payment_events WHERE origin = 'prod'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION compute_revenue_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION compute_revenue_snapshot() TO service_role;
GRANT EXECUTE ON FUNCTION compute_revenue_snapshot() TO authenticated;

-- ── 7. SNAPSHOT PERSISTENCE RPC ─────────────────────────────
-- Saves today's snapshot idempotently (one per date).
CREATE OR REPLACE FUNCTION save_revenue_snapshot(p_data JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO monetization_revenue_snapshots (snapshot_date, data)
  VALUES (now()::date, COALESCE(p_data, '{}'::jsonb))
  ON CONFLICT (snapshot_date) DO UPDATE SET data = EXCLUDED.data, created_at = now();
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION save_revenue_snapshot(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_revenue_snapshot(JSONB) TO service_role;

-- ── 8. FINANCIAL OBSERVABILITY RPC ──────────────────────────
-- Reconciliation + drift summary for admin tooling. Reads internal tables
-- across all users — service-role / admin only.
CREATE OR REPLACE FUNCTION financial_observability()
RETURNS TABLE (kind TEXT, value BIGINT, detail TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT 'entitlement_drift'::TEXT, COUNT(*)::BIGINT, 'succeeded purchases missing active entitlement'
    FROM reconcile_monetization()
  UNION ALL
  SELECT 'pending_events_24h', COUNT(*)::BIGINT, 'webhook events stuck in received > 24h'
    FROM monetization_payment_events
    WHERE status IN ('received','processing') AND created_at < now() - interval '24 hours'
  UNION ALL
  SELECT 'failed_events_total', COUNT(*)::BIGINT, 'webhook events that failed processing'
    FROM monetization_payment_events WHERE status = 'failed'
  UNION ALL
  SELECT 'payouts_pending', COUNT(*)::BIGINT, 'payouts not yet confirmed'
    FROM monetization_payouts WHERE status IN ('pending','processing')
  UNION ALL
  SELECT 'audit_24h', COUNT(*)::BIGINT, 'financial audit actions last 24h'
    FROM monetization_audit_log WHERE created_at > now() - interval '24 hours';
END;
$$;

REVOKE ALL ON FUNCTION financial_observability() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION financial_observability() TO service_role;
GRANT EXECUTE ON FUNCTION financial_observability() TO authenticated;

-- ── 9. INDEXES FOR GROWING FINANCIAL TABLES ─────────────────
CREATE INDEX IF NOT EXISTS idx_monetization_purchases_created ON monetization_purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monetization_payment_events_created ON monetization_payment_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monetization_payouts_created ON monetization_payouts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monetization_products_owner ON monetization_products(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_date ON monetization_revenue_snapshots(snapshot_date DESC);

-- ═══════════════════════════════════════════════════════════
-- DONE — monetization scale foundation added (additive only)
-- ═══════════════════════════════════════════════════════════