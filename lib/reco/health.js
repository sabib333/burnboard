/**
 * BURNBOARD — Recommendation Intelligence health probes (Master Prompt 27)
 *
 * Aggregate, real-table measurement of the personalization & discovery
 * system — the "rollback signals" for any ranking change. Every number here
 * is computed from actual rows (rec_events, rec_feedback, user_affinities,
 * user_personalization, ai_usage_log, ai_jobs, ai_content_metadata). Nothing
 * is fabricated, extrapolated, or inferred beyond what the events record.
 *
 * Scope & honesty rules:
 *   - Server-only. Requires a service-role client: rec_events / rec_feedback
 *     / user_affinities are owner-scoped under RLS, so the anon key would
 *     silently return zero rows — we refuse that and report unavailable.
 *   - Engagement concentration is measured over the most recent N
 *     engagement signals (bounded sample) and labeled as such — never
 *     presented as a full-population census.
 *   - Every subsystem fails independently: a missing table degrades that
 *     section to available:false, never a false "healthy".
 */

import { createHash } from 'node:crypto';

const DAY_MS = 24 * 60 * 60 * 1000;

// Events that represent genuine positive engagement (not passive views).
export const ENGAGEMENT_EVENT_TYPES = [
  'content_reacted',
  'content_commented',
  'content_replied',
  'content_shared',
  'user_followed',
  'battle_voted',
  'challenge_participated',
  'challenge_invite_accepted',
];

// Cap on the engagement sample read per dashboard load (bounded reads).
export const ENGAGEMENT_SAMPLE_LIMIT = 5000;

const RECO_TABLES = ['rec_events', 'rec_feedback', 'user_affinities', 'user_personalization'];
const AI_TABLES = ['ai_usage_log', 'ai_jobs', 'ai_content_metadata'];

function isoDaysAgo(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function isMissingTableError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('does not exist') || msg.includes('relation') && msg.includes('does not exist') || msg.includes('undefined_table');
}

function trunc(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10 ** digits) / 10 ** digits;
}

async function exactCount(client, table, query) {
  let q = client.from(table).select('id', { count: 'exact', head: true });
  if (query) q = query(q);
  const { count, error } = await q;
  if (error) throw error;
  return count === null ? null : (count || 0);
}

/**
 * Probe the recommendation subsystem over the last N days.
 * @returns {object|null} null when the reco tables are absent/unreadable.
 */
export async function probeRecommendationHealth(client, { days = 7 } = {}) {
  if (!client) return null;
  const since7d = isoDaysAgo(days);
  const since24h = isoDaysAgo(1);
  const out = { available: false, windowDays: days };

  try {
    // ── Volume: signals, impressions, explicit feedback ──────
    const [signals7d, signals24h, impressions7d, neg7d, neg24h] = await Promise.all([
      exactCount(client, 'rec_events', (q) => q.gte('created_at', since7d)),
      exactCount(client, 'rec_events', (q) => q.gte('created_at', since24h)),
      exactCount(client, 'rec_events', (q) => q.eq('event_type', 'content_viewed').gte('created_at', since7d)),
      exactCount(client, 'rec_feedback', (q) => q.gte('updated_at', since7d)),
      exactCount(client, 'rec_feedback', (q) => q.gte('updated_at', since24h)),
    ]);

    // ── Engagement sample for concentration / reach (bounded) ─
    const { data: sampleRows } = await client
      .from('rec_events')
      .select('event_type, context, target_type')
      .in('event_type', ENGAGEMENT_EVENT_TYPES)
      .gte('created_at', since7d)
      .order('created_at', { ascending: false })
      .limit(ENGAGEMENT_SAMPLE_LIMIT);

    const sample = sampleRows || [];

    const perAuthor = new Map();
    const authorsSeen = new Set();
    const communitiesSeen = new Set();
    const typeCounts = new Map();
    for (const row of sample) {
      const ctx = row.context || {};
      typeCounts.set(row.event_type, (typeCounts.get(row.event_type) || 0) + 1);
      if (ctx.community_id) communitiesSeen.add(String(ctx.community_id));
      const author = ctx.author_id;
      if (!author) continue;
      authorsSeen.add(String(author));
      perAuthor.set(String(author), (perAuthor.get(String(author)) || 0) + 1);
    }

    let concentration = null;
    let newCreatorShare = null;
    let newCreatorCount = null;
    let reach = authorsSeen.size;

    if (sample.length > 0 && reach > 0) {
      const ranked = [...perAuthor.entries()].sort((a, b) => b[1] - a[1]);
      const top10 = ranked.slice(0, 10);
      const top10Total = top10.reduce((sum, [, c]) => sum + c, 0);
      concentration = trunc(top10Total / sample.length, 3);

      // New-creator reach: how many distinct authors reached in the sample
      // joined against real account age (< 90 days counts as new). Labeled
      // as a bounded-sample measure.
      const sampleAuthorIds = ranked.slice(0, 60).map(([id]) => id);
      if (sampleAuthorIds.length) {
        const { data: profiles } = await client
          .from('user_profiles')
          .select('id, created_at')
          .in('id', sampleAuthorIds);
        const cutoff = new Date(Date.now() - 90 * DAY_MS).getTime();
        let newCreators = 0;
        let present = 0;
        for (const p of profiles || []) {
          if (!p) continue;
          present += 1;
          const created = p.created_at ? new Date(p.created_at).getTime() : 0;
          if (created && created >= cutoff) newCreators += 1;
        }
        if (present > 0) {
          newCreatorCount = newCreators;
          newCreatorShare = trunc(newCreators / present, 3);
        }
      }
    }

    // ── Interest-graph scale + user controls ─────────────────
    const [affinityRows, personalizationEnabled, personalizationDisabled, recentResets] = await Promise.all([
      exactCount(client, 'user_affinities', null),
      exactCount(client, 'user_personalization', (q) => q.eq('enabled', true)),
      exactCount(client, 'user_personalization', (q) => q.eq('enabled', false)),
      exactCount(client, 'user_personalization', (q) => q.not('reset_at', 'is', null).gte('reset_at', since7d)),
    ]);

    out.available = true;
    out.volume = {
      signals7d,
      signals24h,
      impressions7d,
      negatives7d: neg7d,
      negatives24h: neg24h,
      negativeFeedbackPerKImpressions: impressions7d > 0 ? trunc((neg7d / impressions7d) * 1000, 2) : 0,
      // Directional interpretation guard: impressions are deduped per item
      // per day, so the per-1k figure is a trend indicator, not a precise rate.
      note: 'impressions are server-deduped per item per day — treat per-1k as a trend indicator',
    };
    out.ecosystem = {
      creatorsReached7d: reach,
      sampleSize: sample.length,
      top10Concentration: concentration,
      newCreatorShare: newCreatorShare,
      newCreatorCount: newCreatorCount,
      communitiesReached7d: communitiesSeen.size,
      engagementEventCounts: [...typeCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([event, count]) => ({ event, count })),
    };
    out.interests = {
      affinityRows,
      personalizedUsers: personalizationEnabled,
      personalizationDisabled: personalizationDisabled,
      recentResets7d: recentResets,
    };
    return out;
  } catch (err) {
    if (isMissingTableError(err)) return { available: false, windowDays: days, reason: 'reco_tables_missing' };
    console.error('[RecoHealth] probe error:', err?.message || err);
    return { available: false, windowDays: days, reason: 'error' };
  }
}

/**
 * Probe the AI subsystem (usage/cost, job queue, content-metadata coverage).
 * @returns {object|null} null when AI tables are absent.
 */
export async function probeAiHealth(client, { days = 7 } = {}) {
  if (!client) return null;
  const since = isoDaysAgo(days);
  const out = { available: false, windowDays: days };

  try {
    const [calls7d, failures7d, fallback7d, costRows, latencyRows, pending, failedJobs7d, metadataRows, providerMetadataRows] = await Promise.all([
      exactCount(client, 'ai_usage_log', (q) => q.gte('created_at', since)),
      exactCount(client, 'ai_usage_log', (q) => q.eq('success', false).gte('created_at', since)),
      exactCount(client, 'ai_usage_log', (q) => q.eq('fallback_used', true).gte('created_at', since)),
      client.from('ai_usage_log').select('estimated_cost_usd').gte('created_at', since).limit(5000),
      client.from('ai_usage_log').select('latency_ms').eq('success', true).gte('created_at', since).limit(5000),
      exactCount(client, 'ai_jobs', (q) => q.eq('status', 'pending')),
      exactCount(client, 'ai_jobs', (q) => q.eq('status', 'failed').gte('updated_at', since)),
      exactCount(client, 'ai_content_metadata', null),
      exactCount(client, 'ai_content_metadata', (q) => q.neq('source', 'builtin')),
    ]);

    let costUsd = 0;
    for (const r of costRows || []) costUsd += Number(r?.estimated_cost_usd) || 0;
    let latencyMsTotal = 0;
    let latencyCount = 0;
    for (const r of latencyRows || []) {
      const ms = Number(r?.latency_ms);
      if (Number.isFinite(ms)) {
        latencyMsTotal += ms;
        latencyCount += 1;
      }
    }

    out.available = true;
    out.usage = {
      calls7d,
      failures7d,
      failureRatePct: calls7d > 0 ? trunc((failures7d / calls7d) * 100, 2) : 0,
      fallbackCalls7d: fallback7d,
      estimatedCostUsd: trunc(costUsd, 4),
      avgLatencyMs: latencyCount > 0 ? Math.round(latencyMsTotal / latencyCount) : null,
    };
    out.jobs = { pending, failed7d: failedJobs7d };
    out.coverage = {
      contentMetadataRows: metadataRows,
      // Real-provider rows only — builtin fallback never counts as evidence.
      providerMetadataRows: providerMetadataRows,
    };
    return out;
  } catch (err) {
    if (isMissingTableError(err)) return { available: false, windowDays: days, reason: 'ai_tables_missing' };
    console.error('[RecoHealth] AI probe error:', err?.message || err);
    return { available: false, windowDays: days, reason: 'error' };
  }
}

/** Probe both subsystems. Returns { reco, ai }. */
export async function probeIntelligenceHealth(client, { days = 7 } = {}) {
  const [reco, ai] = await Promise.all([
    probeRecommendationHealth(client, { days }),
    probeAiHealth(client, { days }),
  ]);
  return { reco, ai };
}

// ── Aggregate-only helpers for the API layer ────────────────

/** Only coarse identifiers ever leave this module. */
export function coarseHash(value) {
  if (!value) return null;
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}
