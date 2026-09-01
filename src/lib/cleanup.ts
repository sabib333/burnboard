// src/lib/cleanup.ts - Client side data cleanup & "Delete My Data" right-to-be-forgotten
import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Purge user created profiles, roasts, bookmarks, and subscriptions from localStorage and Supabase
 */
export async function deleteUserData(userProfileIds: string[] = []): Promise<{ success: boolean; error?: string }> {
  try {
    const keysToPurge = [
      'burnboard_user_profiles',
      'burnboard_user_roasts',
      'burnboard_user_reactions',
      'burnboard_user_upvotes',
      'burnboard_notification_subs',
      'burnboard_last_roast_timestamp',
      'burnboard_recent_roasts_cache',
      'burnboard_battles_voted',
      'burnboard_user_roast_count'
    ];

    keysToPurge.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch {}
    });

    if (isSupabaseConfigured && supabase && userProfileIds.length > 0) {
      await supabase
        .from('profiles')
        .delete()
        .in('id', userProfileIds);

      await supabase
        .from('roasts')
        .delete()
        .in('profile_id', userProfileIds);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to cleanup user data:', err);
    return { success: false, error: err?.message || 'Failed to delete' };
  }
}
