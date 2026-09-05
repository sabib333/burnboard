/**
 * BURN BOARD — Metrics API
 *
 * GET /api/metrics — returns in-memory request metrics (counters + latency
 * aggregates) collected by lib/metrics.js.
 *
 * Protected by CRON_SECRET (same convention as other internal endpoints)
 * and served with no-store so dashboards/scrapers always get fresh data.
 */

import { NextResponse } from 'next/server';
import { getMetrics } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Fail closed: when CRON_SECRET is not configured this endpoint must not
  // be reachable at all — internal request metrics are never public.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(getMetrics(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}