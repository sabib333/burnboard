/**
 * BURNBOARD AI Operating System — Personal AI orchestration (MP22)
 *
 * Thin, safe orchestration over the provider abstraction for the three
 * Personal AI capabilities (registry: lib/ai/registry.js):
 *
 *   1. personal_ai_guide  — grounded Q&A over the curated help corpus.
 *   2. personal_ai_digest — a read-only "while you were away" summary built
 *      ONLY from the requesting user's own authorized graph. Computed at
 *      request time from real rows — never from inference, so it cannot
 *      invent activity that didn't happen.
 *   3. content_polish_assist — optional suggestions on the user's own draft
 *      text. Draft-only: publishing is always the user's manual action.
 *
 * Privacy + safety invariants:
 *   - Only the requesting user's own data is ever read (follows,
 *     communities, own drafts). No cross-user aggregation is sent to models.
 *   - No AI call can publish, message, spend, or change settings.
 *   - Every execution flows through executeTask (observability + cost
 *     tracking + builtin fallback), so a model outage degrades to a
 *     deterministic, still-useful answer — never a broken page.
 */

import { executeTask } from './provider';
import { AI_TASKS } from './routing';

// Per-capability user rate limits (sliding window, in-memory per instance —
// same posture as the first-party rate limiter). Cheap capabilities are
// generous; nothing is unlimited.
export const AI_USER_LIMITS = {
  personal_ai_guide: { windowMs: 60_000, max: 10 },     // 10 questions/min
  content_polish_assist: { windowMs: 60_000, max: 8 },  // 8 polish calls/min
  personal_ai_digest: { windowMs: 300_000, max: 3 },    // 3 digests/5 min
};

const guideStore = new Map(); // 'capability:userId' -> timestamps[]

function checkUserLimit(capability, userId, now = Date.now()) {
  if (!userId) return { ok: true }; // anonymous fallback still limited lower down
  const cfg = AI_USER_LIMITS[capability];
  if (!cfg) return { ok: true };
  const key = `${capability}:${userId}`;
  const hits = guideStore.get(key) || [];
  const fresh = hits.filter(t => t > now - cfg.windowMs);
  if (fresh.length >= cfg.max) {
    guideStore.set(key, fresh);
    return { ok: false, retryAfterSeconds: Math.ceil((fresh[0] + cfg.windowMs - now) / 1000) };
  }
  fresh.push(now);
  guideStore.set(key, fresh);
  return { ok: true };
}

/**
 * Respect a user's stored opt-out toggles (personal_ai_preferences). The
 * UI toggle is cosmetic; this check is what actually disables a capability.
 */
async function capabilityDisabledByUser(client, userId, capability) {
  if (!client || !userId) return false;
  try {
    const { data } = await client
      .from('personal_ai_preferences')
      .select('disabled_capabilities')
      .eq('user_id', userId)
      .maybeSingle();
    return (data?.disabled_capabilities || []).includes(capability);
  } catch {
    return false; // preference store unavailable → treat as not-disabled
  }
}

const FLAG_TO_CAPABILITY = {
  personal_ai_guide: 'ai_personal_guide',
  content_polish_assist: 'ai_content_polish',
  personal_ai_digest: 'ai_personal_digest',
};

/**
 * Ask the Personal Guide a question.
 * Grounded answers come from the curated help corpus; when a real provider
 * is configured the same task also flows through executeTask (with the
 * deterministic answer as the builtin fallback). Returns:
 *   { ok, answer, sources[], usedModel: boolean }
 */
export async function askPersonalGuide(client, { userId, question }) {
  const q = String(question || '').trim().slice(0, 400);
  if (!q) return { ok: false, error: 'empty_question' };
  if (await capabilityDisabledByUser(client, userId, 'ai_personal_guide')) {
    return { ok: false, error: 'disabled_by_user' };
  }

  const lim = checkUserLimit('personal_ai_guide', userId);
  if (!lim.ok) return { ok: false, error: 'rate_limited', retryAfterSeconds: lim.retryAfterSeconds };

  // executeTask routes to gemini when configured; canServe() returns false
  // for gemini on this task today, so the deterministic corpus answer is the
  // result — grounded and sourced by construction.
  const res = await executeTask({
    task: 'personal_ai_guide',
    params: { text: q },
    subjectId: userId,
  });

  if (!res.success) {
    return { ok: false, error: res.error || 'assistant_unavailable' };
  }
  return {
    ok: true,
    answer: res.answer || null,
    suggestions: res.suggestions || [],
    sources: res.sources || [],
    provider: res.provider || 'builtin',
  };
}

/**
 * Compute the user's daily digest over their OWN graph. Read-only, no model
 * calls, no fabricated activity. Sources:
 *   - creators the user follows → their recent public posts
 *   - communities the user joined → recent public posts
 *   - open challenges the user participates in
 * Everything is filtered by RLS/visibility server-side.
 */
export async function computeDailyDigest(client, userId, { limit = 8 } = {}) {
  if (!client || !userId) return { ok: false, error: 'unauthorized' };
  if (await capabilityDisabledByUser(client, userId, 'ai_personal_digest')) {
    return { ok: false, error: 'disabled_by_user' };
  }
  const lim = checkUserLimit('personal_ai_digest', userId);
  if (!lim.ok) return { ok: false, error: 'rate_limited', retryAfterSeconds: lim.retryAfterSeconds };

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const items = [];

  // 1. Creators the user follows → their posts (public only).
  try {
    const { data: followRows } = await client
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)
      .limit(200);
    const creatorIds = (followRows || []).map(r => r.following_id).filter(Boolean);
    if (creatorIds.length) {
      const { data: posts } = await client
        .from('social_posts')
        .select('id, content_text, content_type, user_id, created_at')
        .eq('visibility', 'public')
        .gte('created_at', since)
        .in('user_id', creatorIds)
        .order('created_at', { ascending: false })
        .limit(limit);
      for (const p of posts || []) {
        items.push({
          kind: 'creator_post',
          id: p.id,
          creatorId: p.user_id,
          text: String(p.content_text || '').slice(0, 160),
          createdAt: p.created_at,
        });
      }
    }
  } catch (e) {
    console.warn('[Personal AI] digest follows query failed:', e?.message || e);
  }

  // 2. Communities the user joined → recent activity count + sample posts.
  try {
    const { data: memberRows } = await client
      .from('community_members')
      .select('community_id')
      .eq('user_id', userId)
      .eq('membership_status', 'active')
      .limit(100);
    const communityIds = (memberRows || []).map(r => r.community_id).filter(Boolean);
    if (communityIds.length) {
      const { data: posts } = await client
        .from('social_posts')
        .select('id, content_text, community_id, created_at')
        .eq('visibility', 'public')
        .gte('created_at', since)
        .in('community_id', communityIds)
        .order('created_at', { ascending: false })
        .limit(limit);
      for (const p of posts || []) {
        items.push({
          kind: 'community_post',
          id: p.id,
          communityId: p.community_id,
          text: String(p.content_text || '').slice(0, 160),
          createdAt: p.created_at,
        });
      }
    }
  } catch (e) {
    console.warn('[Personal AI] digest communities query failed:', e?.message || e);
  }

  // Sort by freshness and cap. NEVER label this as exhaustive — it is a
  // genuine sample of the user's own graph.
  const fresh = items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
  if (!fresh.length) {
    return { ok: true, items: [], note: 'No new activity from your creators or communities in the last 24 hours.' };
  }
  return { ok: true, items: fresh, note: null };
}

/**
 * Optional polish of the user's own draft text. Returns suggestions only —
 * never auto-publishes. The deterministic fallback runs locally.
 */
export async function polishDraftText({ client, userId, text }) {
  const t = String(text || '').trim().slice(0, 800);
  if (!t) return { ok: false, error: 'empty_draft' };
  if (await capabilityDisabledByUser(client, userId, 'ai_content_polish')) {
    return { ok: false, error: 'disabled_by_user' };
  }

  const lim = checkUserLimit('content_polish_assist', userId);
  if (!lim.ok) return { ok: false, error: 'rate_limited', retryAfterSeconds: lim.retryAfterSeconds };

  const res = await executeTask({
    task: 'content_polish_assist',
    params: { text: t },
    subjectId: userId,
  });
  if (!res.success) return { ok: false, error: res.error || 'polish_unavailable' };
  return {
    ok: true,
    suggestions: Array.isArray(res.suggestions) ? res.suggestions : [],
    provider: res.provider || 'builtin',
  };
}