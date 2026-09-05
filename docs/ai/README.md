# BurnBoard AI — Intelligence, Personalization & Autonomous Product Engine

Master Prompt 17 documentation. BurnBoard's AI is designed to make the platform
feel like *"the more I use it, the better it understands what's valuable to me"*
— without users losing control, privacy, safety, or choice.

## Documents

| Document | Covers |
| --- | --- |
| [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md) | The 10-layer AI pipeline, provider abstraction, model routing, signal architecture, interest profile, content understanding, ranking, diversification, experimentation, feedback loops |
| [AI_SAFETY_PRIVACY.md](./AI_SAFETY_PRIVACY.md) | Confidence handling, hallucination protection, human-in-the-loop, blocking & privacy integration, user controls, explainability, anti-gaming, well-being, organic-vs-paid separation |
| [AI_OPERATIONS.md](./AI_OPERATIONS.md) | Quality metrics, offline/online evaluation, observability, cost control, retention & deletion, security/prompt injection, incident response |
| [AI_HEALTH.md](./AI_HEALTH.md) | MP27: recommendation health observability + rollback signals (dashboard, metric definitions, honest limitations) |
| [AI_ROADMAP.md](./AI_ROADMAP.md) | What exists today, what this release added, what NOT to build yet, next steps |
| [AI_OS.md](./AI_OS.md) | AI Operating System (MP22): orchestration layers, capability registry + risk model, Personal AI (guide/digest/polish), AI memory model (no hidden memory), transparency & fallbacks |
| [AI_AGENTS_GOVERNANCE.md](./AI_AGENTS_GOVERNANCE.md) | Agent architecture (Level 0–2 live), tool permissions, kill switches, incident response, cost governance, deferred capabilities |
| [AI_OS_ROADMAP.md](./AI_OS_ROADMAP.md) | MP22 roadmap: daily-use loop, Stage B experiments, gated write-agents, never-list |

## What MP22 (AI Operating System) added

- **AI Operating layer** — `lib/ai/registry.js` (capability registry + risk
  model), `lib/ai/os.js` (orchestration: per-user rate limits, opt-out
  enforcement, transparency), Personal AI tasks in `routing.js` + `flags.js`.
- **Personal AI hub** (`/ai`): **Guide** (grounded product Q&A with cited
  sources over a curated help corpus), **Digest** (read-only "while you were
  away" over your own follows/communities — computed from real rows, no
  inference), **Draft polish** (suggestions only, never auto-publishes).
- **AI memory controls** — `personal_ai_preferences` (visible, editable,
  clearable; no hidden memory) + `/api/ai/preferences`; user opt-outs are
  enforced server-side, not just in the UI.
- **Fixed:** batch worker called `executeTask` positionally against an
  object-signature API — background content understanding now runs end to
  end instead of failing every job.

## MP22 API surface (all additive)

`POST /api/ai/guide` · `GET /api/ai/digest` · `POST /api/ai/polish` ·
`GET/POST/DELETE /api/ai/preferences` — every route is flag-gated,
rate-limited, and (for digest) session-authenticated.


## What exists today (audit summary)

- **Personalization (MP12):** `lib/reco/` — server-validated behavioral signals
  (`rec_events`), proportional negative feedback (`rec_feedback`), decaying
  affinity graph (`user_affinities`), viewer state, cold-start handling,
  exploration vs exploitation, diversity re-ranking, explainable "why am I
  seeing this" strings, master on/off control + interest reset.
- **Creator analytics (MP13):** `lib/creator/analytics.js` — real-table
  aggregates, truthful rule-based insights (never fabricated).
- **AI assistance:** `lib/aiService.js` (hot-seat prompt + roast-style assist)
  and `app/api/roast-image/route.js` (Gemini vision) — user-initiated, optional.
- **Experiments:** `lib/experiments.js` — deterministic variant assignment,
  exposure/conversion tracking, guardrails.
- **Onboarding / next-best-action:** `lib/onboarding.js`, `lib/recommendations.js`.

## What this release added (Master Prompt 17)

- **`lib/ai/` domain** — provider abstraction (`provider.js`), task routing
  (`routing.js`), AI feature flags with staged rollout (`flags.js`),
  observability + cost tracking (`observability.js`), async worker
  (`worker.js`), builtin provider (`providers/builtin.js`).
- **Centralized integrations** — roast-image's direct Gemini call moved behind
  the abstraction; `lib/aiService.js` delegates through it (behavior unchanged).
- **`supabase/migrations/2026_09_08_ai_intelligence_foundation.sql`** —
  `ai_jobs` async queue (atomic claim, idempotent enqueue, dead-letter
  visibility), `ai_content_metadata` (language/topics/quality/embedding),
  `ai_usage_log` (cost/latency observability with 90-day retention),
  `ai_creator_insights` (owner-readable AI insight storage).
- **AI background worker** — `app/api/cron/ai/route.js` + hooked into the daily
  cleanup cron (no extra Vercel cron slot on Hobby).
- **AI-assisted creator insights** — `lib/creator/insights.js` + dashboard
  wiring: aggregate-only, async, flag-gated, never fabricated.
- **AI docs** — this set.

## What MP27 (Recommendation Intelligence) added

- **Recommendation health measurement** — `lib/reco/health.js` computes real
  aggregates from `rec_events` / `rec_feedback` / `user_affinities` /
  `user_personalization` / `ai_usage_log` / `ai_jobs` / `ai_content_metadata`
  (signals, negatives, creator concentration, new-creator reach, formats,
  user-control usage, AI cost/latency/failures).
- **`GET /api/admin/intelligence`** — admin-gated, aggregate-only, rollback
  signals computed from real data (never fabricated).
- **`/admin/ai` dashboard** — Recommendation Intelligence in the admin
  console, failure-soft per subsystem.
- **Content intelligence now reaches ranking (second pass)** — the For You
  scorer consumes `ai_content_metadata` via `lib/reco/contentQuality.js`:
  when a REAL provider has scored an item clearly low-quality, the item's
  popularity term is dampened so it cannot ride an engagement wave. Builtin
  rows and missing metadata change nothing; moderation stays the only
  removal authority.
- See [AI_HEALTH.md](./AI_HEALTH.md) for definitions, thresholds, and
  honest limitations.

## Golden rules

1. AI is optional, user-initiated, and never the only path to core functionality.
2. A provider outage degrades to builtin fallback — the core product never depends on one API.
3. Explicit negative feedback (blocks, not-interested) outranks any preference signal.
4. Never present inference as fact; low confidence means "insufficient data", not certainty.
5. Never log or send private content to AI processing beyond the minimum needed.
6. No hidden manipulation: no engagement-only optimization, no fake AI actions.