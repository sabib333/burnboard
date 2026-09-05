-- BURN BOARD — Experiments & Growth Analytics Migration
-- Additive only. Does not modify existing tables.

-- ── Experiments Table ────────────────────────────────────────
-- Stores experiment configuration (for server-side management)

CREATE TABLE IF NOT EXISTS experiments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  variants JSONB NOT NULL DEFAULT '[]',
  primary_metric TEXT,
  guardrail_metrics JSONB DEFAULT '[]',
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Experiment Assignments Table ──────────────────────────────
-- Stores user variant assignments (for server-side persistence)

CREATE TABLE IF NOT EXISTS experiment_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL, -- user_id or anonymous session id
  variant TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(experiment_id, subject_id)
);

-- ── Experiment Exposures Table ────────────────────────────────
-- Stores exposure events (for accurate conversion tracking)

CREATE TABLE IF NOT EXISTS experiment_exposures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  variant TEXT NOT NULL,
  exposed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(experiment_id, subject_id) -- one exposure per user per experiment
);

-- ── Experiment Conversions Table ──────────────────────────────
-- Stores conversion events

CREATE TABLE IF NOT EXISTS experiment_conversions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  variant TEXT NOT NULL,
  event TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  converted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Growth Events Table ──────────────────────────────────────
-- Stores aggregate growth funnel events (privacy-conscious)

CREATE TABLE IF NOT EXISTS growth_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  subject_id TEXT, -- optional, can be anonymous
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────

-- Experiments
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_key ON experiments(key);

-- Assignments
CREATE INDEX IF NOT EXISTS idx_assignments_experiment ON experiment_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_assignments_subject ON experiment_assignments(subject_id);

-- Exposures
CREATE INDEX IF NOT EXISTS idx_exposures_experiment ON experiment_exposures(experiment_id);
CREATE INDEX IF NOT EXISTS idx_exposures_subject ON experiment_exposures(subject_id);
CREATE INDEX IF NOT EXISTS idx_exposures_variant ON experiment_exposures(experiment_id, variant);

-- Conversions
CREATE INDEX IF NOT EXISTS idx_conversions_experiment ON experiment_conversions(experiment_id);
CREATE INDEX IF NOT EXISTS idx_conversions_subject ON experiment_conversions(subject_id);
CREATE INDEX IF NOT EXISTS idx_conversions_variant ON experiment_conversions(experiment_id, variant);
CREATE INDEX IF NOT EXISTS idx_conversions_event ON experiment_conversions(experiment_id, event);

-- Growth Events
CREATE INDEX IF NOT EXISTS idx_growth_events_type ON growth_events(event_type);
CREATE INDEX IF NOT EXISTS idx_growth_events_created ON growth_events(created_at);

-- ── RPC Functions ────────────────────────────────────────────

-- Get experiment by key
CREATE OR REPLACE FUNCTION get_experiment_by_key(p_key TEXT)
RETURNS TABLE (
  id UUID,
  key TEXT,
  name TEXT,
  description TEXT,
  status TEXT,
  variants JSONB,
  primary_metric TEXT,
  guardrail_metrics JSONB,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.key, e.name, e.description, e.status, e.variants, 
         e.primary_metric, e.guardrail_metrics, e.start_at, e.end_at
  FROM experiments e
  WHERE e.key = p_key AND e.status = 'active';
END;
$$;

-- Get or create assignment (stable assignment)
CREATE OR REPLACE FUNCTION get_or_create_assignment(
  p_experiment_id UUID,
  p_subject_id TEXT,
  p_variants JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_variant TEXT;
  v_hash BIGINT;
  v_index INTEGER;
BEGIN
  -- Check existing assignment
  SELECT variant INTO v_variant
  FROM experiment_assignments
  WHERE experiment_id = p_experiment_id AND subject_id = p_subject_id;
  
  IF v_variant IS NOT NULL THEN
    RETURN v_variant;
  END IF;
  
  -- Create deterministic assignment based on hash
  v_hash := hashtext(p_experiment_id::TEXT || p_subject_id);
  v_index := abs(v_hash) % jsonb_array_length(p_variants);
  v_variant := p_variants->>v_index;
  
  -- Insert assignment
  INSERT INTO experiment_assignments (experiment_id, subject_id, variant)
  VALUES (p_experiment_id, p_subject_id, v_variant)
  ON CONFLICT (experiment_id, subject_id) DO NOTHING;
  
  RETURN v_variant;
END;
$$;

-- Record exposure (idempotent)
CREATE OR REPLACE FUNCTION record_experiment_exposure(
  p_experiment_id UUID,
  p_subject_id TEXT,
  p_variant TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO experiment_exposures (experiment_id, subject_id, variant)
  VALUES (p_experiment_id, p_subject_id, p_variant)
  ON CONFLICT (experiment_id, subject_id) DO NOTHING;
  
  RETURN FOUND;
END;
$$;

-- Record conversion (with exposure check)
CREATE OR REPLACE FUNCTION record_experiment_conversion(
  p_experiment_id UUID,
  p_subject_id TEXT,
  p_event TEXT,
  p_data JSONB DEFAULT '{}'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_variant TEXT;
BEGIN
  -- Check exposure first
  SELECT variant INTO v_variant
  FROM experiment_exposures
  WHERE experiment_id = p_experiment_id AND subject_id = p_subject_id;
  
  IF v_variant IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Record conversion
  INSERT INTO experiment_conversions (experiment_id, subject_id, variant, event, data)
  VALUES (p_experiment_id, p_subject_id, v_variant, p_event, p_data);
  
  RETURN TRUE;
END;
$$;

-- Get experiment report (aggregate)
CREATE OR REPLACE FUNCTION get_experiment_report(p_experiment_id UUID)
RETURNS TABLE (
  variant TEXT,
  exposures BIGINT,
  conversions BIGINT,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.variant,
    COUNT(DISTINCT e.subject_id) as exposures,
    COUNT(DISTINCT c.subject_id) as conversions,
    CASE 
      WHEN COUNT(DISTINCT e.subject_id) > 0 
      THEN ROUND(COUNT(DISTINCT c.subject_id)::NUMERIC / COUNT(DISTINCT e.subject_id) * 100, 2)
      ELSE 0 
    END as conversion_rate
  FROM experiment_exposures e
  LEFT JOIN experiment_conversions c 
    ON e.experiment_id = c.experiment_id 
    AND e.subject_id = c.subject_id
    AND e.variant = c.variant
  WHERE e.experiment_id = p_experiment_id
  GROUP BY e.variant;
END;
$$;

-- ── Row Level Security ───────────────────────────────────────

ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_exposures ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_events ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage experiments" ON experiments
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage assignments" ON experiment_assignments
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage exposures" ON experiment_exposures
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage conversions" ON experiment_conversions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage growth events" ON growth_events
  FOR ALL USING (auth.role() = 'service_role');

-- Anonymous insert for growth events (privacy-conscious)
CREATE POLICY "Anyone can insert growth events" ON growth_events
  FOR INSERT WITH CHECK (true);

-- ── Comments ─────────────────────────────────────────────────

COMMENT ON TABLE experiments IS 'A/B experiment configurations';
COMMENT ON TABLE experiment_assignments IS 'Stable variant assignments per user';
COMMENT ON TABLE experiment_exposures IS 'Exposure tracking for conversion attribution';
COMMENT ON TABLE experiment_conversions IS 'Conversion events tied to experiments';
COMMENT ON TABLE growth_events IS 'Privacy-conscious aggregate growth funnel events';
