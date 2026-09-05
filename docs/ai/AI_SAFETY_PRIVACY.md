# BurnBoard AI — Safety & Privacy

How AI stays safe, privacy-aware, controllable, and never manipulative.

---

## 1. Confidence handling (Section 32)

- Every automated AI output can carry confidence context: creator insights
  are stored with `confidence` ('high' | 'medium' | 'early') and are only
  shown when produced by a real provider from real data.
- Low confidence is never treated as certainty. High-impact actions (moderation
  enforcement, financial decisions) require human review — see §3.
- Builtin output (no external AI) is deterministic and labeled `source:
  'builtin'` so users/ops always know what produced a result.

## 2. Hallucination protection (Section 33)

- Creator insights distinguish **observed data** (real totals from
  `creator_totals` RPC), **inference** (probabilistic language: "appears to
  be"), and **suggestion** — and the model prompt explicitly forbids invented
  numbers and virality promises.
- Thin data → the model answers `INSUFFICIENT DATA` → the job is skipped; the
  dashboard shows nothing rather than a confident-looking guess.
- AI metadata (`ai_content_metadata`) records `source` + `model_version` so
  derived claims are traceable and never mistaken for ground truth.

## 3. Human-in-the-loop (Sections 30–31, 34)

AI may assist, prioritize, summarize, classify — it does **not** autonomously
punish. Trust & Safety policy remains authoritative:
- Moderation decisions are made by the existing `lib/safety.js` /
  `lib/moderationService.js` pipeline; AI is only a documented future
  assistance layer (queue prioritization, classification) with human review
  for high-impact enforcement and appeals.

## 4. Blocking is authoritative (Section 35)

- `lib/safety.js` blocks/mutes are enforced in feed eligibility **before**
  ranking (`hiddenAuthorIds`). AI recommendations can never surface blocked
  accounts, use blocked interactions to reconnect users, or leak blocked
  content indirectly. This ordering is structural, not advisory.

## 5. Privacy (Sections 36, 51–53)

- **Minimum necessary data:** the creator-insight prompt contains aggregate
  counts only — no private content, no viewer identities, no moderation
  internals. Content-understanding jobs receive the content text the platform
  already stores; nothing is sent to AI processing unnecessarily.
- **RLS boundaries:** `ai_jobs` and `ai_usage_log` are system-only (no user
  read policies); `ai_content_metadata` is owner-readable only;
  `ai_creator_insights` is owner-readable only. Nothing is visible to other
  users, anonymous clients, or search.
- **No uncontrolled copies:** AI data flows EVENT → VALIDATION → PRIVACY
  FILTERING → FEATURE GENERATION → MODEL INPUT → RESULT → SAFE STORAGE →
  PRODUCT USE. The `ai_jobs.input` holds the minimal payload.
- **Deletion propagation:** `ai_creator_insights.creator_id` cascades on user
  delete; `rec_events`/`user_affinities` cascade; `ai_jobs`/`ai_usage_log`
  rows are target-agnostic system data with retention cleanup
  (`cleanup_ai_data`), and embeddings are stored per-content so content
  deletion can remove them via the same (content_type, content_id) key.
- **Retention:** `ai_usage_log` 90 days, finished jobs 30 days, stuck claims
  requeued after 1h, exhausted attempts dead-lettered (never silently lost).

## 6. User controls (Section 37)

Real, behavior-affecting controls (never fake):
- Personalization master switch + interest selection + interest reset
  (`/settings/personalization` → `user_personalization`).
- "Not interested" / hide per content item (`rec_feedback`).
- Blocks/mutes (authoritative).
- AI-assisted features are all optional and user-initiated; `ai_creator_insights`
  is off by default.

## 7. Explainability (Section 38)

- Feed items carry truthful, product-level explanation strings ("Because you
  follow @x", "Popular in Community X", "Related to topics you engage with").
- Never exposed: model weights, internal scores, fraud signals, or private
  info about other users. Roast cards never claim "because you engage with
  @target" — explanations only reference real relationships.

## 8. Anti-gaming & well-being (Sections 64, 66)

- Ranking thresholds and weights live server-side in `lib/reco/config.js`,
  never exposed; signals are server-validated (clients cannot fabricate
  affinity), idempotent, and rate-limited.
- Anti-gaming integrates with Trust & Safety + rate limiting; bot/coordinated
  manipulation is addressed by the existing abuse layers.
- **No engagement-only optimization:** the quality metrics include hide rate,
  not-interested rate, report rate, diversity and retention — not just clicks.
  The system optimizes user value, not compulsive scrolling; exploration and
  diversity are first-class, and negative feedback reduces (never amplifies)
  what a user dislikes.

## 9. Organic vs paid (Section 65)

- There is no paid-promotion pathway in the recommendation stack today.
- Rule documented for the future: sponsored placement must be explicitly
  labeled and structurally separated from organic ranking — never disguised
  as organic AI recommendation.

## 10. Prompt injection & security (Sections 54–55)

- User-generated text is always treated as untrusted input: it is data in a
  task prompt, never system instructions. Creator-insight prompts are built
  server-side from aggregates; user text is not concatenated into privileged
  instructions.
- Internal system prompts, safety rules, moderation criteria and provider
  secrets never leave the server (`process.env` only; `.env.local` is
  gitignored; keys live in Vercel/Supabase secret stores).
- AI endpoints are rate-limited (per-IP + per-user, `lib/serverRateLimit` +
  `lib/aiService` per-hour limits), preventing cost abuse, prompt flooding,
  and automated extraction.