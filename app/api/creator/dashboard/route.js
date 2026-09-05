import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import {
  getProfile,
  getTotals,
  getViewsByContent,
  getGrowthSeries,
  getRecentFollowers,
  getContentStats,
  buildInsights,
} from '@/lib/creator/analytics';
import { ensureMilestones, notifyMilestones, fetchMilestones, nextMilestoneHints } from '@/lib/creator/milestones';
import { isAiInsightsEligible, enqueueCreatorInsight, fetchCreatorInsight } from '@/lib/creator/insights';

/**
 * GET /api/creator/dashboard
 *
 * Private Creator Dashboard aggregate. Returns ONLY the authenticated
 * owner's data. 401 for anonymous callers; every metric is computed from
 * real platform data server-side.
 */

export async function GET(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfile(client, userId);

    // Real totals across windows (parallel).
    const [totalsAll, totals7, totals30, views, growth, recentFollowers] = await Promise.all([
      getTotals(client, userId, 0),
      getTotals(client, userId, 7),
      getTotals(client, userId, 30),
      getViewsByContent(client, userId),
      getGrowthSeries(client, userId, 30),
      getRecentFollowers(client, userId, 12),
    ]);

    // Milestone reconciliation: rows are created in real time by instrumented
    // events AND reconciled here; notifications only fire for a small burst so
    // a returning creator is never spammed.
    const newly = await ensureMilestones(client, userId);
    if (newly.length > 0 && newly.length <= 3) {
      await notifyMilestones(client, userId, newly);
    }
    const milestones = await fetchMilestones(client, userId);

    // Recent content window powers content rows + insights.
    const { items: recentContent } = await getContentStats(client, userId, {
      days: 30,
      limit: 10,
      viewsByContent: views,
    });
    const topContent = [...recentContent].sort((a, b) => b.engagement - a.engagement).slice(0, 3);

    const insights = buildInsights({
      totals7,
      totals30,
      totalsAll,
      topContent,
      recentContent,
    });

    // AI-assisted insight (optional, async, aggregate-only). Never blocks
    // the dashboard and never fabricates: without the flag + a real provider
    // this is a no-op, and the worker skips thin-data jobs.
    let aiInsight = null;
    try {
      if (isAiInsightsEligible(userId)) {
        await enqueueCreatorInsight(client, userId, { totals7, totals30, recentContent });
        aiInsight = await fetchCreatorInsight(client, userId);
      }
    } catch (err) {
      console.warn('[Creator Dashboard] AI insight skipped:', err?.message || err);
    }

    return NextResponse.json({
      profile,
      totals: { all: totalsAll, last7d: totals7, last30d: totals30 },
      views: {
        enabled: views.enabled,
        total: views.total,
      },
      milestones,
      nextSteps: nextMilestoneHints({
        posts: totalsAll.posts,
        followers: totalsAll.followers,
        reactions: totalsAll.reactions,
        comments: totalsAll.comments,
      }),
      insights,
      aiInsight,
      growth: growth.series || [],
      recentFollowers,
      recentContent,
    });
  } catch (err) {
    console.error('[Creator Dashboard] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
