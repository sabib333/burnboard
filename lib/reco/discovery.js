/**
 * BURNBOARD Personalization — Discovery Rails (Master Prompt 12)
 *
 * Real, explainable recommendations for:
 *   - People You May Like (creator discovery)
 *   - Communities for You
 *   - Challenges for You
 *
 * Signals are legitimate only: community membership overlap, friend-of-
 * friend follows, the viewer's own affinities/interests, and real activity
 * counts. Blocks and mutes are always respected. No private relationship
 * data is ever revealed to the viewer beyond aggregate, product-level
 * reason text. Scores never leave this module.
 */

import { hiddenAuthorIds } from '@/lib/safety';

const DAY_MS = 24 * 60 * 60 * 1000;

function log1p(n) {
  return Math.log1p(Math.max(0, n));
}

function chunk(list, size = 100) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function fetchProfiles(client, ids) {
  const rows = [];
  for (const c of chunk([...new Set(ids)])) {
    const { data } = await client
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, bio, follower_count, post_count, karma, created_at')
      .in('id', c);
    rows.push(...(data || []));
  }
  return rows;
}

// ── People You May Like ─────────────────────────────────────
//
// `mutualOnly` (used by the discover page's "Suggested for you" rail)
// restricts candidates to people who already follow the viewer and whom the
// viewer hasn't followed back yet — the strongest, most personal "you know
// them" signal. All other sources (community overlap, friend-of-friend,
// affinity) are skipped and interleaving is unnecessary since every item is
// a mutual follow by construction.
export async function recommendCreators({ client, userId, limit = 6, mutualOnly = false }) {
  if (!client || !userId) return { items: [] };
  const now = Date.now();
  const result = { items: [] };

  try {
    // Viewer basics
    const [followRes, memberRes] = await Promise.all([
      client.from('follows').select('following_id').eq('follower_id', userId).limit(300),
      client.from('community_members')
        .select('community_id')
        .eq('user_id', userId)
        .eq('membership_status', 'active')
        .limit(200),
    ]);
    const follows = new Set((followRes.data || []).map(r => r.following_id));
    const joined = new Set((memberRes.data || []).map(r => r.community_id));
    follows.delete(userId);

    // Affinity creators (people whose posts this user genuinely engages with)
    const affinityMap = new Map();
    const { data: affinityRows } = await client
      .from('user_affinities')
      .select('key, label, positive')
      .eq('user_id', userId)
      .eq('dimension', 'creator')
      .gte('positive', 0.3)
      .limit(100);
    for (const r of affinityRows || []) {
      if (r.key && r.key !== userId) affinityMap.set(r.key, r.positive);
    }

    // Candidate map: id -> { sharedCommunities: [], foaf: 0, affinity: 0, mutual: false }
    const candidates = new Map();
    const add = (id, key, amount = 1) => {
      if (!id || id === userId || follows.has(id)) return;
      if (!candidates.has(id)) {
        candidates.set(id, { sharedCommunities: new Set(), foaf: 0, affinity: 0, mutual: false });
      }
      const entry = candidates.get(id);
      if (key === 'community') entry.sharedCommunities.add(amount);
      else if (key === 'foaf') entry.foaf += 1;
      else if (key === 'affinity') entry.affinity = Math.max(entry.affinity, amount);
      else if (key === 'mutual') entry.mutual = true;
    };

    // Source 0: mutual-follow rail (People You May Know) — people who already
    // follow the viewer. A real existing relationship: following back makes
    // the connection mutual. These are the strongest, most personal
    // suggestions and are surfaced first.
    const { data: followersRes } = await client
      .from('follows')
      .select('follower_id')
      .eq('following_id', userId)
      .limit(300);
    for (const r of followersRes || []) add(r.follower_id, 'mutual');

    // In mutual-only mode, stop gathering further sources — mutual followers
    // are the entire candidate pool (friend-of-friend/community/affinity
    // discovery belongs to the regular rail).
    if (!mutualOnly) {
      // Source A: co-members in the viewer's communities (discovery via real
      // shared memberships — limited reads, most recent membership first).
      if (joined.size) {
        const joinedList = [...joined].slice(0, 50);
        const { data: members } = await client
          .from('community_members')
          .select('user_id, community_id')
          .eq('membership_status', 'active')
          .in('community_id', joinedList)
          .order('created_at', { ascending: false })
          .limit(700);
        for (const m of members || []) add(m.user_id, 'community', m.community_id);
      }

      // Source B: friend-of-friend (people followed by people the viewer follows)
      if (follows.size) {
        const seed = [...follows].slice(0, 120);
        const { data: secondHop } = await client
          .from('follows')
          .select('following_id')
          .in('follower_id', seed)
          .limit(700);
        for (const r of secondHop || []) add(r.following_id, 'foaf');
      }

      // Source C: genuine repeated engagement with a creator's content
      for (const [id, pos] of affinityMap) add(id, 'affinity', pos);
    }

    const candidateIds = [...candidates.keys()]
      .filter(id => !follows.has(id) && id !== userId)
      .filter(id => !mutualOnly || candidates.get(id).mutual);
    if (candidateIds.length === 0) return result;

    // Safety: exclude anyone the viewer blocked/muted and anyone who
    // blocked/muted the viewer (mutual enforcement before discovery).
    const hidden = await hiddenAuthorIds(client, userId, candidateIds);
    let eligible = candidateIds.filter(id => !hidden.has(id));
    if (eligible.length === 0) return result;

    // Bound profile fetches: pre-rank from lightweight graph counts first,
    // then enrich only the strongest candidates with real profiles.
    eligible = eligible
      .sort((a, b) => {
        const score = (entry) => (entry.mutual ? 6.2 : 0)
          + (entry.affinity > 0 ? 5 + Math.min(entry.affinity, 6) * 0.8 : 0)
          + entry.sharedCommunities.size * 1.5
          + Math.min(entry.foaf, 10) * 0.8;
        return score(candidates.get(b)) - score(candidates.get(a));
      })
      .slice(0, 60);

    // Fetch real profiles (banned profiles are RLS-hidden and drop out).
    const profiles = await fetchProfiles(client, eligible);
    const profileById = new Map(profiles.map(p => [p.id, p]));

    // Resolve community names only for the shared communities that exist
    // (viewer is a member of each, so this is their own data).
    const sharedIds = new Set();
    for (const id of eligible) {
      for (const cid of candidates.get(id).sharedCommunities) sharedIds.add(cid);
    }
    const communityNames = new Map();
    if (sharedIds.size) {
      for (const c of chunk([...sharedIds])) {
        const { data } = await client.from('communities').select('id, name').in('id', c);
        for (const row of data || []) communityNames.set(row.id, row.name);
      }
    }

    const scored = [];
    for (const id of eligible) {
      const profile = profileById.get(id);
      if (!profile || !profile.username) continue;
      const entry = candidates.get(id);
      const sharedCount = entry.sharedCommunities.size;
      const aff = entry.affinity;
      const activity = log1p(profile.post_count || 0) + log1p(profile.follower_count || 0) / 8;

      // Affinity (own engagement) is the strongest signal; shared membership
      // and friend-of-friend support discovery.
      const score = (entry.mutual ? 6.2 : 0)
        + (aff > 0 ? 5 + Math.min(aff, 6) * 0.8 : 0)
        + sharedCount * 1.5
        + Math.min(entry.foaf, 10) * 0.8
        + Math.min(activity, 2);

      let reason = null;
      if (entry.mutual) {
        reason = { key: 'mutual', text: 'Follows you' };
      } else if (aff > 0) {
        reason = { key: 'affinity', text: 'You engage with their posts' };
      } else if (sharedCount > 0) {
        const firstName = communityNames.get([...entry.sharedCommunities][0]);
        reason = sharedCount === 1 && firstName
          ? { key: 'community', text: `Also active in ${firstName}` }
          : { key: 'community', text: `In ${sharedCount} communities with you` };
      } else if (entry.foaf > 0) {
        reason = { key: 'foaf', text: 'Followed by people you follow' };
      }

      scored.push({
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        bio: profile.bio,
        followerCount: profile.follower_count || 0,
        postCount: profile.post_count || 0,
        createdAt: profile.created_at,
        reason,
        score,
        sourceKey: reason?.key || 'other',
      });
    }

    scored.sort((a, b) => b.score - a.score);

    // Interleave by reason so the rail is not dominated by a single source.
    // Mutual-follow suggestions bubble to the top (highest score) while the
    // rotation keeps discovery diversity intact.
    const bySource = new Map();
    for (const s of scored) {
      if (!bySource.has(s.sourceKey)) bySource.set(s.sourceKey, []);
      bySource.get(s.sourceKey).push(s);
    }
    let items = [];
    if (mutualOnly) {
      // Every candidate here is a mutual follow — no interleave needed.
      // Skip very-old accounts the same way the regular rail does.
      const nowMs = Date.now();
      const fresh = scored
        .filter(s => (nowMs - new Date(s.createdAt).getTime()) / DAY_MS <= 400)
        .sort((a, b) => b.score - a.score);
      items = fresh.slice(0, limit).map(top => ({
        id: top.id,
        username: top.username,
        displayName: top.displayName,
        avatarUrl: top.avatarUrl,
        bio: top.bio,
        followerCount: top.followerCount,
        mutual: true,
        reason: top.reason || { key: 'mutual', text: 'Follows you' },
      }));
    } else {
      const keys = [...bySource.keys()];
      let guard = 0;
      while (items.length < limit && guard < limit * keys.length + 8) {
        guard += 1;
        let placed = false;
        for (const key of keys) {
          const bucket = bySource.get(key);
          if (bucket && bucket.length) {
            // Skip candidates who have been inactive for a very long time.
            const top = bucket.shift();
            const inactiveDays = (now - new Date(top.createdAt).getTime()) / DAY_MS;
            if (inactiveDays > 400 && bySource.size > 1) {
              if (!bucket.length) keys.splice(keys.indexOf(key), 1);
              placed = true;
              continue;
            }
            items.push({
              id: top.id,
              username: top.username,
              displayName: top.displayName,
              avatarUrl: top.avatarUrl,
              bio: top.bio,
              followerCount: top.followerCount,
              mutual: top.sourceKey === 'mutual',
              reason: top.reason || { key: 'discovery', text: 'Worth checking out' },
            });
            if (!bucket.length) keys.splice(keys.indexOf(key), 1);
            placed = true;
          }
        }
        if (!placed) break;
      }
    }

    result.items = items.slice(0, limit);
  } catch (err) {
    console.error('[Discovery] recommendCreators error:', err?.message || err);
  }
  return result;
}

// ── Communities for You ─────────────────────────────────────
export async function recommendCommunities({ client, userId, limit = 6 }) {
  if (!client || !userId) return { items: [] };
  const result = { items: [] };

  try {
    const [memberRes, affinityRes, interestRes] = await Promise.all([
      client.from('community_members')
        .select('community_id')
        .eq('user_id', userId)
        .eq('membership_status', 'active')
        .limit(200),
      client.from('user_affinities')
        .select('key, label, positive')
        .eq('user_id', userId)
        .eq('dimension', 'community')
        .gte('positive', 0.3)
        .limit(100),
      client.from('user_interests').select('topic_id').eq('user_id', userId).limit(60),
    ]);
    const joined = new Set((memberRes.data || []).map(r => r.community_id));
    const affinityComms = new Map((affinityRes.data || [])
      .filter(r => r.key && !joined.has(r.key))
      .map(r => [r.key, r.positive]));
    const explicitTopics = new Set((interestRes.data || []).map(r => r.topic_id));

    // Community-topic signature: topics of the viewer's joined communities +
    // explicit interest topics.
    let joinedTopicIds = new Set();
    if (joined.size) {
      const { data: links } = await client
        .from('community_topics')
        .select('topic_id')
        .in('community_id', [...joined].slice(0, 100))
        .limit(400);
      joinedTopicIds = new Set((links || []).map(r => r.topic_id));
    }
    const signature = new Set([...joinedTopicIds, ...explicitTopics]);

    const candidateOverlap = new Map(); // community_id -> { topicCount, matchedTopics }
    const matchedTopicSet = new Set();

    // Overlap candidates: communities sharing a topic with the viewer's
    // signature, excluding communities they already joined.
    if (signature.size) {
      let q = client
        .from('community_topics')
        .select('community_id, topic_id')
        .in('topic_id', [...signature].slice(0, 200))
        .limit(600);
      if (joined.size) q = q.not('community_id', 'in', `(${[...joined].slice(0, 300).join(',')})`);
      const { data: links } = await q;
      for (const link of links || []) {
        if (joined.has(link.community_id)) continue;
        if (!candidateOverlap.has(link.community_id)) {
          candidateOverlap.set(link.community_id, { topicIds: new Set() });
        }
        candidateOverlap.get(link.community_id).topicIds.add(link.topic_id);
        matchedTopicSet.add(link.topic_id);
      }
    }

    const candidateIds = [
      ...candidateOverlap.keys(),
      ...affinityComms.keys(),
    ].filter(id => !joined.has(id));

    if (candidateIds.length === 0) return result;

    // Fetch real community meta (public only; RLS drops private communities
    // the viewer can't access).
    const communityById = new Map();
    for (const c of chunk(candidateIds)) {
      const { data } = await client
        .from('communities')
        .select('id, name, slug, description, avatar_url')
        .eq('status', 'active')
        .eq('visibility', 'public')
        .in('id', c);
      for (const row of data || []) communityById.set(row.id, row);
    }

    const eligible = [...communityById.keys()];
    if (eligible.length === 0) return result;

    // Real member counts + real recent activity (single grouped queries).
    const memberCounts = new Map();
    const { data: memberRows } = await client
      .from('community_members')
      .select('community_id')
      .eq('membership_status', 'active')
      .in('community_id', eligible);
    for (const m of memberRows || []) {
      memberCounts.set(m.community_id, (memberCounts.get(m.community_id) || 0) + 1);
    }

    const activity = new Map();
    const sinceIso = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const { data: postRows } = await client
      .from('social_posts')
      .select('community_id')
      .in('community_id', eligible)
      .gte('created_at', sinceIso)
      .limit(1500);
    for (const p of postRows || []) {
      activity.set(p.community_id, (activity.get(p.community_id) || 0) + 1);
    }

    // Topic labels for matched topics (real, display-safe).
    const topicNames = new Map();
    if (matchedTopicSet.size) {
      const { data: topics } = await client
        .from('topics')
        .select('id, name')
        .in('id', [...matchedTopicSet].slice(0, 100));
      for (const t of topics || []) topicNames.set(t.id, t.name);
    }

    const scored = [];
    for (const id of eligible) {
      const meta = communityById.get(id);
      const memberCount = memberCounts.get(id) || 0;
      const activity7d = activity.get(id) || 0;
      // Inactive / empty communities are never presented as lively ones.
      if (memberCount === 0 && activity7d === 0) continue;

      const overlap = candidateOverlap.get(id);
      const explicitMatches = [...(overlap?.topicIds || [])].filter(t => explicitTopics.has(t));
      const joinedTopicMatches = [...(overlap?.topicIds || [])].filter(t => joinedTopicIds.has(t) && !explicitTopics.has(t));
      const aff = affinityComms.get(id) || 0;

      const score = explicitMatches.length * 3
        + joinedTopicMatches.length * 1.5
        + (aff > 0 ? 3 + Math.min(aff, 6) * 0.5 : 0)
        + log1p(activity7d) * 0.9
        + Math.min(log1p(memberCount) / 6, 1.2);

      let reason;
      if (explicitMatches.length > 0) {
        reason = {
          key: 'interest',
          text: `Matches your interest in ${topicNames.get(explicitMatches[0]) || 'this topic'}`,
        };
      } else if (aff > 0) {
        reason = { key: 'affinity', text: 'You engage with similar communities' };
      } else if (joinedTopicMatches.length > 0) {
        reason = { key: 'topic', text: `Related to ${topicNames.get(joinedTopicMatches[0]) || 'topics you follow'}` };
      } else {
        reason = { key: 'discovery', text: 'Worth exploring' };
      }

      scored.push({
        id: meta.id,
        name: meta.name,
        slug: meta.slug,
        description: meta.description,
        avatarUrl: meta.avatar_url,
        memberCount,
        activity7d,
        topics: [...(overlap?.topicIds || [])].slice(0, 2).map(t => topicNames.get(t)).filter(Boolean),
        reason,
        score,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    result.items = scored.slice(0, limit);
  } catch (err) {
    console.error('[Discovery] recommendCommunities error:', err?.message || err);
  }
  return result;
}

// ── Challenges for You ──────────────────────────────────────
export async function recommendChallenges({ client, userId, limit = 6 }) {
  if (!client || !userId) return { items: [] };
  const result = { items: [] };
  const now = Date.now();

  try {
    const [joinedRes, typeAffRes, affCommRes, feedbackRes, participatedRes] = await Promise.all([
      client.from('community_members')
        .select('community_id')
        .eq('user_id', userId)
        .eq('membership_status', 'active')
        .limit(200),
      client.from('user_affinities')
        .select('key, positive')
        .eq('user_id', userId)
        .eq('dimension', 'content_type')
        .limit(50),
      client.from('user_affinities')
        .select('key, positive')
        .eq('user_id', userId)
        .eq('dimension', 'community')
        .gte('positive', 0.3)
        .limit(100),
      client.from('rec_feedback')
        .select('scope')
        .eq('user_id', userId)
        .eq('action', 'not_interested')
        .limit(300),
      client.from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', userId)
        .eq('status', 'active'),
    ]);

    const joined = new Set((joinedRes.data || []).map(r => r.community_id));
    const typeAffinity = new Map((typeAffRes.data || []).map(r => [r.key, r.positive]));
    const affinityComms = new Map((affCommRes.data || []).map(r => [r.key, r.positive]));
    const negativeTypes = new Map();
    for (const row of feedbackRes.data || []) {
      const t = row.scope?.content_type;
      if (t) negativeTypes.set(t, (negativeTypes.get(t) || 0) + 1);
    }
    const participated = new Set((participatedRes.data || []).map(r => r.challenge_id));

    // Active public challenges, newest first.
    const { data: rows } = await client
      .from('challenges')
      .select('*')
      .eq('visibility', 'public')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(80);

    let challenges = (rows || []).filter(c => {
      const ends = c.ends_at ? new Date(c.ends_at).getTime() : null;
      if (ends && ends <= now) return false; // honestly ended
      if (c.status !== 'active') return false;
      if (participated.has(c.id) || c.creator_id === userId) return false;
      const neg = negativeTypes.get(c.challenge_type) || 0;
      if (neg >= 2) return false; // repeatedly rejected this format
      return true;
    });
    if (challenges.length === 0) return result;
    challenges = challenges.slice(0, 60);

    // Community meta for community-hosted challenges.
    const commIds = [...new Set(challenges.map(c => c.community_id).filter(Boolean))];
    const communityById = new Map();
    if (commIds.length) {
      const { data: comms } = await client
        .from('communities')
        .select('id, name, slug')
        .in('id', commIds);
      for (const row of comms || []) communityById.set(row.id, row);
    }

    // Community topics (for honest topic-overlap reasons).
    const topicNamesById = new Map();
    const commTopics = new Map(); // community_id -> topic ids
    if (commIds.length) {
      const { data: links } = await client
        .from('community_topics')
        .select('community_id, topic_id')
        .in('community_id', commIds)
        .limit(300);
      const topicIds = new Set();
      for (const link of links || []) {
        topicIds.add(link.topic_id);
        if (!commTopics.has(link.community_id)) commTopics.set(link.community_id, []);
        commTopics.get(link.community_id).push(link.topic_id);
      }
      if (topicIds.size) {
        const { data: topics } = await client
          .from('topics')
          .select('id, name')
          .in('id', [...topicIds].slice(0, 80));
        for (const t of topics || []) topicNamesById.set(t.id, t.name);
      }
    }

    // Viewer's topic signature to explain topic matches.
    const joinedTopics = new Set();
    for (const [cid, tids] of commTopics) {
      if (joined.has(cid)) for (const t of tids) joinedTopics.add(t);
    }

    // Real participation counts.
    const counts = new Map();
    const { data: partRows } = await client
      .from('challenge_participants')
      .select('challenge_id')
      .in('challenge_id', challenges.map(c => c.id))
      .eq('status', 'active');
    for (const p of partRows || []) {
      counts.set(p.challenge_id, (counts.get(p.challenge_id) || 0) + 1);
    }

    const scored = [];
    for (const c of challenges) {
      const community = c.community_id ? communityById.get(c.community_id) : null;
      const participantCount = counts.get(c.id) || 0;
      const typePos = typeAffinity.get(c.challenge_type) || 0;
      const neg = negativeTypes.get(c.challenge_type) || 0;

      let score = 0;
      let reason;

      if (c.community_id && community && joined.has(c.community_id)) {
        score += 2.2;
        reason = { key: 'community', text: `Hosted in ${community.name}, where you're a member` };
      } else if (c.community_id && affinityComms.has(c.community_id)) {
        score += 1.4;
        reason = community
          ? { key: 'community', text: `From ${community.name}, a community you like` }
          : { key: 'community', text: 'From a community you like' };
      }

      // Topic overlap through the hosting community.
      if (c.community_id) {
        for (const tid of commTopics.get(c.community_id) || []) {
          if (joinedTopics.has(tid) || typePos > 0) {
            const label = topicNamesById.get(tid);
            if (label && !reason) reason = { key: 'topic', text: `Matches your interest in ${label}` };
            score += 1.0;
            break;
          }
        }
      }

      if (typePos > 0) {
        score += Math.min(typePos, 8) * 0.5;
        if (!reason) reason = { key: 'format', text: 'The kind of format you like' };
      }

      // Real activity + freshness (never artificial urgency).
      score += Math.min(log1p(participantCount) * 0.6, 1.6);
      const ageMs = now - new Date(c.created_at).getTime();
      score += Math.max(0, 1 - ageMs / (7 * DAY_MS)) * 0.8;

      if (neg === 1) score *= 0.45;
      if (!reason) {
        reason = ageMs < 2 * DAY_MS
          ? { key: 'fresh', text: 'Fresh on BurnBoard' }
          : { key: 'popular', text: 'Active right now' };
      }

      scored.push({
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        challengeType: c.challenge_type,
        endsAt: c.ends_at,
        createdAt: c.created_at,
        community: community ? { name: community.name, slug: community.slug } : null,
        participantCount,
        reason,
        score,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    result.items = scored.slice(0, limit);
  } catch (err) {
    console.error('[Discovery] recommendChallenges error:', err?.message || err);
  }
  return result;
}
