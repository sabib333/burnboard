# AI Governance, Agents & Deferred Capabilities (MP22)

## Agent architecture (designed; Level 0–2 implemented)

BurnBoard follows the controlled-agent principle: intent → plan → policy
check → permission check → tool execution → validation → result. Agents
never take `MODEL → UNRESTRICTED ACTION` shortcuts.

Autonomy levels:

| Level | Behavior | Status today |
| --- | --- | --- |
| 0 | Answer only | ✅ Guide (read-only Q&A) |
| 1 | Suggest actions | ✅ Draft polish + digest (suggest, never execute) |
| 2 | Prepare drafts | ✅ Content suggestions are draft-first by construction |
| 3 | Execute low-risk approved actions | ⏸️ deferred (requires approved-permission store) |
| 4 | Recurring approved workflows | ⏸️ deferred (requires explicit workflow consent + audit) |

Read vs write: today's capabilities are **read-only or suggestion-only**. No
write-agent exists. When one is designed it must register HIGH risk, run
draft-first, require a separate human-initiated confirm call, and append to
an agent audit log.

## Tool permissions (future agents)

Every agent tool must declare: action, required permission, risk, rate
limit, audit requirement, confirmation requirement. No agent ever receives
administrative tools, payout tools, or moderation tools that act without
human review.

## Kill switches & incident response

- **Per-feature:** `AI_FLAG_<NAME>=off` or `0` (env, no deploy).
- **Global:** `AI_EMERGENCY_DISABLE=1` turns off every AI capability.
- **Per-user:** opt-out in `personal_ai_preferences` is honored server-side
  by the orchestration layer.
- **Model/provider:** switching `AI_PROVIDER` (or unsetting
  `GEMINI_API_KEY`) reroutes or disables external inference without code
  changes; builtin determinism keeps capabilities alive.

Incident playbooks (from MP17 AI_OPERATIONS, extended):

| Incident | Response |
| --- | --- |
| Unsafe / hallucinated guide answer | Edit/remove the corpus entry (deterministic layer is fully controllable) — no model retraining needed |
| Cost spike | Per-capability AI_FLAG off or rollout reduction; rate limits already bound per user |
| Agent malfunction | Kill switch on the agent capability; audit log shows every action taken |
| Provider outage | Builtin fallback serves; digest needs no provider at all |

## Model / prompt security

- User and external content is untrusted input; system instructions never
  include secrets or private context.
- Only minimized, already-authorized context reaches a model (guide = help
  corpus; creator insights = aggregate numbers only, MP17).
- The model is **never** the security boundary: access control is RLS,
  route guards, and the registry's dataScope declarations.
- Prompts and private data are not logged (ai_usage_log stores metrics and
  durations — no content).

## Cost governance

All AI calls record estimated cost via `lib/ai/observability.js`
(`ai.cost.usd_micro` in /api/metrics + ai_usage_log). Per-user rate limits
(guide 10/min, polish 8/min, digest 3/5min) cap worst-case spend per user;
per-capability flags cap aggregate spend instantly. The digest costs
**zero** inference dollars.

## Deferred capabilities (why not yet)

| Capability | Why deferred | Trigger to build |
| --- | --- | --- |
| Write agents (auto-publish, auto-message) | High risk; requires approved-permission + audit infra | Real creator demand measured via experiments |
| Creator growth agents | Must never fabricate engagement | After creator AI insights show value |
| Community AI / moderator assistant | Human review must stay authoritative | Moderation volume where summaries help reviewers |
| AI notifications prioritization | User prefs must stay authoritative; noise reduction is the only allowed goal | Notification fatigue signal measured |
| Third-party AI on the developer platform | Must respect the same scopes; new AI scopes need policy review first | Ecosystem demand |

## Guardrails that are non-negotiable

1. AI cannot impersonate users or send messages.
2. AI cannot override moderation, blocking, or privacy.
3. AI cannot publish, spend, or change settings without a separate
   human-confirmed call.
4. AI cannot access data beyond its registered scope.
5. No hidden surveillance, no fake engagement, no accuracy claims without
   measurement.
6. User control > AI autonomy; privacy > data hunger; safety > automation;
   trust > engagement.