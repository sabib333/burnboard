import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Social Follows Service
 * 
 * Manages the follow/unfollow system using the existing `follows` table.
 */

/**
 * Follow a user
 */
export async function followUser(followerId, followingId) {
  if (!isSupabaseConfigured || !supabase) return { error: 'Not configured' };
  if (followerId === followingId) return { error: 'Cannot follow yourself' };

  const { data, error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'Already following' };
    return { error: error.message };
  }

  return { data };
}

/**
 * Unfollow a user
 */
export async function unfollowUser(followerId, followingId) {
  if (!isSupabaseConfigured || !supabase) return { error: 'Not configured' };

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);

  if (error) return { error: error.message };
  return { success: true };
}

/**
 * Toggle follow/unfollow
 */
export async function toggleFollow(followerId, followingId) {
  if (!isSupabaseConfigured || !supabase) return { error: 'Not configured' };

  const { data: existing } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .single();

  if (existing) {
    return unfollowUser(followerId, followingId);
  } else {
    return followUser(followerId, followingId);
  }
}

/**
 * Get followers list
 */
export async function getFollowers(userId, { limit = 20, offset = 0 } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('follows')
    .select('follower_id, user_profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, bio)')
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return [];
  return (data || []).map(f => f.user_profiles).filter(Boolean);
}

/**
 * Get following list
 */
export async function getFollowing(userId, { limit = 20, offset = 0 } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('follows')
    .select('following_id, user_profiles!follows_following_id_fkey(id, username, display_name, avatar_url, bio)')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return [];
  return (data || []).map(f => f.user_profiles).filter(Boolean);
}

/**
 * Check if user A follows user B
 */
export async function checkFollowStatus(followerId, followingId) {
  if (!isSupabaseConfigured || !supabase) return false;

  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .single();

  return !!data;
}

/**
 * Get mutual followers (who you follow that also follow you)
 */
export async function getMutualFollows(userId, { limit = 20 } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];

  // Get who the user follows
  const { data: following } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (!following || following.length === 0) return [];

  const followingIds = following.map(f => f.following_id);

  // Check which of those also follow the user back
  const { data: mutuals } = await supabase
    .from('follows')
    .select('follower_id, user_profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)')
    .eq('following_id', userId)
    .in('follower_id', followingIds)
    .limit(limit);

  if (!mutuals) return [];
  return mutuals.map(m => m.user_profiles).filter(Boolean);
}
