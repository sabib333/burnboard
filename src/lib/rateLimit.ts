/**
 * BURNBOARD Rate Limiting & Anti-Spam Shield
 * Free & ultra-fast client + server defense against spam bots & flooders.
 */

const RATE_LIMIT_SECONDS = 30;
const STORAGE_KEY_LAST_ROAST = 'burnboard_last_roast_timestamp';
const STORAGE_KEY_RECENT_ROASTS = 'burnboard_recent_roasts_cache';

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  waitSeconds?: number;
}

/**
 * Check if the user is allowed to submit a new roast.
 * 1. 30-second cooldown per client
 * 2. Duplicate roast check in last 1 hour
 */
export function canRoast(profileId?: string, roastText?: string, existingRoasts?: Array<{ profile_id: string; roast_text: string; created_at: string }>): RateLimitResult {
  try {
    const now = Date.now();
    const lastRoastTimeStr = localStorage.getItem(STORAGE_KEY_LAST_ROAST);
    
    if (lastRoastTimeStr) {
      const lastRoastTime = parseInt(lastRoastTimeStr, 10);
      const elapsedSeconds = Math.floor((now - lastRoastTime) / 1000);
      
      if (elapsedSeconds < RATE_LIMIT_SECONDS) {
        const wait = RATE_LIMIT_SECONDS - elapsedSeconds;
        return {
          allowed: false,
          waitSeconds: wait,
          reason: `Whoa, sharpen your knife first - wait ${wait}s`
        };
      }
    }

    // Duplicate check in existing roasts or recent local roasts
    if (profileId && roastText) {
      const normalizedNew = roastText.trim().toLowerCase();
      
      // Check existing roasts from memory/props (within last 1 hour)
      if (existingRoasts && existingRoasts.length > 0) {
        const oneHourAgo = now - 60 * 60 * 1000;
        const duplicate = existingRoasts.find(r => {
          if (r.profile_id !== profileId) return false;
          const roastTime = new Date(r.created_at).getTime();
          if (roastTime < oneHourAgo) return false;
          return r.roast_text.trim().toLowerCase() === normalizedNew;
        });

        if (duplicate) {
          return {
            allowed: false,
            reason: 'Already roasted, be more creative'
          };
        }
      }

      // Check local cache
      const recentRaw = localStorage.getItem(STORAGE_KEY_RECENT_ROASTS);
      if (recentRaw) {
        try {
          const recentList: Array<{ profileId: string; text: string; time: number }> = JSON.parse(recentRaw);
          const oneHourAgo = now - 60 * 60 * 1000;
          const duplicate = recentList.find(r => r.profileId === profileId && r.time > oneHourAgo && r.text.toLowerCase() === normalizedNew);
          if (duplicate) {
            return {
              allowed: false,
              reason: 'Already roasted, be more creative'
            };
          }
        } catch {}
      }
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

/**
 * Record a successful roast to enforce the 30s cooldown and 1hr duplicate prevention.
 */
export function recordRoastSuccess(profileId: string, roastText: string) {
  try {
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY_LAST_ROAST, now.toString());

    // Record in local cache for duplicate checking
    const recentRaw = localStorage.getItem(STORAGE_KEY_RECENT_ROASTS);
    let recentList: Array<{ profileId: string; text: string; time: number }> = [];
    if (recentRaw) {
      try {
        recentList = JSON.parse(recentRaw);
      } catch {}
    }

    // Keep last 50
    const oneHourAgo = now - 60 * 60 * 1000;
    recentList = recentList.filter(r => r.time > oneHourAgo);
    recentList.unshift({ profileId, text: roastText.trim(), time: now });
    localStorage.setItem(STORAGE_KEY_RECENT_ROASTS, JSON.stringify(recentList.slice(0, 50)));
  } catch {}
}
