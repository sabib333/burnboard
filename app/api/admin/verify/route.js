/**
 * BURNBOARD — Admin gate verification (Master Prompt 26)
 *
 * POST /api/admin/verify
 *
 * Server-side verification for the client admin dashboards. The client never
 * embeds a secret: the typed password is sent once in the x-admin-password
 * header and validated here against ADMIN_PASSWORD. On success the page keeps
 * the secret in memory (React state only) and attaches it to subsequent
 * admin API calls. On failure or when unconfigured, nothing is stored.
 *
 * Responses:
 *   200 { ok: true }            — secret accepted
 *   401 { error }               — secret rejected
 *   429 { error, retryAfter }   — too many attempts from this IP
 *   503 { error, code: 'admin_not_configured' } — ADMIN_PASSWORD unset
 *
 * Attempts are per-IP rate limited (10 / 5 min) and recorded as security
 * events (hashed IP, no secret material ever).
 */

import { NextResponse } from 'next/server';
import { adminConfigured, verifyAdminSecret, hashIp } from '@/lib/adminGate';
import { recordSecurityEvent } from '@/lib/securityEvents';
import { checkRateLimit, getClientIp, ipKey } from '@/lib/serverRateLimit';

const VERIFY_WINDOW_MS = 5 * 60 * 1000;
const VERIFY_MAX = 10;

export async function POST(request) {
  // Per-IP throttling BEFORE any comparison work.
  const ip = getClientIp(request);
  const rl = checkRateLimit(ipKey(ip, 'adminAuth'), {
    windowMs: VERIFY_WINDOW_MS,
    maxRequests: VERIFY_MAX,
  });
  if (!rl.allowed) {
    const retryAfter = Math.ceil((rl.retryAfterMs || VERIFY_WINDOW_MS) / 1000);
    return NextResponse.json(
      {
        error: 'Too many attempts. Try again later.',
        retryAfter,
        code: 'rate_limited',
      },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  // Fail closed: no ADMIN_PASSWORD configured → no admin access anywhere.
  if (!adminConfigured()) {
    return NextResponse.json(
      {
        error: 'Admin access is not configured on this deployment.',
        code: 'admin_not_configured',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const secret = request.headers.get('x-admin-password') || '';
  const ipHash = hashIp(ip);
  const result = verifyAdminSecret(secret);

  // Best-effort audit trail — never blocks the response.
  recordSecurityEvent({
    action: result.ok ? 'admin_verify_success' : 'admin_verify_failed',
    ipHash,
  });

  if (result.ok) {
    return NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return NextResponse.json(
    { error: 'Unauthorized', code: 'unauthorized' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  );
}
