/**
 * BURN BOARD — In-Memory Cache
 * 
 * Lightweight TTL-based cache for serverless environments.
 * Works in Vercel serverless functions (each instance has own memory).
 * 
 * Strategy:
 * - Short-lived cache for expensive queries (trending, leaderboard)
 * - Stale-while-revalidate pattern
 * - Automatic expiration
 * - No persistent state (safe for serverless)
 * 
 * NOT suitable for:
 * - Authentication state
 * - Permission-sensitive content
 * - Fresh mutation results
 */

// ── Cache Store ──────────────────────────────────────────────
const store = new Map();

// ── Default TTLs (in seconds) ───────────────────────────────
export const CACHE_TTL = {
  // Highly cacheable (longer TTL)
  HOT_SEAT: 30,           // Hot seat detail (30s)
  PROFILE_LIST: 60,       // Profile list (60s)
  
  // Short-lived cache (refresh often)
  TRENDING: 15,           // Trending data (15s) - changes frequently
  LEADERBOARD: 30,        // Leaderboard (30s)
  BATTLES: 15,            // Active battles (15s)
  WEEKLY_RECAP: 60,       // Weekly recap (60s)
  
  // Static-ish data (longer cache)
  BURN_REPORT: 120,       // Burn report (2min)
  EXPERIMENT_CONFIG: 60,  // Experiment config (1min)
  
  // Do not cache
  AUTH: 0,                // Never cache auth state
  MUTATIONS: 0,           // Never cache mutations
};

// ── Core Cache Operations ────────────────────────────────────

/**
 * Get a cached value by key.
 * Returns null if expired or missing.
 */
export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  
  const now = Date.now();
  if (now > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  
  // Update access time for LRU-like behavior
  entry.lastAccess = now;
  return entry.value;
}

/**
 * Set a cached value with TTL.
 * @param {string} key - Cache key
 * @param {*} value - Value to cache
 * @param {number} ttlSeconds - Time to live in seconds (0 = no cache)
 */
export function cacheSet(key, value, ttlSeconds) {
  if (!ttlSeconds || ttlSeconds <= 0) return;
  
  const now = Date.now();
  store.set(key, {
    value,
    expiresAt: now + (ttlSeconds * 1000),
    lastAccess: now,
    createdAt: now,
  });
  
  // Periodic cleanup: if store gets too large, evict oldest
  if (store.size > 500) {
    evictOldest(100);
  }
}

/**
 * Delete a cached value.
 */
export function cacheDelete(key) {
  store.delete(key);
}

/**
 * Delete all keys matching a prefix.
 */
export function cacheDeletePrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/**
 * Clear all cached data.
 */
export function cacheClear() {
  store.clear();
}

// ── Cache-aside Pattern (Get-or-Compute) ─────────────────────

/**
 * Get cached value or compute and cache it.
 * @param {string} key - Cache key
 * @param {Function} compute - Async function to compute value
 * @param {number} ttlSeconds - TTL in seconds
 * @returns {Promise<*>} Cached or computed value
 */
export async function cacheAside(key, compute, ttlSeconds) {
  const cached = cacheGet(key);
  if (cached !== null) {
    return cached;
  }
  
  const value = await compute();
  cacheSet(key, value, ttlSeconds);
  return value;
}

// ── Stale-While-Revalidate ───────────────────────────────────

/**
 * Get cached value, return immediately if available.
 * If expired, trigger background revalidation.
 * @param {string} key - Cache key
 * @param {Function} compute - Async function to compute value
 * @param {number} ttlSeconds - TTL in seconds
 * @param {number} staleSeconds - How long to serve stale after TTL (default: 2x TTL)
 * @returns {Promise<*>} Cached value (may be stale)
 */
export async function cacheStaleWhileRevalidate(key, compute, ttlSeconds, staleSeconds) {
  const staleTtl = staleSeconds || ttlSeconds * 2;
  const entry = store.get(key);
  const now = Date.now();
  
  // Return fresh cached value
  if (entry && now <= entry.expiresAt) {
    return entry.value;
  }
  
  // Return stale value and trigger background revalidation
  if (entry && now <= entry.expiresAt + (staleTtl * 1000)) {
    // Background revalidation (fire-and-forget)
    compute()
      .then(value => cacheSet(key, value, ttlSeconds))
      .catch(() => {}); // Silent fail
    return entry.value;
  }
  
  // No cache or fully expired - compute synchronously
  const value = await compute();
  cacheSet(key, value, ttlSeconds);
  return value;
}

// ── Cleanup ──────────────────────────────────────────────────

function evictOldest(count) {
  const entries = Array.from(store.entries())
    .sort((a, b) => a[1].lastAccess - b[1].lastAccess);
  
  const toDelete = entries.slice(0, count);
  for (const [key] of toDelete) {
    store.delete(key);
  }
}

// ── Cleanup expired entries periodically ─────────────────────
// Runs every 5 minutes (in long-lived instances)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.expiresAt) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

// ── Stats (for observability) ────────────────────────────────

export function getCacheStats() {
  let fresh = 0;
  let expired = 0;
  const now = Date.now();
  
  for (const entry of store.values()) {
    if (now <= entry.expiresAt) fresh++;
    else expired++;
  }
  
  return {
    size: store.size,
    fresh,
    expired,
  };
}
