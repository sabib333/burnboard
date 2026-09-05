import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { getContentStats, getViewsByContent } from '@/lib/creator/analytics';

/**
 * GET /api/creator/content?limit=20&offset=0&days=0
 *
 * Paginated content performance for the authenticated owner. Real engagement
 * counts per post, plus real view counts when the impression log exists.
 */

export async function GET(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
    const days = Math.max(parseInt(searchParams.get('days') || '0', 10), 0);

    const [views, result] = await Promise.all([
      getViewsByContent(client, userId),
      getContentStats(client, userId, { days, limit, offset }),
    ]);

    return NextResponse.json({
      items: result.items,
      total: result.total,
      hasMore: result.hasMore,
      nextOffset: result.hasMore ? offset + result.items.length : null,
      viewsEnabled: views.enabled,
    });
  } catch (err) {
    console.error('[Creator Content] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
