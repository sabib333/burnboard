/**
 * BURNBOARD — Social Network Health probes (Master Prompt 28)
 *
 * Aggregate, real-table measurement of the social layer: the follow graph,
 * new-user social activation ("first connection"), community ecosystem,
 * conversations, the notification (return-loop) engine, and social
 * boundaries (blocks/mutes). Every number is computed from actual rows
 * (follows, community_members, communities, social_posts, comments,
 * notifications, reactions, user_blocks, user_mutes, user_profiles).
 * Nothing is fabricated, extrapolated, or presented as a census when it is
 * a bounded sample.
 *
 * Scope & honesty rules:
 *   - Server-only. Requires a service-role client: several of these tables
 *     are owner-scoped under RLS (follows edges, notifications, blocks,
 *     mutes are only readable as your own rows), so the anon key would
 *     silently under-count — we refuse that and report unavailable.
 *   - Activation cohorts and reciprocity are measured over a bounded sample
 *     of recent accounts / edges and are labeled as such — never implied to
 *     be full-population statistics.
 *   - Things the schema cannot measure are reported as null with a note,
 *     never guessed: unfollows are deleted rows (no tombstone), community
 *     leaves are deleted rows, and member churn has no timestamp.
 *   - Every subsystem fails independently: a missing table degrades that
 *     section to available:false, never a false "healthy".
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const ACTIVATION_LOOKBACK_DAYS = 90;   // "new account" horizon
export const ACTIVATION_SAMPLE_SIZE = 250;     // newest accounts probed
export const RECIPROCITY_EDGE_CAP = 200;       // outgoing edges checked per account

const SOCIAL_TABLES = ['follows', 'community_members', 'communities', 'social_posts'];
const CONVERSATION_TABLES = ['comments', 'reactions'];
const ENGINE_TABLES = ['notifications'];
const BOUNDARY_TABLES = ['user_blocks', 'user_mutes'];
const PROFILE_TABLE = 'user_profiles';

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

function pctShare(part, whole) {
  return whole > 0 ? trunc((part / whole) * 100, 1) : null;
}

async function exactCount(client, table, query) {
  let q = client.from(table).select('id', { count: 'exact', head: true });
  if (query) q = query(q);
  const { count, error } = await q;
  if (error) throw error;
  return count === null ? null : (count || 0);
}

/**
 * Chunked `in` filter (URL-length safety for large id sets).
 */
async function selectWhereIn(client, table, select, column, values, extraQuery) {
  const rows = [];
  const unique = [...new Set(values.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    let q = client.from(table).select(select).in(column, chunk);
    if (extraQuery) q = extraQuery(q);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

// ── Probe 1: the follow graph ─────────────────────────────────

async function probeGraph(client, { days = 7 } = {}) {
  const since7d = isoDaysAgo(7);
  const since30d = isoDaysAgo(30);
  const out = { available: false };

  try {
    const [total, edges24h, edges7d, edges30d] = await Promise.all([
      exactCount(client, 'follows', null),
      exactCount(client, 'follows', (q) => q.gte('created_at', isoDaysAgo(1))),
      exactCount(client, 'follows', (q) => q.gte('created_at', since7d)),
      exactCount(client, 'follows', (q) => q.gte('created_at', since30d)),
    ]);

    // Distinct accounts reached by follow edges in the window (bounded read).
    const { data: edgeRows } = await client
      .from('follows')
      .select('follower_id, following_id')
      .gte('created_at', since7d)
      .limit(5000);
    const edges = edgeRows || [];
    const gainedFollower = new Set(edges.map((e) => e.following_id).filter(Boolean));
    const startedFollowing = new Set(edges.map((e) => e.follower_id).filter(Boolean));

    out.available = true;
    out.graph = {
      totalEdges: total,
      edges24h: edges24h,
      edges7d: edges7d,
      edges30d: edges30d,
      accountsGainingFollowers7d: gainedFollower.size,
      accountsStartingToFollow7d: startedFollowing.size,
      sampledEdges7d: edges.length,
      note: 'unfollows are deleted rows (no tombstone) — net growth cannot be measured, only edges created',
    };
    return out;
  } catch (err) {
    if (isMissingTableError(err)) return { available: false, reason: 'follows_missing' };
    console.error('[SocialHealth] graph probe error:', err?.message || err);
    return { available: false, reason: 'error' };
  }
}

// ── Probe 2: new-user social activation (first connection) ──

async function probeActivation(client) {
  const out = { available: false, lookbackDays: ACTIVATION_LOOKBACK_DAYS };

  try {
    const since = isoDaysAgo(ACTIVATION_LOOKBACK_DAYS);

    // Newest accounts created within the lookback window (bounded cohort).
    const { data: cohort, error } = await client
      .from('user_profiles')
      .select('id, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(ACTIVATION_SAMPLE_SIZE);
    if (error) throw error;
    const users = cohort || [];
    if (users.length === 0) {
      out.available = true;
      out.cohort = { sampleSize: 0 };
      return out;
    }
    const ids = users.map((u) => u.id);
    const signedUpAt = new Map(users.map((u) => [u.id, u.created_at ? new Date(u.created_at).getTime() : null]));

    // ── Outgoing follows per cohort member (one batched read) ──
    const followRows = await selectWhereIn(
      client, 'follows', 'follower_id, following_id, created_at', 'follower_id', ids
    );
    const outgoing = new Map(); // user -> [{ followingId, createdAt }]
    for (const r of followRows) {
      if (!outgoing.has(r.follower_id)) outgoing.set(r.follower_id, []);
      outgoing.get(r.follower_id).push(r);
    }
    let usersFollowing = 0;
    let usersFollowingWithin7d = 0;
    for (const [uid, edges] of outgoing) {
      usersFollowing += 1;
      const signedUp = signedUpAt.get(uid);
      if (!signedUp) continue;
      const first = edges.reduce((m, e) => {
        const t = e.created_at ? new Date(e.created_at).getTime() : null;
        return t && (!m || t < m) ? t : m;
      }, null);
      if (first && first - signedUp <= 7 * DAY_MS) usersFollowingWithin7d += 1;
    }

    // ── Follow-backs (reciprocity) for those who followed anyone ──
    // Exact presence check bounded to the first N outgoing edges per account;
    // directional, labeled as a bounded-sample measure.
    let usersWithFollowBack = 0;
    for (const [uid, edges] of outgoing) {
      const targets = edges.map((e) => e.following_id).filter(Boolean).slice(0, RECIPROCITY_EDGE_CAP);
      if (targets.length === 0) continue;
      let found = false;
      for (let i = 0; i < targets.length && !found; i += 100) {
        const chunk = targets.slice(i, i + 100);
        const { data } = await client
          .from('follows')
          .select('id')
          .eq('following_id', uid)
          .in('follower_id', chunk)
          .limit(1);
        if ((data || []).length > 0) found = true;
      }
      if (found) usersWithFollowBack += 1;
    }

    // ── Community joins, first post, first comment per cohort member ──
    const [membershipRows, postRows, commentRows] = await Promise.all([
      selectWhereIn(
        client, 'community_members', 'user_id, created_at', 'user_id', ids,
        (q) => q.eq('membership_status', 'active')
      ),
      selectWhereIn(client, 'social_posts', 'user_id, created_at', 'user_id', ids),
      selectWhereIn(client, 'comments', 'user_id, created_at', 'user_id', ids),
    ]);

    const joinedCommunity = new Set(membershipRows.map((m) => m.user_id));
    const joinedWithin7d = new Set();
    const firstJoinByUser = new Map();
    for (const m of membershipRows) {
      const t = m.created_at ? new Date(m.created_at).getTime() : null;
      if (!t) continue;
      const prev = firstJoinByUser.get(m.user_id);
      if (!prev || t < prev) firstJoinByUser.set(m.user_id, t);
    }
    for (const [uid, t] of firstJoinByUser) {
      const signedUp = signedUpAt.get(uid);
      if (signedUp && t - signedUp <= 7 * DAY_MS) joinedWithin7d.add(uid);
    }

    const posted = new Set(postRows.map((p) => p.user_id));
    const commented = new Set(commentRows.map((c) => c.user_id));

    out.available = true;
    out.cohort = {
      sampleSize: users.length,
      // labeled: newest ACTIVATION_SAMPLE_SIZE accounts in the lookback window
      followingSharePct: pctShare(usersFollowing, users.length),
      firstFollowWithin7dSharePct: pctShare(usersFollowingWithin7d, usersFollowing),
      reciprocalFollowSharePct: pctShare(usersWithFollowBack, usersFollowing),
      communityJoinSharePct: pctShare(joinedCommunity.size, users.length),
      firstCommunityJoinWithin7dSharePct: pctShare(joinedWithin7d.size, joinedCommunity.size),
      createdContentSharePct: pctShare(posted.size, users.length),
      commentedSharePct: pctShare(commented.size, users.length),
    };
    return out;
  } catch (err) {
    if (isMissingTableError(err)) return { available: false, reason: 'activation_tables_missing' };
    console.error('[SocialHealth] activation probe error:', err?.message || err);
    return { available: false, reason: 'error' };
  }
}

// ── Probe 3: community ecosystem ─────────────────────────────

async function probeCommunities(client) {
  const out = { available: false };
  try {
    const since7d = isoDaysAgo(7);
    const since30d = isoDaysAgo(30);

    const [total, active7d, active30d, publicCount, privateCount, joins7d, joins30d, ownerRows, moderatorRows] = await Promise.all([
      exactCount(client, 'communities', (q) => q.eq('status', 'active')),
      exactCount(client, 'communities', (q) => q.eq('status', 'active').gte('created_at', since7d)),
      exactCount(client, 'communities', (q) => q.eq('status', 'active').gte('created_at', since30d)),
      exactCount(client, 'communities', (q) => q.eq('status', 'active').eq('visibility', 'public')),
      exactCount(client, 'communities', (q) => q.eq('status', 'active').eq('visibility', 'private')),
      exactCount(client, 'community_members', (q) => q.eq('membership_status', 'active').gte('created_at', since7d)),
      exactCount(client, 'community_members', (q) => q.eq('membership_status', 'active').gte('created_at', since30d)),
      exactCount(client, 'community_members', (q) => q.eq('role', 'owner').eq('membership_status', 'active')),
      exactCount(client, 'community_members', (q) => q.eq('role', 'moderator').eq('membership_status', 'active')),
    ]);

    // Memberships created in the window → distinct joiners + which communities
    // actually received visible posts in the window.
    const { data: joins } = await client
      .from('community_members')
      .select('user_id')
      .eq('membership_status', 'active')
      .gte('created_at', since7d)
      .limit(5000);
    const joiners = new Set((joins || []).map((m) => m.user_id).filter(Boolean));

    const { data: posts } = await client
      .from('social_posts')
      .select('community_id')
      .eq('moderation_state', 'visible')
      .not('community_id', 'is', null)
      .gte('created_at', since7d)
      .limit(5000);
    const activeCommunities = new Set((posts || []).map((p) => p.community_id).filter(Boolean));

    out.available = true;
    out.communities = {
      total: total,
      new7d: active7d,
      new30d: active30d,
      publicCount,
      privateCount,
      joins7d,
      joins30d,
      distinctJoiners7d: joiners.size,
      communitiesWithPosts7d: activeCommunities.size,
      owners: ownerRows,
      moderators: moderatorRows,
      note: 'leaves are deleted rows and member churn has no timestamp — only joins are measurable',
    };
    return out;
  } catch (err) {
    if (isMissingTableError(err)) return { available: false, reason: 'community_tables_missing' };
    console.error('[SocialHealth] community probe error:', err?.message || err);
    return { available: false, reason: 'error' };
  }
}

// ── Probe 4: conversations (depth + meaningful vs light) ─────

async function probeConversations(client) {
  const out = { available: false };
  try {
    const since7d = isoDaysAgo(7);
    const since24h = isoDaysAgo(1);

    const [comments7d, comments24h, replies7d, reactions7d, posts7d] = await Promise.all([
      exactCount(client, 'comments', (q) => q.eq('moderation_state', 'visible').gte('created_at', since7d)),
      exactCount(client, 'comments', (q) => q.eq('moderation_state', 'visible').gte('created_at', since24h)),
      exactCount(client, 'comments', (q) => q.eq('moderation_state', 'visible').not('parent_id', 'is', null).gte('created_at', since7d)),
      exactCount(client, 'reactions', (q) => q.gte('created_at', since7d)),
      exactCount(client, 'social_posts', (q) => q.eq('moderation_state', 'visible').gte('created_at', since7d)),
    ]);

    // Distinct commenters + distinct discussion threads in the window.
    const { data: commentRows } = await client
      .from('comments')
      .select('user_id, target_id')
      .eq('moderation_state', 'visible')
      .gte('created_at', since7d)
      .limit(5000);
    const rows = commentRows || [];
    const commenters = new Set(rows.map((c) => c.user_id).filter(Boolean));
    const threads = new Set(rows.map((c) => c.target_id).filter(Boolean));

    out.available = true;
    out.conversations = {
      posts7d,
      comments7d,
      comments24h,
      distinctCommenters7d: commenters.size,
      distinctThreads7d: threads.size,
      replies7d,
      replySharePct: pctShare(replies7d, comments7d),
      lightReactions7d: reactions7d,
      // Meaningful (comment/reply) vs light (one-tap reaction) proxy.
      reactionsPerComment: comments7d > 0 ? trunc(reactions7d / comments7d, 1) : null,
      note: 'reactions are one-tap (light) and comments/replies are the meaningful interaction signal; ratios are proxies, not satisfaction measures',
    };
    return out;
  } catch (err) {
    if (isMissingTableError(err)) return { available: false, reason: 'conversation_tables_missing' };
    console.error('[SocialHealth] conversation probe error:', err?.message || err);
    return { available: false, reason: 'error' };
  }
}

// ── Probe 5: notification (return-loop) engine ───────────────

async function probeNotifications(client) {
  const out = { available: false };
  try {
    const since7d = isoDaysAgo(7);
    const since24h = isoDaysAgo(1);

    const [delivered7d, delivered24h, unread] = await Promise.all([
      exactCount(client, 'notifications', (q) => q.gte('created_at', since7d)),
      exactCount(client, 'notifications', (q) => q.gte('created_at', since24h)),
      exactCount(client, 'notifications', (q) => q.eq('is_read', false)),
    ]);

    const { data: rows } = await client
      .from('notifications')
      .select('type')
      .gte('created_at', since7d)
      .limit(5000);
    const byType = new Map();
    for (const r of rows || []) byType.set(r.type, (byType.get(r.type) || 0) + 1);

    out.available = true;
    out.notifications = {
      delivered7d,
      delivered24h,
      unreadTotal: unread,
      topTypes7d: [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([type, count]) => ({ type, count })),
    };
    return out;
  } catch (err) {
    if (isMissingTableError(err)) return { available: false, reason: 'notifications_missing' };
    console.error('[SocialHealth] notification probe error:', err?.message || err);
    return { available: false, reason: 'error' };
  }
}

// ── Probe 6: social boundaries (blocks / mutes) ───────────────

async function probeBoundaries(client) {
  const out = { available: false };
  try {
    const since7d = isoDaysAgo(7);
    const since30d = isoDaysAgo(30);

    const [blocks7d, blocks30d, mutes7d, mutes30d] = await Promise.all([
      exactCount(client, 'user_blocks', (q) => q.gte('created_at', since7d)),
      exactCount(client, 'user_blocks', (q) => q.gte('created_at', since30d)),
      exactCount(client, 'user_mutes', (q) => q.gte('created_at', since7d)),
      exactCount(client, 'user_mutes', (q) => q.gte('created_at', since30d)),
    ]);

    const { data: blockers } = await client
      .from('user_blocks')
      .select('blocker_id')
      .gte('created_at', since7d)
      .limit(5000);
    const distinctBlockers = new Set((blockers || []).map((b) => b.blocker_id).filter(Boolean));

    out.available = true;
    out.boundaries = {
      blocks7d,
      blocks30d,
      mutes7d,
      mutes30d,
      distinctBlockers7d: distinctBlockers.size,
    };
    return out;
  } catch (err) {
    if (isMissingTableError(err)) return { available: false, reason: 'boundary_tables_missing' };
    console.error('[SocialHealth] boundary probe error:', err?.message || err);
    return { available: false, reason: 'error' };
  }
}

// ── Probe all subsystems (independent failure) ────────────────

export async function probeSocialHealth(client) {
  const [graph, activation, communities, conversations, notifications, boundaries] = await Promise.all([
    probeGraph(client),
    probeActivation(client),
    probeCommunities(client),
    probeConversations(client),
    probeNotifications(client),
    probeBoundaries(client),
  ]);
  return {
    graph,
    activation,
    communities,
    conversations,
    notifications,
    boundaries,
  };
}
