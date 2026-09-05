/**
 * BURNBOARD AI Operating System — Capability Registry & Risk Model (MP22)
 *
 * A central, declarative registry of every AI capability. Each entry declares:
 *   - purpose         what it does (documented, owned)
 *   - riskLevel       low | medium | high → drives confirmation + audit rules
 *   - dataScope       the data it may touch — never more than declared
 *   - writeActions    whether it can write, and what (never auto-publishes)
 *   - transparency    how the result is labeled to the user
 *   - rollout flag    the AI_FLAG_* gate (see lib/ai/flags.js)
 *
 * Rules enforced by callers (and documented in docs/ai/AI_OS.md):
 *   - HIGH risk (publishing, messaging, financial, account changes) is
 *     NEVER executed by AI without explicit user confirmation. High-impact
 *     creation defaults to a DRAFT.
 *   - The model is never the security boundary: data access, rate limits,
 *     and permission checks are code (this registry + route guards), and
 *     the AI layer only ever receives already-authorized, minimized context.
 *   - No capability exists here that impersonates users, bypasses blocking,
 *     overrides moderation, or touches payments.
 */

export const AI_RISK = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

// ── The registry ────────────────────────────────────────────
export const AI_CAPABILITIES = {
  personal_ai_guide: {
    purpose: 'Answer product questions ("how do I…") with grounded, sourced answers from the BurnBoard help corpus.',
    riskLevel: AI_RISK.LOW,
    dataScope: 'Platform help content + coarse user locale only. Never private user data.',
    writeActions: 'None.',
    transparency: 'Replies cite their source topics; users can always skip to the real help pages.',
    flag: 'ai_personal_guide',
  },
  personal_ai_digest: {
    purpose: 'A daily "what happened while you were away" summary over the user’s own authorized graph (followed creators, joined communities).',
    riskLevel: AI_RISK.LOW,
    dataScope: 'The requesting user’s own following/community data — never other users’ private data.',
    writeActions: 'None (read-only, computed at request time).',
    transparency: 'Plainly labeled as an AI summary with a “see full activity” fallback.',
    flag: 'ai_personal_digest',
  },
  content_polish_assist: {
    purpose: 'Suggest optional improvements to a user’s own draft text (clarity, hooks, structure).',
    riskLevel: AI_RISK.LOW,
    dataScope: 'The draft text the user submits. Never published automatically.',
    writeActions: 'Returns a suggested rewrite; the USER publishes (draft-first rule).',
    transparency: 'Suggestions are labeled AI-assisted; publishing stays manual.',
    flag: 'ai_content_polish',
  },
};

// Future capabilities live here BEFORE any code exists (governance first):
//   creator_growth_agent   (medium; drafts only; never fabricates engagement)
//   community_ai_assistant (medium; summaries over authorized community data)
//   moderator_ai_assist    (medium; suggestions only — human review always)
//   ai_notifications       (medium; reduces noise; user prefs authoritative)

export function getCapability(name) {
  return AI_CAPABILITIES[name] || null;
}

export function capabilityRisk(name) {
  return getCapability(name)?.riskLevel || AI_RISK.LOW;
}

/**
 * High-risk write capability check — the hard gate. If a capability ever
 * wants to publish/message/transact, it must be registered HIGH here and
 * every invocation must pass an explicit user confirmation token.
 */
export function requiresHumanConfirmation(name) {
  return capabilityRisk(name) === AI_RISK.HIGH;
}