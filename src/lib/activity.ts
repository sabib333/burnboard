/**
 * Activity Tracking - Updates user's last_active timestamp
 * Used for "Active now" indicators in DM and profiles
 */

import { supabase, isSupabaseConfigured } from './supabase';

let lastUpdate = 0;
const UPDATE_INTERVAL = 60_000; // Only update once per minute max

/**
 * Update the current user's last_active timestamp.
 * Throttled to avoid excessive DB writes.
 */
export async function updateActivity(userId?: string): Promise<void> {
  if (!userId || !isSupabaseConfigured || !supabase) return;

  const now = Date.now();
  if (now - lastUpdate < UPDATE_INTERVAL) return;
  lastUpdate = now;

  try {
    await supabase
      .from('user_profiles')
      .update({ last_active: new Date().toISOString() })
      .eq('id', userId);
  } catch {
    // Silently fail — activity tracking is non-critical
  }
}

/**
 * Check if a user is currently active (last_active within 5 minutes)
 */
export function isUserActive(lastActive: string | null): boolean {
  if (!lastActive) return false;
  return new Date(lastActive).getTime() > Date.now() - 5 * 60 * 1000;
}

/**
 * Format last_active as human-readable time
 */
export function formatLastActive(lastActive: string | null): string {
  if (!lastActive) return 'Offline';
  const diff = Date.now() - new Date(lastActive).getTime();
  if (diff < 5 * 60 * 1000) return 'Active now';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
