/**
 * BURNBOARD Personalization — Behavioral Signal Recording (server-side)
 *
 * Turns real, already-validated platform behavior (a reaction was created,
 * a comment posted, a follow made, a community joined...) into:
 *   1. an immutable, replay-protected row in `rec_events`, and
 *   2. decayed, capped affinity updates in `user_affinities`.
 *
 * Integrity rules:
 *   - Only ever called from server routes AFTER the underlying behavior
 *     write succeeded — never trusted client analytics, never fabricated.
 *   - The actor is the request's authenticated user (SSR client), so RLS
 *     (auth.uid() = user_id) is the final authority on who can record.
 *   - idempotency keys make duplicate/replayed writes a no-op (unique
 *     partial index → 23505 → skip).
 *   - Every function fails soft: personalization must never break a write.
 */

import {
  SIGNAL_STRENGTH, EVENT_POLARITY,
  AFFINITY,
} from './config';

const VALID_EVENT_TYPES = new Set(Object.keys(SIGNAL_STRENGTH));
const VALID_DIMENSIONS = new Set(['topic', 'creator', 'community', 'content_type']);

function daysBetween(isoA, isoB) {
  const a = isoA ? new Date(isoA).getTime() : Date.now();
  const b = isoB ? new Date(isoB).getTime() : Date.now();
  return Math.max(0, (b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Decay a stored magnitude toward zero (half-life = AFFINITY.halfLifeDays)
 * so old interests fade unless reinforced.
 */
function decayValue(value, lastUpdatedAt) {
  const factor = Math.pow(0.5, daysBetween(lastUpdatedAt, new Date().toISOString()) / AFFINITY.halfLifeDays);
  return Math.max(0, (value || 0) * factor);
}

/**
 * Apply one affinity delta for one (user, dimension, key) row.
 * Reads the current row (so decay is computed in-app), then upserts.
 * Never throws — fails soft.
 */
async function applyAffinityDelta({ client, userId, dimension, key, label, weight, polarity }) {
  if (!client || !userId || !key || !VALID_DIMENSIONS.has(dimension)) return;
  try {
    const nowIso = new Date().toISOString();
    const { data: existing } = await client
      .from('user_affinities')
      .select('positive, negative, signal_count, updated_at')
      .eq('user_id', userId)
      .eq('dimension', dimension)
      .eq('key', String(key))
      .maybeSingle();

    const isPositive = polarity !== 'negative';
    const decayedPositive = decayValue(existing?.positive, existing?.updated_at);
    const decayedNegative = decayValue(existing?.negative, existing?.updated_at);

    const next = {
      user_id: userId,
      dimension,
      key: String(key),
      label: label || null,
      positive: isPositive
        ? Math.min(AFFINITY.maxAccumulated, decayedPositive + weight)
        : decayedPositive,
      negative: isPositive
        ? decayedNegative
        : Math.min(AFFINITY.maxAccumulated, decayedNegative + weight),
      signal_count: (existing?.signal_count || 0) + 1,
      last_positive_at: isPositive ? nowIso : existing?.last_positive_at || null,
      last_negative_at: isPositive ? existing?.last_negative_at || null : nowIso,
      updated_at: nowIso,
    };

    if (existing) {
      await client.from('user_affinities')
        .update(next)
        .eq('user_id', userId)
        .eq('dimension', dimension)
        .eq('key', String(key));
    } else {
      await client.from('user_affinities').insert(next);
    }
  } catch (err) {
    console.error('[Reco] affinity delta error:', err?.message || err);
  }
}

/**
 * Dimensions derived from a content item's context.
 * context: { author_id, community_id, content_type, topic_ids }
 */
function contentDimensions(context = {}) {
  const dims = [];
  const seen = new Set();
  const push = (dimension, key, label) => {
    if (!key) return;
    const sig = `${dimension}:${String(key)}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    dims.push({ dimension, key, label });
  };
  push('creator', context.author_id, context.author_label);
  push('community', context.community_id, context.community_label);
  push('content_type', context.content_type, context.content_type_label);
  for (const t of Array.isArray(context.topic_ids) ? context.topic_ids : []) {
    if (t) push('topic', t, context.topic_labels?.[String(t)] || null);
  }
  return dims;
}

/**
 * Resolve lightweight content metadata used to attribute a signal to the
 * right creator/community/type. targetType: 'social_post' | 'roast'.
 * Returns { author_id, community_id, content_type } or null.
 */
export async function resolveContentContext(client, targetType, targetId) {
  if (!client || !targetId) return null;
  try {
    if (targetType === 'social_post') {
      const { data } = await client
        .from('social_posts')
        .select('user_id, community_id, content_type')
        .eq('id', targetId)
        .maybeSingle();
      if (!data) return null;
      return {
        author_id: data.user_id,
        community_id: data.community_id,
        content_type: data.content_type || 'social_post',
      };
    }
    if (targetType === 'roast') {
      const { data } = await client
        .from('roasts')
        .select('user_id')
        .eq('id', targetId)
        .maybeSingle();
      if (!data) return null;
      return { author_id: data.user_id, community_id: null, content_type: 'roast' };
    }
  } catch (err) {
    console.error('[Reco] resolveContentContext error:', err?.message || err);
  }
  return null;
}

/**
 * Record one behavioral signal for the authenticated user.
 *
 * @param {object} opts
 *   client           SSR client carrying the user session (required)
 *   userId           authenticated user id (required)
 *   eventType        one of SIGNAL_STRENGTH keys
 *   targetType       'social_post' | 'roast' | 'user' | 'community' | ...
 *   targetId         uuid (required except for search-like events)
 *   context          { author_id, community_id, content_type, topic_ids,
 *                      topic_labels, author_label, community_label,
 *                      polarity, source }
 *   weight           optional explicit strength override
 *   idempotencyKey   optional; replay protection (e.g. react-<targetId>)
 *   dedupeWindowHours optional; when set, a signal with the same key within
 *                     this window is skipped, but later repeats still count
 *                     (used for weak recurring signals like views)
 */
export async function recordSignal({
  client, userId, eventType, targetType, targetId,
  context = {}, weight, idempotencyKey, dedupeWindowHours,
}) {
  if (!client || !userId) return;
  if (!VALID_EVENT_TYPES.has(eventType)) return;
  if (!targetType || !targetId) return;

  const strength = weight || SIGNAL_STRENGTH[eventType] || 1;
  const polarity = context.polarity || EVENT_POLARITY[eventType] || 'positive';

  try {
    // Windowed dedupe: skip if a matching signal was recorded recently.
    if (idempotencyKey && dedupeWindowHours) {
      const sinceIso = new Date(Date.now() - dedupeWindowHours * 60 * 60 * 1000).toISOString();
      const { data: recent } = await client
        .from('rec_events')
        .select('id')
        .eq('user_id', userId)
        .eq('idempotency_key', idempotencyKey)
        .gte('created_at', sinceIso)
        .maybeSingle();
      if (recent) return;
    }

    const row = {
      user_id: userId,
      event_type: eventType,
      target_type: targetType,
      target_id: targetId,
      weight: strength,
      context: {
        polarity,
        ...context,
      },
      // DB-unique keys (no dedupeWindowHours) block permanent replays; weak
      // recurring signals omit the stored key so they can repeat later.
      idempotency_key: idempotencyKey && !dedupeWindowHours ? idempotencyKey : null,
    };

    const { error } = await client.from('rec_events').insert(row);
    if (error) {
      // 23505 = duplicate idempotency key → already recorded, skip learnings.
      if (error.code === '23505') return;
      throw error;
    }

    // Affinity learning for content-scoped events.
    if (['social_post', 'roast'].includes(targetType)) {
      const dims = contentDimensions(context);
      for (const dim of dims) {
        await applyAffinityDelta({ client, userId, ...dim, weight: strength, polarity });
      }
    } else if (targetType === 'user' && ['user_followed', 'user_unfollowed'].includes(eventType)) {
      await applyAffinityDelta({
        client, userId,
        dimension: 'creator', key: targetId,
        label: context.author_label || null,
        weight: strength, polarity,
      });
    } else if (targetType === 'community' && ['community_joined', 'community_left'].includes(eventType)) {
      await applyAffinityDelta({
        client, userId,
        dimension: 'community', key: targetId,
        label: context.community_label || null,
        weight: strength, polarity,
      });
    } else if (targetType === 'challenge' && eventType === 'challenge_participated') {
      await applyAffinityDelta({
        client, userId,
        dimension: 'community', key: context.community_id,
        label: context.community_label || null,
        weight: strength * 0.6, polarity,
      });
    } else if (targetType === 'topic' && eventType === 'topic_viewed') {
      await applyAffinityDelta({
        client, userId,
        dimension: 'topic', key: targetId,
        label: context.topic_label || null,
        weight: strength, polarity,
      });
    }
  } catch (err) {
    // Personalization must never break the underlying product behavior.
    console.error('[Reco] recordSignal error:', err?.message || err);
  }
}

/**
 * Apply negative learning for explicit content feedback ("Not interested").
 * The scope snapshot (author/community/type/topics of the item at feedback
 * time) is already validated server-side by the feedback route.
 */
export async function applyFeedbackLearning({
  client, userId, eventType, targetType, targetId, scope = {}, weight,
}) {
  if (!client || !userId) return;
  if (!['not_interested', 'content_hidden', 'show_less_creator'].includes(eventType)) return;
  try {
    const strength = weight || SIGNAL_STRENGTH[eventType] || 1;
    const row = {
      user_id: userId,
      event_type: eventType,
      target_type: targetType,
      target_id: targetId,
      weight: strength,
      context: { polarity: 'negative', source: 'user_feedback', ...scope },
      idempotency_key: `${eventType}-${targetType}-${targetId}`,
    };
    const { error } = await client.from('rec_events').insert(row);
    if (error && error.code !== '23505') throw error;
    // Repeating feedback on the same item is a no-op for learning — a single
    // explicit action is already proportionally represented.
    if (error && error.code === '23505') return;

    // Affinity learning covers every captured scope: creator, community,
    // content type, and the community's topics (all validated server-side).
    const dims = contentDimensions(scope);
    for (const dim of dims) {
      await applyAffinityDelta({ client, userId, ...dim, weight: strength, polarity: 'negative' });
    }
  } catch (err) {
    console.error('[Reco] applyFeedbackLearning error:', err?.message || err);
  }
}
