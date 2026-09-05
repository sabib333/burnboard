import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Social Feed Service
 * 
 * Feed generation and ranking for the social platform.
 * Currently wraps existing roast content with social feed semantics.
 * Future: Will support mixed content feeds (roasts, posts, polls, etc.)
 */

/**
 * Get the main social feed (paginated, cursor-based)
 */
export async function getMainFeed({ limit = 20, cursor = null } = {}) {
  if (!isSupabaseConfigured || !supabase) return { items: [], nextCursor: null };

  let query = supabase
    .from('roasts')
    .select(`
      *,
      profiles!inner(id, username, platform, avatar_letter, avatar_color, tagline, bio)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) return { items: [], nextCursor: null };

  const items = (data || []).map(roast => ({
    id: roast.id,
    type: 'roast',
    text: roast.roast_text,
    author: {
      id: roast.profiles.id,
      username: roast.profiles.username,
      platform: roast.profiles.platform,
      avatarLetter: roast.profiles.avatar_letter,
      avatarColor: roast.profiles.avatar_color,
      tagline: roast.profiles.tagline,
    },
    reactions: {
      funny: roast.reaction_haha || 0,
      savage: roast.reaction_brutal || 0,
      fatal: roast.reaction_cry || 0,
    },
    upvotes: roast.upvotes || 0,
    anonId: roast.anon_id,
    createdAt: roast.created_at,
  }));

  const nextCursor = items.length === limit ? items[items.length - 1].createdAt : null;

  return { items, nextCursor };
}

/**
 * Get trending content (engagement-sorted)
 */
export async function getTrendingFeed({ limit = 20, timeWindow = '24h' } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];

  let sinceDate = new Date();
  switch (timeWindow) {
    case '1h': sinceDate.setHours(sinceDate.getHours() - 1); break;
    case '24h': sinceDate.setDate(sinceDate.getDate() - 1); break;
    case '7d': sinceDate.setDate(sinceDate.getDate() - 7); break;
    default: sinceDate.setDate(sinceDate.getDate() - 1);
  }

  const { data, error } = await supabase
    .from('roasts')
    .select(`
      *,
      profiles!inner(username, platform, avatar_letter, avatar_color)
    `)
    .gte('created_at', sinceDate.toISOString())
    .order('upvotes', { ascending: false })
    .limit(limit);

  if (error) return [];

  return (data || []).map(roast => ({
    id: roast.id,
    type: 'roast',
    text: roast.roast_text,
    author: {
      username: roast.profiles.username,
      platform: roast.profiles.platform,
      avatarLetter: roast.profiles.avatar_letter,
      avatarColor: roast.profiles.avatar_color,
    },
    reactions: {
      funny: roast.reaction_haha || 0,
      savage: roast.reaction_brutal || 0,
      fatal: roast.reaction_cry || 0,
    },
    upvotes: roast.upvotes || 0,
    engagementScore:
      (roast.reaction_haha || 0) * 3 +
      (roast.reaction_brutal || 0) * 2 +
      (roast.reaction_cry || 0) * 4 +
      (roast.upvotes || 0) * 1,
    createdAt: roast.created_at,
  }));
}

/**
 * Get feed for a specific user's content
 */
export async function getUserFeed(userId, { limit = 20, cursor = null } = {}) {
  if (!isSupabaseConfigured || !supabase) return { items: [], nextCursor: null };

  let query = supabase
    .from('roasts')
    .select('*, profiles!inner(username, platform, avatar_letter, avatar_color)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) return { items: [], nextCursor: null };

  const items = (data || []).map(roast => ({
    id: roast.id,
    type: 'roast',
    text: roast.roast_text,
    reactions: {
      funny: roast.reaction_haha || 0,
      savage: roast.reaction_brutal || 0,
      fatal: roast.reaction_cry || 0,
    },
    upvotes: roast.upvotes || 0,
    createdAt: roast.created_at,
  }));

  const nextCursor = items.length === limit ? items[items.length - 1].createdAt : null;

  return { items, nextCursor };
}
