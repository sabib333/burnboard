import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { recommendChallenges } from '@/lib/reco/discovery';

/**
 * GET /api/recommendations/challenges?limit=6
 *
 * "Challenges for You" — discovery rail.
 * Auth required. Recommends active, public, honestly-not-ended challenges
 * the viewer hasn't joined, ranked by community relevance, topic overlap,
 * content-format affinity, real participation and freshness. Challenges
 * the viewer repeatedly rejected by format are suppressed. No artificial
 * urgency is ever created.
 */
export async function GET(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ items: [], signedIn: false }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '6', 10) || 6, 12);

    const result = await recommendChallenges({ client, userId, limit });
    return NextResponse.json({ items: result.items, signedIn: true });
  } catch (err) {
    console.error('[Recommendations] Challenges error:', err);
    return NextResponse.json({ items: [], error: 'Internal server error' }, { status: 500 });
  }
}
