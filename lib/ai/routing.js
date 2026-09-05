/**
 * BURNBOARD AI — Task Routing (Master Prompt 17)
 *
 * Single source of truth for how each AI task is executed. Different tasks
 * have different latency/cost/quality needs — routing keeps cheap work cheap
 * and reserves expensive analysis for where it earns its latency.
 *
 * Tiers (latency/cost, high → low):
 *   realtime  — user-initiated, must be fast (assist, roast style)
 *   batch     — background jobs, latency-tolerant (embeddings, classification)
 *   vision    — image understanding, user-initiated but heavier
 *
 * Every route uses `executeTask` from lib/ai/provider.js which applies the
 * tier's timeouts, safety checks, metrics and cost tracking. Never call a
 * provider directly from a route.
 */

export const AI_TIERS = {
  realtime: {
    timeoutMs: 10000,
    costPer1kTokensUsd: 0.0005,   // fast/cheap generation
    description: 'User-initiated assistance; latency is user-visible.',
  },
  vision: {
    timeoutMs: 20000,
    costPer1kTokensUsd: 0.0025,   // image tokens cost more
    description: 'Image understanding; user-initiated, heavier.',
  },
  batch: {
    timeoutMs: 30000,
    costPer1kTokensUsd: 0.00025,  // bulk classification/embedding
    description: 'Background processing; latency-tolerant, cheapest tier.',
  },
};

/**
 * Task registry. `tier` selects timeouts + cost model; `provider` selects the
 * provider implementation (fallback chain is applied in provider.js).
 */
export const AI_TASKS = {
  // ── Realtime assistance ──────────────────────────────────
  hot_seat_prompt_assist: {
    tier: AI_TIERS.realtime,
    maxInputLength: 500,
    maxOutputLength: 1000,
    fallback: 'builtin',
  },
  roast_style_assist: {
    tier: AI_TIERS.realtime,
    maxInputLength: 500,
    maxOutputLength: 1000,
    fallback: 'builtin',
  },
  // ── Vision ────────────────────────────────────────────────
  vision_roast_image: {
    tier: AI_TIERS.vision,
    maxInputLength: 4000,
    maxOutputLength: 300,
    fallback: 'builtin',
  },
  // ── Batch content understanding ───────────────────────────
  classify_content: {
    tier: AI_TIERS.batch,
    maxInputLength: 2000,
    maxOutputLength: 500,
    fallback: 'builtin',
  },
  embed_content: {
    tier: AI_TIERS.batch,
    maxInputLength: 2000,
    maxOutputLength: 1024,
    fallback: 'builtin',
  },
  creator_insight: {
    tier: AI_TIERS.batch,
    maxInputLength: 3000,
    maxOutputLength: 500,
    fallback: 'builtin',
  },
  // ── Personal AI (Master Prompt 22) ───────────────────────
  personal_ai_guide: {
    tier: AI_TIERS.realtime,
    maxInputLength: 400,
    maxOutputLength: 900,
    fallback: 'builtin',
  },
  personal_ai_digest: {
    tier: AI_TIERS.batch,
    maxInputLength: 600,
    maxOutputLength: 800,
    fallback: 'builtin',
  },
  content_polish_assist: {
    tier: AI_TIERS.realtime,
    maxInputLength: 800,
    maxOutputLength: 800,
    fallback: 'builtin',
  },
};

/**
 * Provider selection for a task. Order of preference:
 *   1. Explicit per-task provider override (env AI_PROVIDER_<TASK>).
 *   2. Global AI_PROVIDER env (defaults to 'gemini' when a key exists).
 *   3. 'builtin' (rule-based, no external AI — always available).
 */
export function providerForTask(taskName, env = process.env) {
  const task = AI_TASKS[taskName];
  if (!task) return 'builtin';

  const perTask = env[`AI_PROVIDER_${taskName.toUpperCase()}`];
  if (perTask) return perTask;

  const global = env.AI_PROVIDER;
  if (global) return global;

  return env.GEMINI_API_KEY ? 'gemini' : 'builtin';
}

/**
 * Estimate cost (USD) for a call given tier + token counts. Used for the
 * ai_usage_log + in-memory cost metrics — approximate, not billing-grade.
 */
export function estimateCostUsd(taskName, inputTokens, outputTokens) {
  const task = AI_TASKS[taskName];
  if (!task) return 0;
  const per1k = task.tier.costPer1kTokensUsd;
  return ((inputTokens || 0) + (outputTokens || 0)) / 1000 * per1k;
}

/** Rough token estimate: ~4 chars per token. Good enough for cost tracking. */
export function estimateTokens(text) {
  const len = typeof text === 'string' ? text.length : 0;
  return Math.ceil(len / 4);
}