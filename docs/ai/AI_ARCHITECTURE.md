# BurnBoard AI Architecture

The 10-layer AI pipeline, the provider abstraction, routing, signals, interest
profiles, content understanding, ranking, and feedback loops — mapped to what
is actually implemented.

---

## 1. The pipeline (Section 1 of the master prompt)

```
SIGNALS → UNDERSTANDING → CANDIDATES → SAFETY → PERSONALIZATION → RANKING → EXPERIENCE
```

Implemented in `lib/reco/` (MP12) plus `lib/ai/` (MP17):

| Layer | Where | Status |
| --- | --- | --- |
| 1. Signal collection | `lib/reco/signals.js` → `rec_events` | ✅ server-validated, idempotent |
| 2. Feature/context generation | `lib/reco/viewer.js` (viewer state) | ✅ |
| 3. Content understanding | `ai_content_metadata` + builtin classifier | ✅ foundation (async worker) |
| 4. Candidate generation | `lib/reco/feedBuilder.js` (6 pools) | ✅ |
| 5. Safety filtering | `lib/safety.js` (blocks, moderation) + `applyEligibility` | ✅ |
| 6. Personalization | affinity graph + viewer state | ✅ |
| 7. Ranking | `buildScorer` + diversity re-rank | ✅ |
| 8. Experimentation | `lib/experiments.js` | ✅ foundation |
| 9. Observability | `lib/ai/observability.js` → `/api/metrics` | ✅ added |
| 10. Feedback & improvement | `rec_feedback` + `applyFeedbackLearning` | ✅ |

No single module does everything — each layer is independently replaceable.

## 2. AI provider abstraction (Section 2)

`lib/ai/provider.js` — the single door for all AI:

```
PRODUCT CODE → executeTask({ task, params }) → lib/ai/routing.js
                                                → provider (gemini) with fallback
                                                → builtin (rule-based, always available)
                                                → observability + cost
```

- **No route/component calls a provider API directly** anymore. The only
  external AI call (`app/api/roast-image`) now goes through
  `generateVisionRoast` in the abstraction. `lib/aiService.js` delegates
  through `executeTask` with identical behavior.
- **Fallback chain:** configured provider → builtin → clean error. A Gemini
  outage degrades assist features to the builtin rules instantly.
- **Safety gate:** every AI text output passes `isProfane` validation before
  leaving the abstraction (suggestions/variations/roasts).

## 3. Model routing (Section 3)

`lib/ai/routing.js` defines tiers by latency/cost:

| Tier | Tasks | Timeout | Cost model |
| --- | --- | --- | --- |
| `realtime` | hot-seat assist, roast-style assist | 10s | cheap generation |
| `vision` | roast-image | 20s | image tokens |
| `batch` | classify, embed, creator insight | 30s | cheapest (background only) |

`providerForTask` picks a provider per task (env `AI_PROVIDER_<TASK>`,
`AI_PROVIDER`, or builtin when no key). Cheap work never hits expensive models,
and tasks a provider can't serve skip it entirely (no doomed network calls).

## 4. AI feature flags (Section 4)

`lib/ai/flags.js` — every capability supports disabled / internal / beta /
percentage / emergency disable:

- `AI_EMERGENCY_DISABLE=1` — global kill switch.
- `AI_FLAG_<NAME>=on|off|25` — force on/off or percentage rollout (0–100).
- Percentage rollout uses a deterministic hash of `flag:userId`, so a user
  stays in one bucket across calls.

Defaults: assist/vision/content-understanding/embeddings on;
`ai_creator_insights` and `ai_notification_prioritization` default **off** until
validated.

## 5. Signal architecture (Sections 5–6)

`lib/reco/config.js` defines signal strengths — **not every interaction is
equal**: views weigh 0.15, follows 2.5, shares 2.0, explicit negatives 1.5–2.0.

Explicit signals (follow, mute, block, not-interested, topic prefs) are
separated from implicit ones (views, scroll, repeat engagement) and **always
win**: `rec_feedback` + `applyFeedbackLearning` propagate negatives
proportionally, and blocks are enforced by `lib/safety.js` *before* ranking —
a block is not a preference, it's an override.

## 6. User interest profile & temporal interests (Sections 7–8)

`user_affinities` stores decaying magnitudes per (user × topic/creator/
community/content-type): half-life 14 days (`AFFINITY.halfLifeDays`), capped at
20 (`maxAccumulated`). Old interests fade unless reinforced — users are never
permanently labeled by stale behavior.

Short-term vs long-term: freshness half-life (36h) + exploration window (48h)
keep trending-challenge engagement from permanently re-shaping a profile.
Raw scores never leave the server; only product-level explanation strings do.

## 7. Content understanding (Sections 9–11)

Foundation added in this release:

- `ai_content_metadata` — per-content language, topics, quality score,
  embedding (jsonb array, provider-agnostic), model version, source.
- `ai_jobs` async queue — `classify_content`, `embed_content`, `quality_score`
  jobs processed by the daily worker (`lib/ai/worker.js`).
- Builtin understanding (`lib/ai/providers/builtin.js`): script-based language
  detection, keyword topic classification, explainable quality heuristic that
  **never penalizes new creators** (neutral baseline, no follower-count
  requirement). When a real provider is configured, the same jobs produce
  richer metadata — the pipeline is identical.
- AI metadata is **not treated as ground truth**: `source` + `model_version`
  columns make provenance explicit, and moderation remains authoritative.

## 8. Feed candidate generation (Sections 14–15)

`lib/reco/feedBuilder.js` already assembles candidates from **multiple
independent pools**: followed creators, affinity creators, joined + affinity
communities, recent global content, fresh roasts. No single source can starve
the feed, and eligibility filtering (privacy, blocks, moderation, community
visibility) runs before ranking.

## 9. Ranking & diversification (Sections 16–17)

- Ranking combines relevance, interest match, freshness (half-life decay),
  quality, relationship strength, popularity (log-normalized engagement,
  never raw totals), exploration, and proportional negative feedback —
  **not an engagement-only algorithm**, and the formula is never exposed.
- `applyDiversity` enforces creator/community/type windows so 20 posts from
  one creator or one topic can't monopolize a feed.

## 10. Exploration vs exploitation (Sections 18, 40, 63)

`EXPLORATION` config reserves controlled slots per page for under-discovered
fresh content; affinity-driven discovery surfaces new creators; cold-start
users get popular safe content + trend + interests, not a narrow bubble.
New creators get **fair opportunity, not guaranteed reach** — the quality
heuristic has a neutral baseline so low history ≠ suppression.

## 11. Following feed (Section 19)

**Unchanged and intentionally so.** Following remains a predictable,
chronological, user-controlled feed. AI may only assist with spam/safety
filtering in the future — never silent re-ranking.

## 12. Search (Sections 20–21)

Search remains permission-aware (RLS + blocks + moderation); the semantic
search pipeline is a documented foundation (query → representation →
retrieval → visibility filtering → ranking) but is NOT implemented yet — the
`ai_content_metadata` embedding column is the storage layer it will read.

## 13. Experimentation (Section 41)

`lib/experiments.js` provides deterministic assignment, exposure/conversion
tracking, guardrail checks (error rate, bounce, dismiss). Model changes must
ship behind experiments — control/treatment with percentage rollout and metric
comparison — never a silent global swap.

## 14. Observability (Section 45)

Every AI call records volume, latency, success/failure, fallback rate, provider,
model, and estimated cost (`lib/ai/observability.js` → `lib/metrics.js` →
`/api/metrics`). Long-term cost + failure history lands in `ai_usage_log`
(90-day retention). Prompts and private data are never logged.

## 15. Feedback loops (Section 39)

`rec_feedback` + `applyFeedbackLearning` make "not interested"/"show less"
propagate reliably to future recommendations (proportional, never one-click
erasure). The loop: better signals → better understanding → better discovery →
more value → more high-quality signals.