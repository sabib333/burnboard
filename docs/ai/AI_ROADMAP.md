# BurnBoard AI — Roadmap

What exists, what this release added, what NOT to build yet, and the ordered
next steps. The flywheel: better signals → better understanding → better
discovery → better experience → more value → more high-quality signals.

---

## 1. What exists today (built across MP12 → MP22, MP27)

- **Recommendation health observability (MP27)** — real aggregate metrics
  from the reco + AI tables (signals, explicit negatives, creator
  concentration, new-creator reach, user-control usage, AI cost/failures)
  at `/admin/ai` via `/api/admin/intelligence`; the rollback signals for any
  ranking change. See [AI_HEALTH.md](./AI_HEALTH.md).

- **Personalization & For You (MP12):** signals, affinities, negative feedback,
  cold start, exploration, diversity, explainable ranking, user controls.
- **Creator analytics (MP13):** real aggregates + truthful rule-based insights.
- **Experiments (MP14-era):** deterministic assignment, guardrails.
- **AI assistance:** hot-seat prompt assist, roast-style assist, vision roast.
- **MP17 additions:**
  - `lib/ai/` provider abstraction, routing, flags, observability, worker.
  - `ai_jobs` / `ai_content_metadata` / `ai_usage_log` / `ai_creator_insights`
    tables + RPCs + retention.
  - Centralized Gemini vision call; aiService delegates through the abstraction.
  - AI-assisted creator insights (off by default, aggregate-only, async).
  - `docs/ai/` — this documentation set.

## 2. What NOT to build yet (Section 70)

- ❌ Fully autonomous moderation — human review stays in the loop.
- ❌ Unrestricted AI agents with production access (no auto-deploys, no
  auto-publishing, no AI that changes user settings or sends messages as users).
- ❌ AI financial decisions / payout control — payments stay isolated and
  human-owned.
- ❌ Psychological manipulation / engagement-maximization systems.
- ❌ AI-powered surveillance or fine-grained behavioral tracking beyond the
  existing opt-in personalization.
- ❌ Real semantic search (pgvector/engine) until `ai_content_metadata`
  embeddings are populated by a real provider and search volume justifies it.
- ❌ Smart notification re-ranking until notification volume justifies it
  (user preferences remain authoritative).

## 3. Ordered next steps

1. **Enable a real provider** for batch tasks (set `AI_PROVIDER` +
   `GEMINI_API_KEY`); the worker starts producing real language/topics/
   quality metadata into `ai_content_metadata` with zero code changes.
2. **Turn on `ai_creator_insights`** for an internal cohort, review insight
   quality against the guardrails, then percentage-roll out.
3. **Evaluate offline:** label a sample of content, measure classification
   precision/recall + safety FPs/FNs; record baselines in `docs/ai/`.
4. **Embeddings → discovery:** once embeddings are real, build related-content
   retrieval (in-app cosine over the stored arrays, then pgvector at scale).
   (Partial progress, MP27 second pass: real-provider `quality_score` already
   feeds a low-quality popularity dampener in For You via
   `lib/reco/contentQuality.js` — language/topic/embedding signals remain
   unused by ranking until embeddings are real.)
5. **DB-backed ranking experiments:** wire ranking variants to the experiment
   service and consume the `/admin/ai` rollback signals (negative-feedback
   rise, concentration, new-creator share, AI failure rate) as automatic
   rollback triggers. Measurement layer is live; enforcement is next.
6. **Notification prioritization** only when volumes justify: digests for
   high-fanout creators, per-recipient throttles, user preferences first.
7. **Maturity gate for Phase 2 → 3:** sustained real signal volume in
   `/admin/ai` + recorded offline baselines before any model-training or
   re-ranking infrastructure is built.

## 4. Guardrails that never change

- AI optional, user-initiated, reversible, observable, human-controllable.
- Blocking and moderation are authoritative — AI can never override them.
- No fabricated insights, no virality promises, no disguised advertising.
- Minimum necessary data; owner-only RLS; retention enforced; deletion cascades.
- Provider outage degrades to builtin — the core product never depends on one API.