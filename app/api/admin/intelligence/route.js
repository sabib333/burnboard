/**
 * BURNBOARD — Recommendation Intelligence API (Master Prompt 27)
 *
 * GET /api/admin/intelligence
 *
 * Aggregate health of the personalization & discovery system — the rollback
 * signals that decide whether a ranking change stays or goes:
 *   - signals / feed impressions / explicit negative feedback volume
 *   - creator reach + top-10 attention concentration (echo-chamber proxy)
 *   - new-creator share of reached creators (cold-start fairness)
 *   - communities reached + content-format mix
 *   - interest-graph scale + user control usage (opt-outs, resets)
 *   - AI usage: calls, failures, fallback rate, estimated cost, latency
 *   - AI job queue: pending / failed
 *
 * Computed from real rows only (lib/reco/health.js). Owner-scoped and
 * system tables require the service-role key — if it is absent the API
 * reports unavailable rather than silently showing zeroes (anon RLS would
 * hide everything). Admin-gated (fail-closed, MP26). No user-level data.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAdminAccess, adminAccessResponse } from '@/lib/adminGate';
import { probeIntelligenceHealth } from '@/lib/reco/health';

// Thresholds for computed rollback signals (directional, not enforcement).
const NEGATIVE_FEEDBACK_PER_K_WARN = 40;   // per 1k feed impressions / 7d
const CONCENTRATION_WARN = 0.55;           // top-10 creators' share of engagement sample
const NEW_CREATOR_INFO_BELOW = 0.1;        // share of reached creators that are < 90 days old
const AI_FAILURE_WARN_PCT = 10;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // rec_events/rec_feedback/user_affinities are owner-scoped under RLS and
  // ai_* tables are system-only — all require the service-role key to read
  // aggregate health. Never fall back to anon (it would return zero rows).
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function computeSignals(reco, ai) {
  const alerts = [];
  if (!reco?.available) return alerts;

  const v = reco.volume || {};
  const e = reco.ecosystem || {};

  if (v.signals7d === 0) {
    alerts.push({
      type: 'no_signals',
      level: 'info',
      detail: 'No personalization signals recorded in the window — the feed will be serving generic ranking. Activity (reactions, comments, follows, joins) powers For You.',
    });
  }
  if (v.negativeFeedbackPerKImpressions > NEGATIVE_FEEDBACK_PER_K_WARN) {
    alerts.push({
      type: 'negative_feedback_rise',
      level: 'warn',
      detail: `Explicit negative feedback is ${v.negativeFeedbackPerKImpressions}/1k feed impressions over ${reco.windowDays}d (${v.negatives7d} negatives). If this followed a ranking change, treat it as a rollback signal.`,
    });
  }
  if (e.top10Concentration !== null && e.top10Concentration > CONCENTRATION_WARN) {
    alerts.push({
      type: 'creator_concentration',
      level: 'warn',
      detail: `Top-10 creators received ${Math.round(e.top10Concentration * 100)}% of the sampled engagement signals — watch for winner-take-all feed dynamics.`,
    });
  }
  if (e.newCreatorShare !== null && e.creatorsReached7d >= 20 && e.newCreatorShare < NEW_CREATOR_INFO_BELOW) {
    alerts.push({
      type: 'new_creator_reach_low',
      level: 'info',
      detail: `Only ${Math.round(e.newCreatorShare * 100)}% of reached creators in the sample are under 90 days old — check exploration is still surfacing new accounts.`,
    });
  }

  if (ai?.available) {
    const u = ai.usage || {};
    if (u.calls7d > 0 && u.failureRatePct > AI_FAILURE_WARN_PCT) {
      alerts.push({
        type: 'ai_failure_rate',
        level: 'warn',
        detail: `AI task failure rate is ${u.failureRatePct}% (${u.failures7d}/${u.calls7d} calls in ${ai.windowDays}d). The builtin fallback chain keeps the product up, but investigate the provider.`,
      });
    }
    if ((ai.jobs?.pending || 0) > 50) {
      alerts.push({
        type: 'ai_queue_backlog',
        level: 'warn',
        detail: `${ai.jobs.pending} AI jobs pending — the background worker may be behind.`,
      });
    }
  }

  return alerts;
}

export async function GET(req) {
  const access = checkAdminAccess(req);
  if (!access.ok) return adminAccessResponse(access);

  const client = getSupabase();
  if (!client) {
    return NextResponse.json(
      { available: false, error: 'service_key_required', alerts: [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const { reco, ai } = await probeIntelligenceHealth(client, { days: 7 });

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      windowDays: 7,
      reco,
      ai,
      alerts: computeSignals(reco, ai),
      // Aggregate-only guarantee: no identifiers, no user data.
      scope: 'aggregate-only',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
