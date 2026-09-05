/**
 * BURNBOARD Developer Platform — Gateway (Master Prompt 20)
 *
 * The single door for third-party access. Third-party code NEVER talks to
 * domain routes directly; it goes through this gateway, which:
 *
 *   1. Validates the bearer access token (hashed at rest, revocable,
 *      expiring, scoped).
 *   2. Checks the required scope for the endpoint.
 *   3. Enforces per-app rate limits (sliding window, in-memory — same
 *      posture as the first-party serverRateLimit).
 *   4. Returns the acting subject (the BurnBoard user who consented) so
 *      downstream code can enforce blocking/privacy/moderation as if the
 *      action were the user's own.
 *
 * Everything degrades to an explicit 401/403/429 — never a silent bypass.
 */

// ── Scope catalog lives in ./scopes.js (client-safe, single source). ──
export { SCOPES, SCOPE_KEYS, scopeIsValid, scopeLabel, filterValidScopes } from './scopes';

// ── Token auth ──────────────────────────────────────────────
const cache = new Map(); // token -> { appId, subjectId, appName, scopes, at }

/**
 * Validate a bearer token through the RPC (cache briefly to keep DB reads
 * low on hot endpoints). Returns the acting grant or null.
 */
export async function authenticatePlatformRequest(client, req) {
  const authHeader = req?.headers?.get?.('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token || token.length < 16) return null;

  // Check cache first (short TTL, since revocations must propagate fast).
  const cached = cache.get(token);
  if (cached && Date.now() - cached.at < 15_000) {
    return { ...cached, token };
  }

  try {
    const { data, error } = await client.rpc('validate_access_token', { p_token: token });
    if (error || !data?.length) return null;
    const row = data[0];
    const session = {
      appId: row.app_id,
      subjectId: row.subject_id,
      appName: row.app_name,
      scopes: row.scopes || [],
      status: row.status || 'development',
      killSwitch: !!row.kill_switch,
      at: Date.now(),
    };
    cache.set(token, session);
    return { ...session, token };
  } catch {
    return null;
  }
}

/**
 * Check a required scope on an authenticated grant.
 */
export function hasScope(session, scope) {
  return !!session && (session.scopes || []).includes(scope);
}

// ── Per-app rate limiting ───────────────────────────────────
// Sliding-window in-memory store keyed by app id. Same limitation as the
// first-party rate limiter (per-instance in serverless); production would
// move this to a shared store, but the contract stays identical.
const usage = new Map(); // appId -> number[] (timestamps)

const DEFAULT_LIMITS = {
  // Requests per 60s per app.
  development: 30,
  approved: 120,
  limited: 30,
};

/**
 * Returns { ok, remaining, retryAfterSeconds } — never throws.
 */
export function checkAppRateLimit(appId, status = 'approved', now = Date.now()) {
  const limit = DEFAULT_LIMITS[status] || DEFAULT_LIMITS.approved;
  const windowMs = 60_000;

  let hits = usage.get(appId);
  if (!hits) {
    hits = [];
    usage.set(appId, hits);
  }
  // Drop timestamps outside the window.
  while (hits.length && hits[0] <= now - windowMs) hits.shift();

  if (hits.length >= limit) {
    const oldest = hits[0];
    return { ok: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }

  hits.push(now);
  return { ok: true, remaining: limit - hits.length, retryAfterSeconds: 0 };
}

// ── Error helpers ───────────────────────────────────────────
export function unauthorized() {
  return { error: 'unauthorized', detail: 'A valid app access token is required.' };
}

export function missingScope(scope) {
  return { error: 'forbidden', detail: `This token lacks the required scope: ${scope}` };
}

export function rateLimited(retryAfterSeconds) {
  return { error: 'rate_limited', detail: `Slow down. Retry in ${retryAfterSeconds}s.` };
}

export function appNotActive() {
  return { error: 'app_not_active', detail: 'This application is not active (suspended, revoked, or under review).' };
}