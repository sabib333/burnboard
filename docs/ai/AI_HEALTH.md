# BurnBoard AI — Recommendation Health & Rollback Signals (Master Prompt 27)

The measurement layer for the personalization & discovery system. MP12 built
the engine (signals → affinities → ranking → diversity → explanation); MP27
builds the **observability**: what is healthy, what is trending wrong, and
the evidence needed to roll a ranking change back.

Companion docs: [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md) (pipeline),
[AI_OPERATIONS.md](./AI_OPERATIONS.md) (evaluation/cost/incidents),
[AI_SAFETY_PRIVACY.md](./AI_SAFETY_PRIVACY.md) (guardrails).

## 1. Where the numbers come from (real rows only)

| Metric | Source | What it means |
| --- | --- | --- |
| Signals 7d / 24h | `rec_events` | Server-validated behavior volume (impressions, reactions, comments, follows, joins…) |
| Feed impressions | `rec_events` where `event_type = content_viewed` | Items actually served — deduped per item per day, so counts are lower bounds, not precise reach |
| Explicit negatives | `rec_feedback` (`hide`, `not_interested`) | Real user corrections; deduped per item per user |
| Negatives / 1k impressions | above | Directional dissatisfaction trend — **not** a precise rate (impression dedupe) |
| Creators reached | engagement signals → `context.author_id` | Distinct creators receiving genuine engagement |
| Top-10 concentration | share of the engagement sample | Echo-chamber / winner-take-all proxy |
| New-creator share | reached creators × `user_profiles.created_at` (< 90 days) | Cold-start fairness proxy |
| Communities reached / formats | engagement signals → `context.community_id`, `event_type` | Diversity of discovery |
| Affinity rows / personalized / opted out / resets | `user_affinities`, `user_personalization` | Interest-graph scale + explicit user control usage |
| AI calls / failures / fallbacks / cost / latency | `ai_usage_log` | Provider health + spend (append-only, 90-day retention) |
| AI queue pending / failed | `ai_jobs` | Background worker health, dead-letter visibility |

**Never** fabricated or extrapolated. Engagement concentration and new-creator
share are explicitly bounded samples (most recent 5,000 engagement signals),
labeled as such in the dashboard — never presented as a census.

## 2. Rollback signals for ranking changes

A ranking/feed experiment must be judged on these guardrails, not clicks:

| Signal | Threshold (directional) | Meaning |
| --- | --- | --- |
| Negative feedback rate | > 40 per 1k impressions / 7d | User corrections rising after a change → rollback candidate |
| Top-10 creator concentration | > 0.55 of sampled engagement | Winner-take-all feed dynamics forming |
| New-creator share | < 0.10 of reached creators (reach ≥ 20) | Exploration may have collapsed for new accounts |
| AI failure rate | > 10% of calls | Provider issue — product stays up via builtin fallback, but investigate |

Alerts are computed server-side (`/api/admin/intelligence`) and shown on the
`/admin/ai` dashboard. They are decision inputs — human review decides. See
[AI_OPERATIONS.md](./AI_OPERATIONS.md) §6 for the incident playbook
("Bad recommendations → disable the ranking flag/experiment").

## 3. What MP27 added

- **`lib/reco/health.js`** — aggregate health probes over real tables
  (`probeRecommendationHealth`, `probeAiHealth`). Server-only; requires the
  service-role key because `rec_events`/`rec_feedback`/`user_affinities` are
  owner-scoped under RLS and `ai_*` tables are system-only — the anon key
  would silently return zero rows, so it is refused, not masked.
- **`GET /api/admin/intelligence`** — admin-gated (MP26 gate, fail-closed),
  aggregate-only; computes the rollback signals above.
- **`/admin/ai`** — Recommendation Intelligence dashboard (linked from the
  admin console), in the same visual language as the Security / Infrastructure
  / Financial dashboards.
- **Content intelligence reaches ranking (second pass)** —
  `lib/reco/contentQuality.js` batch-reads `ai_content_metadata` for feed
  candidates; the For You scorer dampens the **popularity term** of items a
  REAL provider scored clearly low (`QUALITY.lowScore`, config). Evidence
  requires `source != 'builtin'` + `model_version`; builtin rows and missing
  metadata change nothing; moderation remains the only removal authority.
  The dashboard surfaces `coverage.providerMetadataRows` so you can see how
  much ranking evidence actually exists.

## 4. Honest limitations

- Impression counts are **deduped per item per day** → derived per-1k rates
  are trends, not precise metrics.
- Concentration/new-creator measures are **bounded samples** until volume
  justifies full computation.
- "Opted out" counts users who turned For You off — the anonymous/signed-out
  experience (generic ranking, no profiling) is by design and not counted.
- Per-user satisfaction (session surveys, explicit "why am I seeing this"
  feedback loops) does not exist yet; user corrections (`rec_feedback`) are
  the best available satisfaction signal today.
- Content-quality dampening is deliberately conservative: it only activates
  on real-provider rows, only for clearly-low scores, and only reduces one
  weighted term — never removes. Until provider metadata exists it is inert.
- This is the measurement layer. **DB-backed ranking experiments with
  automatic rollback enforcement** (roadmap item) come next: the signals
  above are their guardrail input.

## 5. Next maturity threshold

Phase 2 → Phase 3 of the AI scaling roadmap begins when the dashboard shows
sustained real signal volume (weekly active personalized users and genuine
engagement events) AND the team has recorded offline evaluation baselines
(see AI_OPERATIONS.md §2). Until then: no pgvector, no model-training
infrastructure, no re-ranking experiments — measurement first.
