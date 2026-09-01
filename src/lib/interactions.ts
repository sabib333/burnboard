/**
 * BURNBOARD Interaction Tracker
 *
 * Logs every real user interaction to Supabase (Instagram-style).
 * Used by feedAlgorithm.ts for personalized scoring.
 */

import { supabase, isSupabaseConfigured } from './supabase';

export type InteractionAction =
  | 'view'
  | 'roast'
  | 'upvote'
  | 'reaction'
  | 'follow'
  | 'unfollow'
  | 'dm'
  | 'share'
  | 'battle_vote';

/**
 * Get or create anonymous user ID for tracking.
 */
export function getAnonId(): string {
  if (typeof window === 'undefined') return 'server';
  let anonId = localStorage.getItem('burnboard_anon_id');
  if (!anonId) {
    anonId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    localStorage.setItem('burnboard_anon_id', anonId);
  }
  return anonId;
}

/**
 * Record a user interaction.
 * Fire-and-forget: never blocks UI, errors are silently logged.
 */
export async function recordInteraction(params: {
  userId?: string | null;
  targetProfileId: string;
  targetUserId?: string | null;
  action: InteractionAction;
  platform?: string;
}): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    const anonId = params.userId ? undefined : getAnonId();

    await supabase.from('user_interactions').insert({
      user_id: params.userId || null,
      anon_id: anonId || null,
      target_profile_id: params.targetProfileId,
      target_user_id: params.targetUserId || null,
      action: params.action,
      platform: params.platform || null,
    });
  } catch (err) {
    // Silent fail — interaction tracking should never block user experience
    console.debug('[InteractionTracker] Failed to record:', err);
  }
}

/**
 * Batch record multiple interactions (for feed view tracking).
 */
export async function recordViewBatch(
  userId: string | null,
  profileIds: Array<{ id: string; userId?: string; platform?: string }>
): Promise<void> {
  if (!isSupabaseConfigured || !supabase || profileIds.length === 0) return;

  try {
    const anonId = userId ? undefined : getAnonId();
    const rows = profileIds.map(p => ({
      user_id: userId || null,
      anon_id: anonId || null,
      target_profile_id: p.id,
      target_user_id: p.userId || null,
      action: 'view' as const,
      platform: p.platform || null,
    }));

    await supabase.from('user_interactions').insert(rows);
  } catch (err) {
    console.debug('[InteractionTracker] Batch view failed:', err);
  }
}

/**
 * Fetch recent interactions for a user to build signals.
 */
export async function fetchUserInteractions(
  userId: string | null,
  limit = 100
): Promise<any[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  try {
    const anonId = getAnonId();
    let query = supabase
      .from('user_interactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('anon_id', anonId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.debug('[InteractionTracker] Fetch failed:', err);
    return [];
  }
}

/**
 * Get anonymous interactions (for non-logged-in users).
 */
export async function fetchAnonInteractions(limit = 100): Promise<any[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  try {
    const anonId = getAnonId();
    const { data, error } = await supabase
      .from('user_interactions')
      .select('*')
      .eq('anon_id', anonId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.debug('[InteractionTracker] Anon fetch failed:', err);
    return [];
  }
}
