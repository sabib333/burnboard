/**
 * BURNBOARD Redis Cache Layer
 *
 * Uses Upstash Redis (free tier: 10k cmds/day) for caching heavy queries.
 * Falls back to in-memory Map when Redis is not configured.
 *
 * Cache keys:
 *   feed:${userId}:${page}     — TTL 120s
 *   trending:roasts            — TTL 60s
 *   leaderboard:alltime        — TTL 300s
 *   profile:${username}        — TTL 60s
 *   stories:active             — TTL 30s
 *   dailywinner                — TTL 60s
 */

import { supabase, isSupabaseConfigured } from './supabase';

// ── In-Memory Fallback ───────────────────────────────────────
interface CacheEntry {
  value: any;
  expiresAt: number;
}

const memCache = new Map<string, CacheEntry>();

// Cleanup expired entries every 2 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memCache.entries()) {
      if (entry.expiresAt < now) memCache.delete(key);
    }
  }, 2 * 60 * 1000);
}

// ── Redis Client ─────────────────────────────────────────────
let redisClient: any = null;

function getRedis() {
  if (redisClient) return redisClient;

  const url = (import.meta as any).env?.UPSTASH_REDIS_REST_URL;
  const token = (import.meta as any).env?.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      // Dynamic import to avoid bundling issues
      // @upstash/redis is a lightweight HTTP client
      redisClient = {
        url,
        token,
        async get(key: string): Promise<any> {
          const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return null;
          const data = await res.json();
          return data.result ? JSON.parse(data.result) : null;
        },
        async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
          const payload = JSON.stringify(value);
          const cmd = ttlSeconds
            ? `/set/${encodeURIComponent(key)}/${encodeURIComponent(payload)}/EX/${ttlSeconds}`
            : `/set/${encodeURIComponent(key)}/${encodeURIComponent(payload)}`;
          await fetch(`${url}${cmd}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        },
        async del(key: string): Promise<void> {
          await fetch(`${url}/del/${encodeURIComponent(key)}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        },
      };
    } catch (err) {
      console.warn('[Redis] Init failed, using memory cache:', err);
      redisClient = null;
    }
  }

  return redisClient;
}

// ── Cache API ────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  // Try Redis first
  const redis = getRedis();
  if (redis) {
    try {
      const val = await redis.get(key);
      if (val !== null) return val as T;
    } catch {}
  }

  // Fallback to memory
  const entry = memCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.value as T;
  }

  return null;
}

export async function cacheSet(key: string, value: any, ttlSeconds: number = 120): Promise<void> {
  // Set in memory always
  memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });

  // Set in Redis if available
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, value, ttlSeconds);
    } catch {}
  }
}

export async function cacheDel(key: string): Promise<void> {
  memCache.delete(key);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch {}
  }
}

export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  // Invalidate memory cache entries matching pattern
  for (const key of memCache.keys()) {
    if (key.startsWith(pattern.replace('*', ''))) {
      memCache.delete(key);
    }
  }
}

// ── Cached Fetch Helpers ─────────────────────────────────────

export const CACHE_KEYS = {
  feed: (userId: string | null, page: number) => `feed:${userId || 'anon'}:${page}`,
  trending: () => 'trending:roasts',
  leaderboard: () => 'leaderboard:alltime',
  profile: (username: string) => `profile:${username}`,
  stories: () => 'stories:active',
  dailyWinner: () => 'dailywinner',
  topProfiles: () => 'top:profiles',
} as const;

export const CACHE_TTL = {
  feed: 120,       // 2 minutes
  trending: 60,    // 1 minute
  leaderboard: 300, // 5 minutes
  profile: 60,     // 1 minute
  stories: 30,     // 30 seconds
  dailyWinner: 60, // 1 minute
} as const;

/**
 * Cached fetch for trending roasts.
 */
export async function getCachedTrendingRoasts(): Promise<any[]> {
  const key = CACHE_KEYS.trending();
  const cached = await cacheGet<any[]>(key);
  if (cached) return cached;

  if (!isSupabaseConfigured || !supabase) return [];

  try {
    const { data, error } = await supabase
      .from('roasts')
      .select('id, roast_text, upvotes, created_at, profiles!inner(username, platform)')
      .eq('is_hidden', false)
      .order('upvotes', { ascending: false })
      .limit(3);

    if (error) throw error;
    const result = data || [];
    await cacheSet(key, result, CACHE_TTL.trending);
    return result;
  } catch {
    return [];
  }
}

/**
 * Cached fetch for leaderboard.
 */
export async function getCachedLeaderboard(): Promise<any[]> {
  const key = CACHE_KEYS.leaderboard();
  const cached = await cacheGet<any[]>(key);
  if (cached) return cached;

  if (!isSupabaseConfigured || !supabase) return [];

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_banned', false)
      .order('total_upvotes', { ascending: false })
      .limit(10);

    if (error) throw error;
    const result = data || [];
    await cacheSet(key, result, CACHE_TTL.leaderboard);
    return result;
  } catch {
    return [];
  }
}

/**
 * Cached fetch for profile by username.
 */
export async function getCachedProfile(username: string): Promise<any | null> {
  const key = CACHE_KEYS.profile(username);
  const cached = await cacheGet<any>(key);
  if (cached) return cached;

  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error) throw error;
    if (data) await cacheSet(key, data, CACHE_TTL.profile);
    return data;
  } catch {
    return null;
  }
}

/**
 * Cached fetch for active stories.
 */
export async function getCachedActiveStories(): Promise<any[]> {
  const key = CACHE_KEYS.stories();
  const cached = await cacheGet<any[]>(key);
  if (cached) return cached;

  if (!isSupabaseConfigured || !supabase) return [];

  try {
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    const result = data || [];
    await cacheSet(key, result, CACHE_TTL.stories);
    return result;
  } catch {
    return [];
  }
}
