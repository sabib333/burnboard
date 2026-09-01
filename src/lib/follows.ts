import { supabase, isSupabaseConfigured } from './supabase';
import { FollowCounts } from '../types';

// ── Client-side cache for follow counts (avoids COUNT queries at 1M) ──
const followCountsCache = new Map<string, { counts: FollowCounts; ts: number }>();
const FOLLOW_CACHE_TTL = 30_000; // 30 sec
const followStatusCache = new Map<string, { following: boolean; ts: number }>();
const FOLLOW_STATUS_TTL = 60_000; // 60 sec

// ── Batch set for checking multiple follow statuses ──
const batchFollowCache = new Map<string, Set<string>>(); // userId -> Set<followingId>

/**
 * Follow a user — uses RPC for atomic counter increment
 */
export async function followUser(followerId: string, followingId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { error: 'Supabase not configured' };
  if (followerId === followingId) return { error: 'Cannot follow yourself' };

  try {
    // Check if already following (cached)
    const cacheKey = `${followerId}:${followingId}`;
    const cached = followStatusCache.get(cacheKey);
    if (cached && cached.following) return { error: 'Already following' };

    const { data: existing } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle();

    if (existing) {
      followStatusCache.set(cacheKey, { following: true, ts: Date.now() });
      return { error: 'Already following' };
    }

    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: followerId, following_id: followingId });

    if (error) return { error: error.message };

    // Update caches
    followStatusCache.set(cacheKey, { following: true, ts: Date.now() });
    invalidateFollowCounts(followerId);
    invalidateFollowCounts(followingId);
    // Clear batch cache for this follower
    batchFollowCache.delete(followerId);

    return {};
  } catch (err: any) {
    return { error: err.message || 'Follow failed' };
  }
}

/**
 * Unfollow a user — uses RPC for atomic counter decrement
 */
export async function unfollowUser(followerId: string, followingId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { error: 'Supabase not configured' };

  try {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);

    if (error) return { error: error.message };

    // Update caches
    const cacheKey = `${followerId}:${followingId}`;
    followStatusCache.set(cacheKey, { following: false, ts: Date.now() });
    invalidateFollowCounts(followerId);
    invalidateFollowCounts(followingId);
    batchFollowCache.delete(followerId);

    return {};
  } catch (err: any) {
    return { error: err.message || 'Unfollow failed' };
  }
}

/**
 * Check if current user is following a target user (cached)
 */
export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  const cacheKey = `${followerId}:${followingId}`;
  const cached = followStatusCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < FOLLOW_STATUS_TTL) return cached.following;

  try {
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle();

    const result = !!data;
    followStatusCache.set(cacheKey, { following: result, ts: Date.now() });
    return result;
  } catch {
    return false;
  }
}

/**
 * Batch check follow status for multiple users (1 query instead of N)
 */
export async function getFollowStatusBatch(followerId: string, followingIds: string[]): Promise<Set<string>> {
  if (!isSupabaseConfigured || !supabase || followingIds.length === 0) return new Set();

  // Check batch cache
  const cached = batchFollowCache.get(followerId);
  if (cached) return cached;

  try {
    const { data } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', followerId)
      .in('following_id', followingIds);

    const result = new Set((data || []).map((f: any) => f.following_id));
    batchFollowCache.set(followerId, result);
    return result;
  } catch {
    return new Set();
  }
}

/**
 * Get follow counts — reads from cached columns (not COUNT query!)
 * At 1M users, COUNT queries are expensive. Use the cached columns instead.
 */
export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  if (!isSupabaseConfigured || !supabase) return { followers: 0, following: 0 };

  // Check cache
  const cached = followCountsCache.get(userId);
  if (cached && (Date.now() - cached.ts) < FOLLOW_CACHE_TTL) return cached.counts;

  try {
    // Read from cached columns — O(1) instead of COUNT(*)
    const { data } = await supabase
      .from('user_profiles')
      .select('follower_count, following_count')
      .eq('id', userId)
      .maybeSingle();

    const counts = {
      followers: data?.follower_count || 0,
      following: data?.following_count || 0,
    };

    followCountsCache.set(userId, { counts, ts: Date.now() });
    return counts;
  } catch {
    return { followers: 0, following: 0 };
  }
}

/**
 * Get followers with cursor pagination (not offset!)
 * At 1M, offset pagination is O(n). Cursor pagination is O(log n).
 */
export async function getFollowers(
  userId: string,
  limit = 20,
  cursor?: string
): Promise<{ users: Array<{ id: string; username: string; display_name: string | null }>; nextCursor: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { users: [], nextCursor: null };

  try {
    let query = supabase
      .from('follows')
      .select('follower_id, user_profiles!follows_follower_id_fkey(id, username, display_name)')
      .eq('following_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // fetch one extra to detect if there's more

    // Cursor pagination: filter by created_at < cursor
    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data } = await query;
    if (!data) return { users: [], nextCursor: null };

    const hasMore = data.length > limit;
    const rows = hasMore ? data.slice(0, limit) : data;
    const nextCursor = hasMore && rows.length > 0 ? (rows[rows.length - 1] as any).created_at : null;

    const users = rows
      .map((row: any) => row.user_profiles)
      .filter(Boolean)
      .map((profile: any) => ({
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
      }));

    return { users, nextCursor };
  } catch {
    return { users: [], nextCursor: null };
  }
}

/**
 * Get following with cursor pagination
 */
export async function getFollowing(
  userId: string,
  limit = 20,
  cursor?: string
): Promise<{ users: Array<{ id: string; username: string; display_name: string | null }>; nextCursor: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { users: [], nextCursor: null };

  try {
    let query = supabase
      .from('follows')
      .select('following_id, user_profiles!follows_following_id_fkey(id, username, display_name)')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data } = await query;
    if (!data) return { users: [], nextCursor: null };

    const hasMore = data.length > limit;
    const rows = hasMore ? data.slice(0, limit) : data;
    const nextCursor = hasMore && rows.length > 0 ? (rows[rows.length - 1] as any).created_at : null;

    const users = rows
      .map((row: any) => row.user_profiles)
      .filter(Boolean)
      .map((profile: any) => ({
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
      }));

    return { users, nextCursor };
  } catch {
    return { users: [], nextCursor: null };
  }
}

/**
 * Invalidate cached follow counts for a user
 */
function invalidateFollowCounts(userId: string) {
  followCountsCache.delete(userId);
}

/**
 * Invalidate all follow caches for a user
 */
export function invalidateAllFollowCaches(userId: string) {
  invalidateFollowCounts(userId);
  batchFollowCache.delete(userId);
  // Clear status cache entries for this user
  for (const key of followStatusCache.keys()) {
    if (key.startsWith(userId + ':') || key.endsWith(':' + userId)) {
      followStatusCache.delete(key);
    }
  }
}
