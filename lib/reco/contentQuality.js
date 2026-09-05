/**
 * BURNBOARD — Content quality evidence for ranking (Master Prompt 27)
 *
 * Reads the content-intelligence metadata that the MP17 background worker
 * writes into `ai_content_metadata` (quality_score, language, topics,
 * source) and exposes it to the feed scorer as a single, clearly-scoped
 * signal: dampen the popularity term of clearly-low-quality items.
 *
 * Safety / honesty rules:
 *   - Evidence requires a REAL provider row (`source != 'builtin'`,
 *     `model_version` present). The builtin fallback (no provider key) is
 *     never allowed to shape what users see.
 *   - Only clearly-low scores matter (QUALITY.lowScore). Missing metadata —
 *     the normal state until a provider is enabled — changes nothing.
 *   - This signal only ever *reduces* the popularity component of a
 *     candidate's score. It cannot remove content, and it never overrides
 *     moderation (removal/visibility is enforced by RLS + moderation_state).
 *   - Failure-soft: an absent table or a provider error degrades to no-op.
 */

import { QUALITY } from './config';

const METADATA_TYPES = ['social_post', 'roast'];

function chunk(list, size = 100) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Is this metadata row usable evidence from a real provider? */
export function isProviderEvidence(row) {
  if (!row) return false;
  const source = String(row.source || '');
  return source !== 'builtin' && !!row.model_version && row.quality_score !== null && row.quality_score !== undefined;
}

/**
 * Batch-fetch quality metadata for feed candidates.
 * @param {object} client service/session client
 * @param {Array}  candidates normalized candidates [{ kind, id }]
 * @returns {Map<string, { qualityScore, lowQuality, provider }>}
 *   keyed `${kind}:${id}` — empty when no evidence exists.
 */
export async function fetchCandidateContentQuality(client, candidates) {
  const map = new Map();
  if (!client || !Array.isArray(candidates) || candidates.length === 0) return map;

  for (const kind of METADATA_TYPES) {
    const ids = [...new Set(candidates.filter((c) => c.kind === kind && c.id).map((c) => c.id))];
    if (!ids.length) continue;
    try {
      for (const group of chunk(ids)) {
        const { data, error } = await client
          .from('ai_content_metadata')
          .select('content_id, quality_score, source, model_version')
          .eq('content_type', kind)
          .in('content_id', group);
        if (error) {
          // Missing table / migration pending → no evidence, no behavior change.
          continue;
        }
        for (const row of data || []) {
          if (!row?.content_id || !isProviderEvidence(row)) continue;
          const numericScore = Number(row.quality_score);
          if (!Number.isFinite(numericScore)) continue;
          map.set(`${kind}:${row.content_id}`, {
            qualityScore: numericScore,
            lowQuality: numericScore < QUALITY.lowScore,
            provider: String(row.source || 'provider'),
          });
        }
      }
    } catch (err) {
      // Failure-soft by design: content intelligence must never break the feed.
      console.error('[ContentQuality] fetch error:', err?.message || err);
    }
  }
  return map;
}
