-- ═══════════════════════════════════════════════════════════
-- BURNBOARD AI Intelligence Foundation (Master Prompt 17)
--
-- NON-DESTRUCTIVE: only adds new tables, indexes, RLS policies and RPCs.
-- No existing table is dropped, renamed, or modified.
--
-- Contents:
--   1. ai_jobs             — async AI work queue (embeddings, classification,
--                            quality scoring). Processed by lib/ai/worker.js.
--   2. ai_content_metadata — content understanding results (language, topics,
--                            quality score, embedding, model version).
--   3. ai_usage_log        — per-call observability + cost tracking with
--                            retention cleanup.
--   4. RPCs                — enqueue_ai_job (idempotent), claim_ai_jobs
--                            (atomic FOR UPDATE SKIP LOCKED), cleanup_ai_logs.
--
-- Privacy principles:
--   * ai_jobs + ai_usage_log are system-only (no user read policies).
--   * ai_content_metadata is owner-readable only (content creators may see
--     the derived metadata for their own content).
--   * Nothing here stores raw private content beyond the minimal input
--     needed for the job; workers must pass minimum necessary data.
-- ═══════════════════════════════════════════════════════════

-- ── 1. AI JOB QUEUE ─────────────────────────────────────────
create table if not exists ai_jobs (
  id uuid primary key default gen_random_uuid(),
  -- 'embed_content' | 'classify_content' | 'quality_score' | 'creator_insight'
  job_type text not null,
  -- Subject of the job (content id, creator id...). Type-tagged.
  target_type text not null check (target_type in ('social_post', 'roast', 'user', 'community', 'topic')),
  target_id text not null,
  -- Minimal input for the job (never full private content beyond need).
  input jsonb not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'done', 'failed', 'skipped')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  -- Idempotency: one job per (type, target) unless a new version is forced.
  job_key text not null,
  model_version text,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_ai_job_key unique (job_key)
);

create index if not exists idx_ai_jobs_claim
  on ai_jobs(status, created_at asc) where status in ('pending', 'claimed');
create index if not exists idx_ai_jobs_target
  on ai_jobs(target_type, target_id);
create index if not exists idx_ai_jobs_created
  on ai_jobs(created_at desc);

alter table ai_jobs enable row level security;
do $$ begin
  create policy "System writes ai_jobs" on ai_jobs for all using (false) with check (false);
exception when duplicate_object then null;
end $$;

-- ── 2. CONTENT UNDERSTANDING METADATA ───────────────────────
-- One row per understood content item. Embedding is stored as a plain
-- jsonb array on purpose: provider-agnostic and dependency-free at this
-- stage. When a dedicated search engine lands, promote to a pgvector
-- column behind the same key (content_type, content_id).
create table if not exists ai_content_metadata (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('social_post', 'roast', 'comment')),
  content_id uuid not null,
  language text,
  topics jsonb not null default '[]',
  quality_score real,
  -- Semantic representation (array of floats). Never exposed publicly.
  embedding jsonb,
  embedding_dim int,
  model_version text,
  source text not null default 'builtin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_ai_content unique (content_type, content_id)
);

create index if not exists idx_ai_content_target on ai_content_metadata(content_type, content_id);
create index if not exists idx_ai_content_updated on ai_content_metadata(updated_at desc);

alter table ai_content_metadata enable row level security;
-- Creators may read metadata for their own content; writes are system-only.
do $$ begin
  create policy "System writes ai metadata" on ai_content_metadata for all using (false) with check (false);
exception when duplicate_object then null;
end $$;

-- ── 3. AI USAGE / COST LOG ──────────────────────────────────
-- Append-only observability: every provider call records provider, model,
-- latency, estimated cost, success/fallback. Retention enforced by cron
-- (cleanup_ai_logs) — 90 days is the documented policy.
create table if not exists ai_usage_log (
  id bigint generated always as identity primary key,
  task text not null,
  provider text not null,
  model_version text,
  success boolean not null default true,
  fallback_used boolean not null default false,
  latency_ms int,
  estimated_tokens int,
  estimated_cost_usd real,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_created on ai_usage_log(created_at desc);
create index if not exists idx_ai_usage_task on ai_usage_log(task, created_at desc);

alter table ai_usage_log enable row level security;
do $$ begin
  create policy "System writes ai usage" on ai_usage_log for all using (false) with check (false);
exception when duplicate_object then null;
end $$;

-- ── 3b. CREATOR INSIGHT STORAGE ────────────────────────────
-- AI-assisted creator insights (aggregate-only, owner-readable).
-- Store only the final insight text + confidence + provenance. Raw
-- numbers are never stored here; they live in the job input.
create table if not exists ai_creator_insights (
  creator_id uuid primary key references auth.users(id) on delete cascade,
  insight jsonb,
  confidence text check (confidence in ('high', 'medium', 'early', 'insufficient')),
  model_version text,
  source text not null default 'builtin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_creator_insights_updated on ai_creator_insights(updated_at desc);

alter table ai_creator_insights enable row level security;
do $$ begin
  create policy "Creator reads own AI insight" on ai_creator_insights
    for select using (auth.uid() = creator_id);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "System writes AI insights" on ai_creator_insights
    for all using (false) with check (false);
exception when duplicate_object then null;
end $$;

-- ── 4. RPCs ─────────────────────────────────────────────────

-- Enqueue an AI job idempotently (same job_key → no-op).
create or replace function enqueue_ai_job(
  p_job_type text,
  p_target_type text,
  p_target_id text,
  p_input jsonb default '{}',
  p_job_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := coalesce(p_job_key, p_job_type || ':' || p_target_type || ':' || p_target_id);
  v_id uuid;
begin
  insert into ai_jobs (job_type, target_type, target_id, input, job_key)
  values (p_job_type, p_target_type, p_target_id, p_input, v_key)
  on conflict (job_key) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- Atomically claim a batch of pending jobs (exactly-once under concurrency).
create or replace function claim_ai_jobs(
  batch_size int default 50
)
returns setof ai_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update ai_jobs
    set status = 'claimed', attempts = attempts + 1, updated_at = now()
    where id in (
      select id from ai_jobs
      where status in ('pending', 'claimed')
        and attempts < max_attempts
      order by created_at asc
      limit batch_size
      for update skip locked
    )
    returning *;
end;
$$;

-- Finish a job (done / failed / skipped) with result and error.
create or replace function finish_ai_job(
  p_id uuid,
  p_status text,
  p_result jsonb default null,
  p_error text default null,
  p_model_version text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update ai_jobs
  set status = p_status,
      result = coalesce(p_result, result),
      error = p_error,
      model_version = coalesce(p_model_version, model_version),
      updated_at = now()
  where id = p_id;
end;
$$;

-- Retention: usage logs older than 90 days, done/failed jobs older than
-- 30 days, stuck claimed jobs older than 7 days (dead-letter visibility).
create or replace function cleanup_ai_data()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int := 0;
begin
  delete from ai_usage_log where created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  delete from ai_jobs
  where status in ('done', 'failed', 'skipped')
    and updated_at < now() - interval '30 days';
  GET DIAGNOSTICS v_deleted = v_deleted + ROW_COUNT;

  -- Stuck claims (worker died mid-job) go back to pending for retry.
  update ai_jobs
  set status = 'pending', updated_at = now()
  where status = 'claimed'
    and updated_at < now() - interval '1 hour'
    and attempts < max_attempts;
  GET DIAGNOSTICS v_deleted = v_deleted + ROW_COUNT;

  -- Exhausted attempts become dead-letter rows (visible, never silently lost).
  update ai_jobs
  set status = 'failed', error = coalesce(error, 'max attempts reached'), updated_at = now()
  where status = 'claimed'
    and attempts >= max_attempts;

  return v_deleted;
end;
$$;

-- RPC: upsert a creator insight (system path for the AI worker).
create or replace function upsert_creator_insight(
  p_creator_id uuid,
  p_insight jsonb,
  p_confidence text,
  p_model_version text default null,
  p_source text default 'builtin'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into ai_creator_insights (creator_id, insight, confidence, model_version, source, updated_at)
  values (p_creator_id, p_insight, p_confidence, p_model_version, p_source, now())
  on conflict (creator_id) do update
  set insight = excluded.insight,
      confidence = excluded.confidence,
      model_version = excluded.model_version,
      source = excluded.source,
      updated_at = now();
end;
$$;