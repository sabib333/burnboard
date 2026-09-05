/**
 * BURNBOARD — Security event logging (Master Prompt 26)
 *
 * A thin, always-safe recorder into the `security_logs` table (30-day
 * retention, enforced by the daily cleanup cron). This table was created in
 * the production schema but previously had no live writers — security events
 * from the auth/admin surfaces now land here so anomalies are auditable and
 * visible in the /admin/security operations dashboard.
 *
 * Rules:
 *   - NEVER log secrets, passwords, tokens, or private content.
 *   - Store only a one-way IP hash (never a raw IP) and a coarse action name.
 *   - Details are restricted to non-sensitive, non-user identifiers.
 *   - Fire-and-forget: a logging failure must never break the calling route.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// Allowed security action taxonomy (server-emitted only).
export const SECURITY_ACTIONS = new Set([
  'admin_verify_success', // admin gate unlock succeeded
  'admin_verify_failed',  // admin gate unlock rejected (wrong secret)
  'admin_action',         // an admin surface action (e.g. experiment lifecycle)
  'account_export',       // user downloaded their own data
  'rate_limit_exceeded',  // admin-facing endpoint throttled (no volume flood)
]);

/**
 * Record a security event.
 *
 * @param {object} params
 *   action   — one of SECURITY_ACTIONS
 *   ipHash   — sha256 of the client IP (from lib/adminGate.hashIp), or null
 *   metadata — plain object of coarse, non-sensitive details (default {})
 */
export async function recordSecurityEvent({ action, ipHash = null, metadata = {} }) {
  if (!action || !SECURITY_ACTIONS.has(action)) return null;
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    // security_logs has an open INSERT policy (row-level) — the only
    // writers are these server helpers, and reads are service/admin gated.
    const { error } = await supabase.from('security_logs').insert({
      ip_hash: ipHash || null,
      action,
      details: metadata && typeof metadata === 'object' ? metadata : {},
    });
    if (error) {
      // Log the failure but never break the caller. Table may be absent
      // until migrations are applied — that is an operational state, not a
      // security failure.
      if (!String(error.message || '').toLowerCase().includes('does not exist')) {
        console.error('[SecurityLog] insert error:', error.message);
      }
    }
    return { inserted: !error };
  } catch (err) {
    console.error('[SecurityLog] recorder error:', err?.message || err);
    return null;
  }
}
