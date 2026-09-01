// lib/rateLimit.js - Rate limiting & anti-spam defense
import { supabase, isSupabaseConfigured } from './supabase';

const RATE_LIMIT_SECONDS = 30;
const STORAGE_KEY_LAST_ROAST = 'burnboard_last_roast_timestamp';
const STORAGE_KEY_RECENT_ROASTS = 'burnboard_recent_roasts_cache';

export function canRoast(profileId, roastText, existingRoasts = []) {
  try {
    if (typeof window === 'undefined') return { allowed: true };
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
          reason: `Whoa, sharpen your knife first - wait 30s`
        };
      }
    }

    // Duplicate check in existing roasts in last 1 hour
    if (profileId && roastText) {
      const normalizedNew = roastText.trim().toLowerCase();
      const oneHourAgo = now - 60 * 60 * 1000;

      if (existingRoasts && existingRoasts.length > 0) {
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
          const recentList = JSON.parse(recentRaw);
          const duplicate = recentList.find(
            r => r.profileId === profileId && r.time > oneHourAgo && r.text.toLowerCase() === normalizedNew
          );
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

export function recordRoastSuccess(profileId, roastText) {
  try {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY_LAST_ROAST, now.toString());

    const recentRaw = localStorage.getItem(STORAGE_KEY_RECENT_ROASTS);
    let recentList = [];
    if (recentRaw) {
      try {
        recentList = JSON.parse(recentRaw);
      } catch {}
    }

    const oneHourAgo = now - 60 * 60 * 1000;
    recentList = recentList.filter(r => r.time > oneHourAgo);
    recentList.unshift({ profileId, text: roastText.trim(), time: now });
    localStorage.setItem(STORAGE_KEY_RECENT_ROASTS, JSON.stringify(recentList.slice(0, 50)));
  } catch {}
}
