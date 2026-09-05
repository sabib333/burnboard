# BurnBoard AI — Operations

Quality metrics, evaluation, observability, cost control, incident response,
and the security/retention practices that keep AI safe to operate.

---

## 1. AI quality metrics (Section 42)

Measure more than engagement:

| Metric | Source | Why |
| --- | --- | --- |
| Hide / Not-interested rate | `rec_feedback` | Explicit dissatisfaction signal |
| Report rate | `reports` | Safety incidents |
| Follow quality (follow → engagement conversion) | `follows` × `rec_events` | Discovery success |
| Creator discovery success (new-creator exposure → follow) | feed impressions × follows | Cold-start fairness |
| Recommendation repetition | feed diversity instrumentation | Filter-bubble guard |
| Retention (D7/D30) | auth/activity | Value, not just time spent |
| AI failure / fallback rate | `ai_usage_log`, `ai.calls.fallback` | Provider health |
| Latency & cost per task | `ai_usage_log`, `/api/metrics` | Performance + budget |

**Never** declare an AI feature successful on clicks alone.

## 2. Offline evaluation (Section 43)

Before rollout of any model/ranking change:
- Precision/recall on labeled content (topic classification).
- Safety false-positive / false-negative review on moderation-classified items.
- Diversity checks (creator/topic concentration in ranked output).
- Latency + cost per task from the routing tiers.
Production is not the place to discover obvious failures.

## 3. Online evaluation (Section 44)

Controlled rollout only (feature flags + experiments): compare control vs
treatment on engagement quality, negative feedback, retention, safety,
performance and cost. Roll back automatically if guardrails trip
(`lib/experiments.js` guardrail checks).

## 4. Observability (Sections 45–46)

- In-memory: `ai.calls`, `ai.calls.success/failure`, `ai.calls.fallback`,
  `ai.latency` (p50/p95/p99), `ai.cost.usd_micro` — visible at `/api/metrics`.
- Durable: `ai_usage_log` records task, provider, model version, success,
  fallback, latency, tokens, estimated cost (90-day retention).
- **Model versioning:** `ai_content_metadata.model_version` and
  `ai_creator_insights.model_version` + `ai_usage_log.model_version` record
  exactly which model/prompt produced every result; rollback = flip the flag
  or provider env — tracked, never silent.
- **Never log prompts or private data.**

## 5. Cost control (Section 48)

- Task routing tiers keep cheap work cheap (no expensive model for assist).
- Async processing: embeddings/classification/insights run in the daily
  worker, never in user requests.
- Rate limits per user + per IP on AI endpoints; in-memory per-user hourly
  caps in `lib/aiService.js`.
- Builtin fallback costs $0 — the default when no provider key exists.
- `ai_usage_log` + `ai.cost.*` metrics surface spend trends before they spike.

## 6. Incident response (Section 67)

| Incident | Immediate action |
| --- | --- |
| Bad recommendations (widespread negative feedback) | Disable the ranking flag / experiment; serve fallback ranking |
| Model/provider outage | Nothing to do — fallback chain serves builtin; verify `ai.calls.fallback` rate; core platform unaffected |
| Safety failure (AI surfaced harmful content) | `AI_EMERGENCY_DISABLE=1` for the capability; moderation pipeline remains authoritative; postmortem |
| Unexpected cost spike | Check `ai.cost.*` + `ai_usage_log`; tighten rate limits / batch size; lower tier |
| Incorrect classification at scale | Inspect `ai_content_metadata` rows (source/model_version); disable the job type; re-run with fixed model |
| Data pipeline corruption | Jobs are idempotent + dead-lettered (`ai_jobs`); replay by re-enqueuing; verify `cleanup_ai_data` |

**Never leave harmful model behavior running while investigating** — the
emergency flag is a one-env-var kill switch.

## 7. Retention & deletion (Sections 52–53)

- `ai_usage_log`: 90 days (cron `cleanup_ai_data`).
- `ai_jobs`: finished/failed/skipped 30 days; stuck claims requeued after 1h;
  exhausted attempts dead-lettered as `failed` (visible, not lost).
- User deletion cascades through `rec_events`, `user_affinities`,
  `rec_feedback`, `ai_creator_insights` (FK ON DELETE CASCADE). Content
  deletion removes `ai_content_metadata` by (content_type, content_id) key.
- Policy: no data retained indefinitely without a reason.

## 8. Security (Sections 54–56)

- Provider keys server-side only; `.env.local` gitignored; secrets in platform
  stores.
- All AI endpoints rate-limited; `requireProvider` tasks refuse to run
  unconfigured rather than degrade silently.
- User text is untrusted input, never system instructions (prompt-injection
  defense is structural: system prompts are built server-side).
- `ai_jobs`/`ai_usage_log` system-only RLS; all mutation via SECURITY DEFINER
  RPCs (idempotent `enqueue_ai_job`, atomic `claim_ai_jobs`).

## 9. Operating the worker

- Runs daily inside `/api/cron/cleanup` (no extra Vercel cron slot) and
  standalone at `/api/cron/ai?batch=50` (CRON_SECRET protected).
- Idempotent by design: overlapping runs claim disjoint batches
  (`FOR UPDATE SKIP LOCKED`); crashes requeue claims; results upsert.
- Watch: `claimed` vs `completed` vs `errors` in the cron response, and the
  `ai_jobs` dead-letter rows.