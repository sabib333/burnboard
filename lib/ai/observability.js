/**
 * BURNBOARD AI — Observability (Master Prompt 17)
 *
 * Every AI call is measured: volume, latency, success/failure, fallback rate,
 * provider/model, and estimated cost. Counters land in the same in-memory
 * store as lib/metrics.js (exposed at /api/metrics), so AI health is visible
 * next to API health with zero new infrastructure.
 *
 * Never log prompts or private user data — metric labels are task names,
 * provider names and model versions only.
 */

import { increment, observeDuration, accumulate } from '@/lib/metrics';

/**
 * Record an AI call outcome.
 * @param {object} opts
 *   task        task name (see lib/ai/routing.js)
 *   provider    provider name ('builtin' | 'gemini' | ...)
 *   model       model version string (optional)
 *   success     boolean
 *   fallback    boolean — true when the configured provider failed and a
 *               fallback produced the result
 *   latencyMs   duration of the whole call (including fallback)
 *   costUsd     estimated cost (optional)
 */
export function recordAiCall({
  task, provider, model = null, success = true,
  fallback = false, latencyMs = 0, costUsd = 0,
}) {
  const labels = { task, provider };
  if (model) labels.model = model;

  increment('ai.calls', labels);
  increment(success ? 'ai.calls.success' : 'ai.calls.failure', { task });
  if (fallback) increment('ai.calls.fallback', { task, provider });
  observeDuration('ai.latency', latencyMs, { task });
  accumulate('ai.cost.usd_micro', Math.round((costUsd || 0) * 1e6), { task });
}

/**
 * Wrap a provider execution with timing + outcome recording.
 * The wrapped function must return { success: boolean, ... }.
 */
export async function withAiObservability({ task, provider, model }, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    recordAiCall({
      task,
      provider,
      model,
      success: !!result?.success,
      fallback: !!result?.fallbackUsed,
      latencyMs: Date.now() - start,
      costUsd: result?.costUsd || 0,
    });
    return result;
  } catch (err) {
    recordAiCall({
      task, provider, model,
      success: false,
      latencyMs: Date.now() - start,
    });
    throw err;
  }
}