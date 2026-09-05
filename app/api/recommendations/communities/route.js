import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { recommendCommunities } from '@/lib/reco/discovery';

/**
 * GET /api/recommendations/communities?limit=6
 *
 * "Communities for You" — discovery rail.
 * Auth required. Communities are recommended from topic overlap with the
 * viewer's joined communities / explicit interests and the viewer's own
 * community affinity. All displayed counts (members, recent posts) are
 * real. Inactive/empty communities are never recommended. Private
 * communities are never surfaced.
 */
export async function GET(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ items: [], signedIn: false }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '6', 10) || 6, 12);

    const result = await recommendCommunities({ client, userId, limit });
    return NextResponse.json({ items: result.items, signedIn: true });
  } catch (err) {
    console.error('[Recommendations] Communities error:', err);
    return NextResponse.json({ items: [], error: 'Internal server error' }, { status: 500 });
  }
}
