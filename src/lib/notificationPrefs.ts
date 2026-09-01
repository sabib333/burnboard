/**
 * Notification Preferences — Per-type toggle checks
 *
 * Caches user preferences in memory for fast lookups.
 * The queue calls shouldNotify() before enqueueing.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { NotificationType } from './notify';
import { loadSoundSettings, type SoundSettings } from './notificationSounds';

export interface NotificationPreferences {
  push_enabled: boolean;
  email_notifications: boolean;
  roast_alerts: boolean;
  follow_alerts: boolean;
  dm_alerts: boolean;
  upvote_alerts: boolean;
  levelup_alerts: boolean;
  battle_alerts: boolean;
  sounds: SoundSettings;
}

const DEFAULT_PREFS: NotificationPreferences = {
  push_enabled: true,
  email_notifications: true,
  roast_alerts: true,
  follow_alerts: true,
  dm_alerts: true,
  upvote_alerts: true,
  levelup_alerts: true,
  battle_alerts: true,
  sounds: loadSoundSettings('default'),
};

// In-memory cache: userId → prefs + timestamp
const prefsCache = new Map<string, { prefs: NotificationPreferences; ts: number }>();
const CACHE_TTL = 120_000; // 2 minutes

/**
 * Fetch user's notification preferences from Supabase (cached)
 */
export async function getUserPrefs(userId: string): Promise<NotificationPreferences> {
  // Check cache
  const cached = prefsCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.prefs;
  }

  if (!isSupabaseConfigured || !supabase) return DEFAULT_PREFS;

  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('push_enabled, email_notifications, roast_alerts, follow_alerts, dm_alerts, upvote_alerts, levelup_alerts, battle_alerts')
      .eq('id', userId)
      .maybeSingle();

    if (!data) return DEFAULT_PREFS;

    const prefs: NotificationPreferences = {
      push_enabled: data.push_enabled !== false,
      email_notifications: data.email_notifications !== false,
      roast_alerts: data.roast_alerts !== false,
      follow_alerts: data.follow_alerts !== false,
      dm_alerts: data.dm_alerts !== false,
      upvote_alerts: data.upvote_alerts !== false,
      levelup_alerts: data.levelup_alerts !== false,
      battle_alerts: data.battle_alerts !== false,
      sounds: loadSoundSettings(userId),
    };

    prefsCache.set(userId, { prefs, ts: Date.now() });
    return prefs;
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * Check if a notification type is enabled for a user
 */
export async function shouldNotify(userId: string, type: NotificationType): Promise<boolean> {
  const prefs = await getUserPrefs(userId);

  switch (type) {
    case 'roast': return prefs.roast_alerts;
    case 'follow': return prefs.follow_alerts;
    case 'dm': return prefs.dm_alerts;
    case 'upvote': return prefs.upvote_alerts;
    case 'levelup': return prefs.levelup_alerts;
    case 'battle': return prefs.battle_alerts;
    default: return true;
  }
}

/**
 * Invalidate cache for a user (call after saving preferences)
 */
export function invalidatePrefs(userId: string) {
  prefsCache.delete(userId);
}

/**
 * Invalidate all cached preferences
 */
export function invalidateAllPrefs() {
  prefsCache.clear();
}
