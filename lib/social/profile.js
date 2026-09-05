import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Social Profile Service
 * 
 * Helpers for managing user social profiles.
 * Works with the existing `user_profiles` table, extending it with social fields.
 */

/**
 * Get a user's social profile by username
 */
export async function getProfileByUsername(username) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('username', username)
    .single();

  if (error) return null;
  return data;
}

/**
 * Get a user's social profile by ID
 */
export async function getProfileById(userId) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data;
}

/**
 * Get the current user's profile
 */
export async function getCurrentProfile() {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return getProfileById(user.id);
}

/**
 * Update a user's social profile
 */
export async function updateProfile(userId, updates) {
  if (!isSupabaseConfigured || !supabase) return { error: 'Supabase not configured' };

  const allowedFields = ['display_name', 'bio', 'avatar_url', 'visibility'];
  const filtered = {};
  
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      filtered[key] = updates[key];
    }
  }

  if (Object.keys(filtered).length === 0) {
    return { error: 'No valid fields to update' };
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update(filtered)
    .eq('id', userId)
    .select()
    .single();

  return { data, error };
}

/**
 * Check if a username is available
 */
export async function isUsernameAvailable(username) {
  if (!isSupabaseConfigured || !supabase) return false;
  if (!username || username.length < 3) return false;

  const { data } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('username', username.toLowerCase())
    .single();

  return !data; // true if no existing user with this username
}

/**
 * Generate a suggested username from display name or email
 */
export function generateUsername(displayName, email) {
  const base = (displayName || email || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 15);
  
  return base || 'user';
}

/**
 * Get follower/following counts for a user
 */
export async function getFollowCounts(userId) {
  if (!isSupabaseConfigured || !supabase) {
    return { followers: 0, following: 0 };
  }

  const [followersResult, followingResult] = await Promise.all([
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);

  return {
    followers: followersResult.count || 0,
    following: followingResult.count || 0,
  };
}

/**
 * Check if user A follows user B
 */
export async function isFollowing(followerId, followingId) {
  if (!isSupabaseConfigured || !supabase) return false;

  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .single();

  return !!data;
}
