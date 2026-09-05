/**
 * BURNBOARD — Security Operations API (Master Prompt 26)
 *
 * GET /api/admin/security
 *
 * Aggregate visibility into security-relevant events recorded by the auth
 * and admin surfaces (admin gate attempts, admin actions). Reads from the
 * `security_logs` table (30-day retention via the daily cleanup cron).
 *
 * Returned data is deliberately coarse:
 *   - IPs are one-way hashes, truncated for display (never raw IPs)
 *   - no passwords, tokens, or content — ever
 *   - recent events + 24h failure/success aggregates + a simple velocity
 *     anomaly flag (an IP with many failed admin unlocks in 24h)
 *
 * Protected by the centralized admin gate. Failure-soft: if the table is
 * absent (migrations not applied) it returns { available: false }, never a
 * fabricated "all clear".
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAdminAccess, adminAccessResponse } from '@/lib/adminGate';

const FAILURE_THRESHOLD_24H = 5; // flagged-IP threshold for anomalies

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // security_logs has no public SELECT policy — reads must bypass RLS via the
  // service-role key. Falling back to the anon key would silently return zero
  // rows (RLS-hidden) and masquerade as an all-clear, so we refuse instead.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function truncateIpHash(hash) {
  if (!hash) return 'unknown';
  return `${String(hash).slice(0, 10)}…`;
}

export async function GET(req) {
  const access = checkAdminAccess(req);
  if (!access.ok) return adminAccessResponse(access);

  const client = getSupabase();
  if (!client) {
    return NextResponse.json(
      { available: false, error: 'service_key_required' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Recent events (latest 100, all actions).
    const { data: events, error: eventsErr } = await client
      .from('security_logs')
      .select('id, action, ip_hash, details, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    // 24h auth-attempt aggregates (bounded reads, aggregate only).
    const [{ count: failedCount }, { count: successCount }, { data: failedIps }] = await Promise.all([
      client
        .from('security_logs')
        .select('id', { count: 'exact', head: true })
        .eq('action', 'admin_verify_failed')
        .gte('created_at', dayAgo),
      client
        .from('security_logs')
        .select('id', { count: 'exact', head: true })
        .eq('action', 'admin_verify_success')
        .gte('created_at', dayAgo),
      client
        .from('security_logs')
        .select('ip_hash')
        .eq('action', 'admin_verify_failed')
        .gte('created_at', dayAgo)
        .limit(1000),
    ]);

    if (eventsErr && String(eventsErr.message || '').toLowerCase().includes('does not exist')) {
      return NextResponse.json(
        { available: false, error: 'security_logs table not present — apply migrations' },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (eventsErr) {
      return NextResponse.json(
        { available: false, error: eventsErr.message },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Aggregate failed unlocks by hashed IP (client-side over the bounded set).
    const perIp = new Map();
    for (const row of failedIps || []) {
      if (!row?.ip_hash) continue;
      perIp.set(row.ip_hash, (perIp.get(row.ip_hash) || 0) + 1);
    }
    const topIps = [...perIp.entries()]
      .map(([hash, count]) => ({ ipHash: truncateIpHash(hash), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    const flagged = topIps.filter((ip) => ip.count >= FAILURE_THRESHOLD_24H);

    const anomalies = [];
    if (flagged.length > 0) {
      anomalies.push({
        level: 'warn',
        detail: `${flagged.length} IP${flagged.length === 1 ? '' : 's'} exceeded ${FAILURE_THRESHOLD_24H} failed admin unlock attempts in 24h — possible credential attack. ${flagged.map((ip) => `${ip.ipHash}×${ip.count}`).join(', ')}`,
      });
    }
    if ((failedCount || 0) > 0 && (successCount || 0) === 0 && (failedCount || 0) >= 10) {
      anomalies.push({
        level: 'warn',
        detail: `${failedCount} failed admin unlocks in the last 24h with zero successes — verify ADMIN_PASSWORD is set and known to the team.`,
      });
    }

    return NextResponse.json(
      {
        available: true,
        generatedAt: new Date().toISOString(),
        summary: {
          failures24h: failedCount || 0,
          successes24h: successCount || 0,
          distinctIps24h: perIp.size,
          flaggedIps24h: flagged.length,
          topIps,
        },
        anomalies,
        events: (events || []).map((evt) => ({
          id: evt.id,
          action: evt.action,
          ip: truncateIpHash(evt.ip_hash),
          details: evt.details || null,
          createdAt: evt.created_at,
        })),
        retention: 'security_logs are retained 30 days and purged by the daily cleanup cron.',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[Admin Security] Error:', err?.message || err);
    return NextResponse.json(
      { available: false, error: 'internal' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
