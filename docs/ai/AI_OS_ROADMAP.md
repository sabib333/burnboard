# AI OS Roadmap (MP22)

## Where we are

The MP22 operating layer is live and safe:
- Capability registry + risk model (`lib/ai/registry.js`)
- Orchestration (`lib/ai/os.js`) with per-user rate limits, opt-out
  enforcement, transparency labels
- Three Personal AI capabilities on `/ai`: **Guide** (grounded Q&A),
  **Digest** (read-only, your own graph), **Draft polish** (suggestions only)
- Explicit AI memory controls (`personal_ai_preferences` — visible,
  editable, clearable; no hidden memory)
- All flows through `executeTask` (provider abstraction, builtin fallback,
  observability, cost tracking)

**Fixed in this release:** a real bug where the MP17 batch worker called
`executeTask('task', params)` positionally against an object-signature
function — every background content-understanding job (classify/embed/
quality) was failing with "Unknown AI task". Now it works end to end.

## Daily-use loop (what exists)

User opens BurnBoard → optional "while you were away" digest over their own
network → Guide answers "how do I…" instantly → polish nudges drafts in the
composer → feedback/opt-outs tune the experience. Nothing here maximizes
screen time; the digest has an empty state, the guide declines to invent,
and every surface is dismissible.

## Stage B (next) — measure before building

1. Wire guide/digest/polish into an A/B experiment (existing experiments
   platform) measuring task success + user satisfaction, not request count.
2. Add digest categories + frequency controls (user-chosen, notification
   fatigue is the enemy).
3. When a real model provider is configured, layer natural-language
   summaries on the digest with explicit "AI summary" labeling, keeping the
   deterministic version as fallback.
4. Surface the guide contextually (composer help), keeping the /ai hub.

## Stage C (gated) — agents

Write-capable agents (Level 3+) only after: approved-permission store,
agent audit table, and human-confirmation flow all exist — and only for
low-risk creator workflows. Moderator AI stays strictly assistive.

## Never (hard line)

Autonomous publishing without human action, AI messages without permission,
AI control of payouts or moderation penalties, hidden memory of user
activity, fake engagement, impersonation, and any AI that can bypass
blocking/privacy/safety. The final rule: **AI makes BurnBoard more useful
every day; it never makes users lose control of their data, identity,
safety, or decisions.**