/**
 * BURNBOARD — Social Network Health API (Master Prompt 28)
 *
 * GET /api/admin/social
 *
 * Aggregate health of the social layer — the follow graph, new-user social
 * activation ("first connection"), community ecosystem, conversations,
 * the notification (return-loop) engine, and social boundaries:
 *   - follow edges created (24h / 7d / 30d) + accounts gaining followers
 *   - activation cohort: share of newest accounts that follow someone,
 *     join a community, post, or comment — and how fast (≤ 7d)
 *   - follow-back reciprocity within the cohort (bounded, exact presence)
 *   - communities: joins, joiners, communities receiving posts
 *   - conversations: comments/replies/threads vs one-tap reactions
 *   - notifications delivered / unread / by type
 *   - boundaries: blocks and mutes created
 *
 * Computed from real rows only (lib/socialHealth.js). Most of these tables
 * are owner-scoped under RLS — the anon key would silently under-count, so
 * the API requires the service-role key and reports unavailable without it.
 * Admin-gated (fail-closed, MP26). Aggregate-only: no user-level data.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAdminAccess, adminAccessResponse } from '@/lib/adminGate';
import { probeSocialHealth } from '@/lib/socialHealth';

// Directional thresholds for computed alerts (monitoring guidance, not
// enforcement — full reasoning in docs/social/SOCIAL_HEALTH.md).
const FOLLOWING_ACTIVATION_WARN_PCT = 25;     // share of newest accounts that follow anyone
const RECIPROCITY_INFO_BELOW_PCT = 15;        // share of followers with a follow-back
const BOUNDARY_TO_FOLLOW_WARN = 0.5;          // (blocks + mutes) / new follows
const BOUNDARY_MIN_BLOCKS = 5;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // follows/notifications/user_blocks/user_mutes are owner-scoped under RLS
  // and the community tables are app-guarded — all need the service-role key
  // for honest aggregates. Never fall back to anon (it would under-count).
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function countUsers(client) {
  try {
    const { count, error } = await client
      .from('user_profiles')
      .select('id', { count: 'exact', head: true });
    if (error) throw error;
    return count === null ? null : (count || 0);
  } catch {
    return null;
  }
}

function computeAlerts(social, userTotal) {
  const alerts = [];
  const g = social?.graph;
  const a = social?.activation;
  const c = social?.communities;
  const conv = social?.conversations;
  const n = social?.notifications;
  const b = social?.boundaries;

  const gAvail = g?.available && g?.graph;
  const gg = gAvail ? g.graph : null;
  const cc = c?.available ? c.communities : null;
  const cv = conv?.available ? conv.conversations : null;
  const nn = n?.available ? n.notifications : null;
  const bb = b?.available ? b.boundaries : null;

  // Empty graph when accounts exist.
  if (gg && gg.totalEdges === 0 && userTotal && userTotal > 0) {
    alerts.push({
      type: 'graph_empty',
      level: 'warn',
      detail: `${userTotal} accounts exist but the follow graph is empty (0 edges) — people are not connecting; check the follow entry points.`,
    });
  } else if (gg && gg.totalEdges > 0 && gg.edges7d === 0) {
    alerts.push({
      type: 'graph_idle',
      level: 'info',
      detail: 'No new follow edges in the last 7 days despite an existing graph — the connection loop has stalled.',
    });
  }

  // New-user social activation.
  if (a?.available && a.cohort?.sampleSize > 0) {
    const followingPct = a.cohort.followingSharePct;
    if (followingPct !== null && followingPct < FOLLOWING_ACTIVATION_WARN_PCT) {
      alerts.push({
        type: 'activation_low',
        level: 'warn',
        detail: `Only ${followingPct}% of the ${a.cohort.sampleSize} newest accounts follow anyone — most never reach a first connection. This is the core social activation metric.`,
      });
    }
    if (a.cohort.followingSharePct > 0 && a.cohort.reciprocalFollowSharePct !== null && a.cohort.reciprocalFollowSharePct < RECIPROCITY_INFO_BELOW_PCT) {
      alerts.push({
        type: 'reciprocity_low',
        level: 'info',
        detail: `Only ${a.cohort.reciprocalFollowSharePct}% of new accounts that follow someone received a follow-back (${a.cohort.sampleSize}-account sample) — watch for one-way network dynamics.`,
      });
    }
  }

  // Boundary activity relative to new connections (harassment proxy).
  if (gg && bb && gg.edges7d > 0) {
    const boundaries = bb.blocks7d + bb.mutes7d;
    if (bb.blocks7d >= BOUNDARY_MIN_BLOCKS && boundaries / gg.edges7d > BOUNDARY_TO_FOLLOW_WARN) {
      alerts.push({
        type: 'boundary_ratio_high',
        level: 'warn',
        detail: `${boundaries} blocks/mutes created this week against ${gg.edges7d} new follows (${Math.round((boundaries / gg.edges7d) * 100)}%) — investigate before treating connection growth as healthy.`,
      });
    }
  }

  // Content being created but nobody conversing.
  if (cv && cv.posts7d > 0 && cv.comments7d === 0) {
    alerts.push({
      type: 'conversation_idle',
      level: 'warn',
      detail: `${cv.posts7d} posts created in 7d but zero comments — content is flowing without conversation; nothing is pulling people into dialogue.`,
    });
  }

  // Communities exist but nobody joining.
  if (cc && cc.total > 0 && cc.joins7d === 0) {
    alerts.push({
      type: 'community_stagnant',
      level: 'info',
      detail: `${cc.total} communities exist but nobody joined in the last 7 days — discovery or invitation loops may need attention.`,
    });
  }

  // Return-loop engine silent while the network is active.
  if (nn && gg && (gg.edges7d > 0 || cv?.comments7d > 0) && nn.delivered7d === 0) {
    alerts.push({
      type: 'return_loop_silent',
      level: 'info',
      detail: 'No notifications delivered in 7d despite active follows/comments — the return-loop engine may not be wired to events.',
    });
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

  const social = await probeSocialHealth(client);
  const userTotal = await countUsers(client);

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      windowDays: 7,
      userTotal,
      social,
      alerts: computeAlerts(social, userTotal),
      // Aggregate-only guarantee: no identifiers, no user data.
      scope: 'aggregate-only',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
