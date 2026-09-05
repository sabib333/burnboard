# BurnBoard AI Operating System (MP22)

BurnBoard's AI is architected as an operating layer over the product — not
"a chatbot everywhere". This document defines the layers, the capability
registry, the risk model, and the governance rules every AI feature obeys.

## The layered architecture

```
BURNBOARD USER
  ↓ AI EXPERIENCE (guide, digest, polish, recommendations, insights)
AI ORCHESTRATION      lib/ai/os.js — capability dispatch, user rate limits,
                      user opt-out checks, transparency labels
PERMISSION + POLICY   lib/ai/registry.js — risk levels; lib/ai/flags.js —
                      rollout gates; route guards — auth, rate limits
MODEL EXECUTION       lib/ai/provider.js (executeTask) — routing, timeouts,
                      fallback chain, output safety, observability + cost
VALIDATION            safety text check, schema checks on output
SAFE RESULT
```

Product code never talks to a model provider directly — everything flows
through `executeTask` (established in MP17) behind the orchestration and
policy layers added in MP22.

## Capability registry

`lib/ai/registry.js` is the single source of truth for what AI is allowed to
do. Every capability declares its purpose, risk level, data scope, write
actions, transparency, and rollout flag — before any code exists for it.

| Capability | Risk | Data scope | Write actions | Flag |
| --- | --- | --- | --- | --- |
| `personal_ai_guide` | low | Help corpus only | none | `ai_personal_guide` |
| `personal_ai_digest` | low | Your own follows + communities | none (read-only) | `ai_personal_digest` |
| `content_polish_assist` | low | The draft you paste | returns suggestions only | `ai_content_polish` |
| (future) creator agent | medium | Your creator aggregate data | drafts only | — |
| (future) moderator assist | medium | Moderation queue summaries | suggestions only | — |

**Registry rules:**
- A capability cannot touch data beyond its declared `dataScope`.
- HIGH-risk actions (publishing, messaging, financial, account changes)
  require explicit human confirmation and are never executed by AI alone.
- The registry lists future capabilities **before** code, so governance
  precedes implementation.

## Personal AI

The `/ai` hub offers three user-controlled capabilities:

1. **Guide** — grounded Q&A over a curated in-product help corpus
   (`builtin.js GUIDE_CORPUS`). Answers cite source topics. If the question
   has no corpus match the assistant says so and points to Explore — it
   never invents platform facts or features.
2. **Digest** — "while you were away": real rows from your own following and
   community graph, computed at request time. No model inference, so nothing
   can be fabricated; every item carries its real id and links through.
3. **Draft polish** — optional, deterministic suggestions on a draft you
   paste. Publishing is always your manual action.

All three are rate-limited per user (in-memory sliding window), flagged
(percentage-rollout capable), and gated by user opt-out stored in
`personal_ai_preferences` (API-enforced, not just UI).

## AI memory model

**There is no hidden AI memory.** The only persisted AI state is what the
user explicitly saves or toggles in `personal_ai_preferences`
(favorite_topics, disabled capabilities) — fully visible on the /ai page,
editable, and clearable with one action. The digest never persists; it is
recomputed from authorized rows each request. Deleted content therefore
cannot linger as "AI memory" because no such artifact exists.

## Risk classification & controls

| Risk | Examples | Required controls |
| --- | --- | --- |
| low | guide, digest, polish, content understanding | flags, rate limits, opt-out, observability |
| medium | automation suggestions, community assistance, creator insights | everything in low + draft-first output + human review for any enforcement-adjacent suggestion |
| high | publishing, messaging, financial, account changes | explicit confirmation, audit, kill switch — and today **none are built** |

Confirmation is never a checkbox the model can tick: high-risk execution
requires a separate human-initiated API call (e.g. the existing first-party
publish route), so "AI cannot self-confirm" is enforced structurally.

## Transparency

- Digest and polish responses are labeled as AI/assistive in the UI.
- Guide answers cite their source topics.
- Content published through the platform API records `via_app` — actions are
  attributable, never disguised as organic or human-made.
- Nothing in the OS impersonates a user, fakes engagement, or hides that an
  AI action occurred.

## Fallbacks & resilience

Every capability runs through `executeTask`, whose fallback chain is:
configured provider → deterministic builtin → clean error. The guide and
polish capabilities are deterministic at their core, so a provider outage
cannot take them down — and the digest makes **no** model calls at all. A
model outage degrades to a still-useful, still-honest answer; it never
degrades the core product (auth, feed, safety, payments are untouched by
the AI layer's availability).