/**
 * BURNBOARD — AI-Assisted Creator Insights (Master Prompt 17)
 *
 * Augments the rule-based creator analytics with an optional AI summary.
 * Strict guardrails:
 *   - Only active when the ai_creator_insights flag is on AND a real
 *     provider is configured (builtin never fabricates insights).
 *   - The prompt contains AGGREGATE NUMBERS ONLY (totals, top type). No
 *     private content, no viewer identities, no moderation internals.
 *   - Processing is ASYNC (ai_jobs worker) — the dashboard never waits on
 *     a model. Insights appear when the worker has produced one.
 *   - The model is instructed to answer "INSUFFICIENT DATA" when numbers
 *     are too thin; such jobs are skipped, never presented as fact.
 *   - No virality predictions, no invented numbers, probabilistic language.
 */

import { isAiFeatureEnabled } from '@/lib/ai/flags';
import { providerForTask } from '@/lib/ai/routing';

/** Build the aggregate-only prompt for the insight model. */
export function buildInsightPrompt({ totals7 = {}, totals30 = {}, recentContent = [] } = {}) {
  const topType = {};
  for (const c of recentContent || []) {
    topType[c.typeLabel || c.type || 'post'] = (topType[c.typeLabel || c.type || 'post'] || 0) + (c.engagement || 0);
  }
  const topTypeLabel = Object.entries(topType)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

  return [
    'You analyze a creator dashboard for a social platform called BurnBoard.',
    'Use ONLY the numbers below. Never invent numbers, never promise virality.',
    'Give exactly one short insight (max 2 sentences) with probabilistic language',
    '("appears to be", "may be"). If the numbers are too small to conclude anything,',
    'answer exactly: INSUFFICIENT DATA',
    '',
    `Last 7 days: ${totals7.followers || 0} followers, ${totals7.reactions || 0} reactions, ${totals7.comments || 0} comments, ${totals7.posts || 0} posts.`,
    `Last 30 days: ${totals30.followers || 0} followers, ${totals30.reactions || 0} reactions, ${totals30.comments || 0} comments, ${totals30.posts || 0} posts.`,
    `Content posted (30d): ${(recentContent || []).length}. Most engaging content type: ${topTypeLabel}.`,
  ].join('\n');
}

/**
 * Should we even attempt AI insights for this creator? Flag + provider.
 * (Data sufficiency is judged by the model via INSUFFICIENT DATA.)
 */
export function isAiInsightsEligible(userId, env = process.env) {
  return isAiFeatureEnabled('ai_creator_insights', userId, env)
    && providerForTask('creator_insight', env) !== 'builtin';
}

/**
 * Fire-and-forget: enqueue a daily creator-insight job (idempotent).
 * Uses the SECURITY DEFINER RPC so any session client can enqueue without
 * table access. job_key buckets by day → refreshes once per day.
 */
export async function enqueueCreatorInsight(client, userId, data) {
  if (!client || !userId) return;
  const today = new Date().toISOString().slice(0, 10);
  const prompt = buildInsightPrompt(data);
  const earlySignal = ((data.totals30?.followers || 0) + (data.totals30?.reactions || 0)) < 20;

  const { error } = await client.rpc('enqueue_ai_job', {
    p_job_type: 'creator_insight',
    p_target_type: 'user',
    p_target_id: userId,
    p_input: JSON.stringify({ prompt, earlySignal, creator_id: userId }),
    p_job_key: `creator_insight:${userId}:${today}`,
  });
  if (error) {
    // Personalization/AI must never break the dashboard.
    console.warn('[Creator Insights] enqueue failed:', error.message);
  }
}

/** Read the latest stored AI insight for a creator (nullable). */
export async function fetchCreatorInsight(client, userId) {
  if (!client || !userId) return null;
  try {
    const { data } = await client
      .from('ai_creator_insights')
      .select('insight, confidence, source, model_version, created_at')
      .eq('creator_id', userId)
      .maybeSingle();
    if (!data?.insight) return null;
    return {
      text: data.insight.text || null,
      confidence: data.confidence || 'medium',
      source: data.source || 'builtin',
      modelVersion: data.model_version || null,
      generatedAt: data.created_at,
    };
  } catch (err) {
    console.warn('[Creator Insights] fetch failed:', err?.message || err);
    return null;
  }
}