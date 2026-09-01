/**
 * BURNBOARD Advanced Rate Limiter
 *
 * Server-side rate limiting using Upstash Redis (free tier: 10k cmds/day).
 * Falls back to in-memory Map when Upstash is not configured.
 *
 * Limits:
 *   - Roast:    5 per 10 minutes
 *   - Follow:   20 per minute
 *   - Story:    10 per hour
 *   - DM:       30 per minute
 *   - Upvote:   60 per minute
 */

// ── IP Hashing ───────────────────────────────────────────────
const IP_SALT = (import.meta as any).env?.IP_HASH_SALT || 'burnboard_salt_2025';

export function hashIp(ip: string): string {
  // Simple SHA-256 hash for IP anonymization
  let hash = 0;
  const combined = ip + IP_SALT;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `ip_${Math.abs(hash).toString(36)}`;
}

// ── Rate Limit Configuration ─────────────────────────────────
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  roast:    { windowMs: 10 * 60 * 1000,  maxRequests: 5 },    // 5 per 10 min
  follow:   { windowMs: 60 * 1000,        maxRequests: 20 },   // 20 per min
  story:    { windowMs: 60 * 60 * 1000,   maxRequests: 10 },   // 10 per hour
  dm:       { windowMs: 60 * 1000,        maxRequests: 30 },   // 30 per min
  upvote:   { windowMs: 60 * 1000,        maxRequests: 60 },   // 60 per min
  reaction: { windowMs: 60 * 1000,        maxRequests: 30 },   // 30 per min
  battle:   { windowMs: 60 * 1000,        maxRequests: 20 },   // 20 per min
  submit:   { windowMs: 60 * 60 * 1000,   maxRequests: 10 },   // 10 per hour
};

// ── In-Memory Fallback Store ─────────────────────────────────
interface MemoryEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetAt < now) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

// ── Check Rate Limit ─────────────────────────────────────────
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
}

/**
 * Check if a request is allowed under the rate limit.
 * Uses Upstash Redis when configured, falls back to in-memory.
 */
export async function checkRateLimit(
  action: string,
  ipHash: string,
  userId?: string
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action];
  if (!config) {
    // Unknown action — allow but log
    return { allowed: true, remaining: 999, resetAt: 0, retryAfterMs: 0 };
  }

  const key = `ratelimit:${action}:${userId || ipHash}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Try Upstash Redis first
  const upstashUrl = (import.meta as any).env?.UPSTASH_REDIS_REST_URL;
  const upstashToken = (import.meta as any).env?.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      return await checkUpstash(key, config, now, windowStart);
    } catch (err) {
      console.warn('[RateLimit] Upstash failed, falling back to memory:', err);
    }
  }

  // Fallback: in-memory sliding window
  return checkMemory(key, config, now, windowStart);
}

// ── Upstash Redis Implementation ─────────────────────────────
async function checkUpstash(
  key: string,
  config: RateLimitConfig,
  now: number,
  windowStart: number
): Promise<RateLimitResult> {
  const upstashUrl = (import.meta as any).env?.UPSTASH_REDIS_REST_URL!;
  const upstashToken = (import.meta as any).env?.UPSTASH_REDIS_REST_TOKEN!;

  // Use sliding window with sorted sets
  const pipeline = [
    // Remove old entries
    `ZREMRANGEBYSCORE ${key} 0 ${windowStart}`,
    // Add current request
    `ZADD ${key} ${now} ${now}_${Math.random().toString(36).substring(2, 8)}`,
    // Count in window
    `ZCARD ${key}`,
    // Set TTL
    `EXPIRE ${key} ${Math.ceil(config.windowMs / 1000)}`,
  ];

  const response = await fetch(upstashUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${upstashToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pipeline.map(cmd => ({ cmd: cmd.split(' ')[0], args: cmd.split(' ').slice(1) }))),
  });

  if (!response.ok) throw new Error(`Upstash error: ${response.status}`);

  const results = await response.json();
  const count = results[2]?.result || 0;

  const remaining = Math.max(0, config.maxRequests - count);
  const resetAt = now + config.windowMs;
  const retryAfterMs = count >= config.maxRequests ? config.windowMs : 0;

  return {
    allowed: count < config.maxRequests,
    remaining,
    resetAt,
    retryAfterMs,
  };
}

// ── In-Memory Fallback ───────────────────────────────────────
function checkMemory(
  key: string,
  config: RateLimitConfig,
  now: number,
  _windowStart: number
): Promise<RateLimitResult> {
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    memoryStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return Promise.resolve({
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
      retryAfterMs: 0,
    });
  }

  entry.count++;

  const remaining = Math.max(0, config.maxRequests - entry.count);
  const retryAfterMs = entry.count >= config.maxRequests ? entry.resetAt - now : 0;

  return Promise.resolve({
    allowed: entry.count < config.maxRequests,
    remaining,
    resetAt: entry.resetAt,
    retryAfterMs,
  });
}

// ── Brute Force Protection (Login) ───────────────────────────
const LOGIN_FAILURES = new Map<string, { count: number; blockedUntil: number }>();
const MAX_LOGIN_FAILURES = 5;
const LOGIN_BLOCK_MS = 15 * 60 * 1000; // 15 minutes

export function checkLoginBruteForce(ipHash: string): { blocked: boolean; retryAfterMs: number } {
  const entry = LOGIN_FAILURES.get(ipHash);
  const now = Date.now();

  if (entry && entry.blockedUntil > now) {
    return { blocked: true, retryAfterMs: entry.blockedUntil - now };
  }

  return { blocked: false, retryAfterMs: 0 };
}

export function recordLoginFailure(ipHash: string): { blocked: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = LOGIN_FAILURES.get(ipHash);

  if (!entry || entry.blockedUntil < now) {
    LOGIN_FAILURES.set(ipHash, { count: 1, blockedUntil: 0 });
    return { blocked: false, retryAfterMs: 0 };
  }

  entry.count++;

  if (entry.count >= MAX_LOGIN_FAILURES) {
    entry.blockedUntil = now + LOGIN_BLOCK_MS;
    return { blocked: true, retryAfterMs: LOGIN_BLOCK_MS };
  }

  return { blocked: false, retryAfterMs: 0 };
}

export function recordLoginSuccess(ipHash: string): void {
  LOGIN_FAILURES.delete(ipHash);
}

// ── Legacy API: checkDuplicate + setCooldown (localStorage) ──

const DUPLICATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const COOLDOWN_KEY = 'burnboard_rate_cooldowns';

/**
 * Check if a roast text is a duplicate within the last hour.
 * Records the text if not a duplicate.
 */
export function checkDuplicate(text: string, profileId: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const key = 'burnboard_duplicates';
    const raw = localStorage.getItem(key);
    const list: Array<{ text: string; profileId: string; time: number }> = raw ? JSON.parse(raw) : [];

    const now = Date.now();
    const cutoff = now - DUPLICATE_WINDOW_MS;

    // Filter old entries
    const recent = list.filter(e => e.time > cutoff);

    // Check for duplicate
    const normalized = text.trim().toLowerCase();
    const isDuplicate = recent.some(
      e => e.profileId === profileId && e.text.toLowerCase() === normalized
    );

    if (!isDuplicate) {
      // Record this roast
      recent.push({ text: text.trim(), profileId, time: now });
      localStorage.setItem(key, JSON.stringify(recent.slice(-100)));
    }

    return isDuplicate;
  } catch {
    return false;
  }
}

/**
 * Set a cooldown for an action (client-side).
 */
export function setCooldown(action: string, durationMs: number): void {
  if (typeof window === 'undefined') return;

  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    const cooldowns: Record<string, number> = raw ? JSON.parse(raw) : {};
    cooldowns[action] = Date.now() + durationMs;
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify(cooldowns));
  } catch {}
}

/**
 * Check if an action is on cooldown.
 */
export function isOnCooldown(action: string): { onCooldown: boolean; remainingMs: number } {
  if (typeof window === 'undefined') return { onCooldown: false, remainingMs: 0 };

  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    const cooldowns: Record<string, number> = raw ? JSON.parse(raw) : {};
    const expiresAt = cooldowns[action] || 0;
    const now = Date.now();

    if (expiresAt > now) {
      return { onCooldown: true, remainingMs: expiresAt - now };
    }
    return { onCooldown: false, remainingMs: 0 };
  } catch {
    return { onCooldown: false, remainingMs: 0 };
  }
}

/**
 * Legacy checkRateLimit (client-side, no server).
 * Returns { allowed, reason } for backward compat with RoastInput.
 */
export function checkRateLimitClient(action: string): { allowed: boolean; reason?: string } {
  const { onCooldown, remainingMs } = isOnCooldown(action);
  if (onCooldown) {
    const seconds = Math.ceil(remainingMs / 1000);
    return {
      allowed: false,
      reason: `Whoa, sharpen your knife first — wait ${seconds}s`,
    };
  }
  return { allowed: true };
}

/**
 * Get all rate limits (for admin view).
 */
export function getAllRateLimits(): Record<string, { windowMs: number; maxRequests: number; currentUsage: number }> {
  const result: Record<string, { windowMs: number; maxRequests: number; currentUsage: number }> = {};

  for (const [action, config] of Object.entries(RATE_LIMITS)) {
    const key = `ratelimit:${action}:client`;
    const entry = memoryStore.get(key);
    result[action] = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      currentUsage: entry?.count || 0,
    };
  }

  return result;
}

// ── Get Client IP ────────────────────────────────────────────
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return '127.0.0.1';
}

// ── Middleware Helper ─────────────────────────────────────────
export async function rateLimitMiddleware(
  request: Request,
  action: string
): Promise<{ allowed: boolean; response?: Response }> {
  const ip = getClientIp(request);
  const ipHash = hashIp(ip);

  const result = await checkRateLimit(action, ipHash);

  if (!result.allowed) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many ${action} requests. Try again in ${Math.ceil(result.retryAfterMs / 1000)}s.`,
          retryAfterMs: result.retryAfterMs,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)),
            'X-RateLimit-Remaining': String(result.remaining),
            'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
          },
        }
      ),
    };
  }

  return { allowed: true };
}
