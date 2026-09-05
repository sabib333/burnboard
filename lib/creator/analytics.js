/**
 * BURNBOARD — Creator Analytics Service (Master Prompt 13)
 *
 * Every number produced here comes from REAL platform tables or real
 * server-recorded events — nothing is fabricated, derived by guesswork, or
 * invented:
 *   - posts / roasts / followers   → social_posts, roasts, follows
 *   - reactions / comments received → reactions, comments targeting the
 *     creator's content (authoritative rows, same source the feed uses)
 *   - views                        → rec_events feed impressions recorded
 *     server-side for signed-in members (deduped per item per day)
 *
 * Aggregates are creator-scoped (only ever the caller's own data) and
 * privacy-aware: no viewer identities, no per-user behavior, no moderation
 * internals are exposed.
 */

import { getContentTypeLabel } from '@/lib/creator/config';

const ZERO = { posts: 0, roasts: 0, followers: 0, reactions: 0, comments: 0 };

export async function getProfile(client, userId) {
  if (!client || !userId) return null;
  try {
    const { data, error } = await client
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, bio, website_url, featured_post_id, karma, level, created_at')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return {
      id: data.id,
      username: data.username,
      displayName: data.display_name || '',
      avatarUrl: data.avatar_url || null,
      bio: data.bio || '',
      websiteUrl: data.website_url || '',
      featuredPostId: data.featured_post_id || null,
      karma: data.karma || 0,
      level: data.level || 'Newbie',
      joinedAt: data.created_at,
    };
  } catch {
    return null;
  }
}

/**
 * Real aggregate totals for the creator over a window (days=0 → all time).
 * Delegates to the SECURITY DEFINER RPC creator_totals.
 */
export async function getTotals(client, userId, days = 0) {
  if (!client || !userId) return ZERO;
  try {
    const { data, error } = await client.rpc('creator_totals', {
      p_user: userId,
      p_days: days,
    });
    if (error || !data || !data[0]) return ZERO;
    const row = data[0];
    return {
      posts: Number(row.posts || 0),
      roasts: Number(row.roasts || 0),
      followers: Number(row.followers || 0),
      reactions: Number(row.reactions || 0),
      comments: Number(row.comments || 0),
    };
  } catch {
    return ZERO;
  }
}

/**
 * Views per content item from the real impression log. Returns:
 *   { enabled, total, byContent: { id: views } }
 * enabled=false when the log/RPC is unavailable (nothing is displayed then).
 */
export async function getViewsByContent(client, userId) {
  if (!client || !userId) {
    return { enabled: false, total: 0, byContent: {} };
  }
  try {
    const { data, error } = await client.rpc('count_creator_views', {
      p_author: userId,
      p_days: 0,
    });
    if (error || !data) return { enabled: false, total: 0, byContent: {} };
    const byContent = {};
    let total = 0;
    for (const row of data) {
      const views = Number(row.views || 0);
      byContent[row.content_id] = views;
      total += views;
    }
    return { enabled: true, total, byContent };
  } catch {
    return { enabled: false, total: 0, byContent: {} };
  }
}

/**
 * Follower growth series (real follows.created_at rows, bucketed by day).
 * Returns an array of { date: 'YYYY-MM-DD', count } for the last `days` days
 * (oldest first), including zero days so the chart is honest and complete.
 */
export async function getGrowthSeries(client, userId, days = 30) {
  if (!client || !userId || days <= 0) return { series: [], error: false };
  try {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
    cutoff.setUTCHours(0, 0, 0, 0);

    const { data, error } = await client
      .from('follows')
      .select('created_at')
      .eq('following_id', userId)
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: true })
      .limit(5000);

    const bucket = {};
    for (const row of data || []) {
      if (!row?.created_at) continue;
      const day = String(row.created_at).slice(0, 10);
      bucket[day] = (bucket[day] || 0) + 1;
    }

    const series = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(cutoff);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, count: bucket[key] || 0 });
    }
    return { series, error: error ? true : false };
  } catch {
    return { series: [], error: true };
  }
}

/**
 * Newest followers with public profile info (never private behavior).
 */
export async function getRecentFollowers(client, userId, limit = 10) {
  if (!client || !userId) return [];
  try {
    const { data: follows } = await client
      .from('follows')
      .select('follower_id, created_at')
      .eq('following_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!follows?.length) return [];

    const ids = follows.map((f) => f.follower_id);
    const { data: profiles } = await client
      .from('user_profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', ids);

    const byId = {};
    for (const p of profiles || []) byId[p.id] = p;

    return follows
      .map((f) => ({
        userId: f.follower_id,
        followedAt: f.created_at,
        username: byId[f.follower_id]?.username || null,
        displayName: byId[f.follower_id]?.display_name || '',
        avatarUrl: byId[f.follower_id]?.avatar_url || null,
      }))
      .filter((f) => f.username);
  } catch {
    return [];
  }
}

/**
 * Content performance for the creator's social posts, with REAL engagement
 * counts read from the reactions/comments tables (never cached guesses).
 * viewsByContent (optional) overlays the real impression log.
 */
export async function getContentStats(client, userId, {
  days = 0,
  limit = 20,
  offset = 0,
  viewsByContent = null,
} = {}) {
  if (!client || !userId) return { items: [], total: 0, hasMore: false };

  try {
    let q = client
      .from('social_posts')
      .select('id, content_type, content_text, media_url, upvote_count, created_at, community_id, challenge_id')
      .eq('user_id', userId);

    if (days > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      q = q.gte('created_at', cutoff.toISOString());
    }

    const { data: posts, error } = await q
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const items = (posts || []).map((p) => ({
      id: p.id,
      type: p.content_type,
      typeLabel: getContentTypeLabel(p.content_type),
      text: p.content_text || '',
      mediaUrl: p.media_url || null,
      createdAt: p.created_at,
      upvotes: p.upvote_count || 0,
      views: viewsByContent && viewsByContent.enabled ? viewsByContent.byContent[p.id] || 0 : null,
    }));

    if (error || items.length === 0) {
      return { items, total: 0, hasMore: false };
    }

    const ids = items.map((p) => p.id);

    // Real reaction rows on these posts.
    const { data: reactionRows } = await client
      .from('reactions')
      .select('target_id, reaction_type')
      .eq('target_type', 'social_post')
      .in('target_id', ids);

    // Real comment rows on these posts.
    const { data: commentRows } = await client
      .from('comments')
      .select('target_id')
      .eq('target_type', 'social_post')
      .in('target_id', ids);

    const reactionsByPost = {};
    const commentsByPost = {};
    for (const r of reactionRows || []) {
      reactionsByPost[r.target_id] = (reactionsByPost[r.target_id] || 0) + 1;
    }
    for (const c of commentRows || []) {
      commentsByPost[c.target_id] = (commentsByPost[c.target_id] || 0) + 1;
    }

    for (const item of items) {
      item.reactions = reactionsByPost[item.id] || 0;
      item.comments = commentsByPost[item.id] || 0;
      item.engagement = item.reactions + item.comments;
    }

    // Total visible posts (cheap head count) for pagination.
    const { count } = await client
      .from('social_posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const total = count || items.length;
    return { items, total, hasMore: offset + items.length < total };
  } catch {
    return { items: [], total: 0, hasMore: false };
  }
}

/**
 * Rules-based, truthful insights. Returns short neutral strings only when
 * the underlying numbers are real and non-zero — never fabricated advice,
 * never "viral" promises.
 */
export function buildInsights({
  totals7 = ZERO,
  totals30 = ZERO,
  totalsAll = ZERO,
  topContent = [],
  recentContent = [],
} = {}) {
  const insights = [];

  if (totals7.followers > 0) {
    insights.push(`📈 You gained ${totals7.followers} new follower${totals7.followers === 1 ? '' : 's'} in the last 7 days.`);
  }
  if (totals7.reactions > 0) {
    insights.push(`🔥 Your content received ${totals7.reactions} reaction${totals7.reactions === 1 ? '' : 's'} in the last 7 days.`);
  }
  if (totals7.comments > 0) {
    insights.push(`💬 ${totals7.comments} comment${totals7.comments === 1 ? '' : 's'} started conversations on your posts this week.`);
  }

  // Most engaging content type among the creator's recent posts.
  const typeTotals = {};
  for (const c of recentContent) {
    typeTotals[c.typeLabel] = (typeTotals[c.typeLabel] || 0) + c.engagement;
  }
  const topType = Object.entries(typeTotals)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])[0];
  if (topType) {
    insights.push(`🎯 "${topType[0]}" posts are driving the most engagement for you right now.`);
  }

  // Best single piece of content (real numbers only).
  const best = topContent[0];
  if (best && best.engagement > 0) {
    insights.push(
      `⭐ Your most engaging recent post received ${best.engagement} reaction${best.engagement === 1 ? '' : 's'} and comment${best.engagement === 1 ? '' : 's'} combined.`
    );
  }

  // Recent-vs-previous comparison over the same window — neutral framing.
  if (recentContent.length >= 6) {
    const recent = recentContent.slice(0, 5).reduce((s, c) => s + c.engagement, 0);
    const previous = recentContent.slice(5, 10).reduce((s, c) => s + c.engagement, 0);
    if (recent > 0 && previous > 0 && recent > previous) {
      insights.push('📊 Your five most recent posts are receiving more engagement than the five before them.');
    }
  }

  if (totalsAll.followers === 0) {
    insights.push('💡 Your audience grows when people find you. Share your profile and keep posting what you love.');
  }

  return insights.slice(0, 4);
}

/** Compute next milestone progress against real totals. */
export function nextStepsFromTotals(totals) {
  return {
    posts: (totals && totals.posts) || 0,
    followers: (totals && totals.followers) || 0,
    reactions: (totals && totals.reactions) || 0,
    comments: (totals && totals.comments) || 0,
  };
}
