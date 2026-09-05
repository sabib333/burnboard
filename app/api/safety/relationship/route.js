import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { relationshipBetween } from '@/lib/safety';

/**
 * GET /api/safety/relationship?user_id=xxx
 *
 * For the signed-in viewer: do they block / mute the other user, and does
 * the other user block them? Used to render real block/mute state and to
 * keep UI honest about server-enforced relationships.
 */

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const otherUserId = searchParams.get('user_id');
    if (!otherUserId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const auth = await getRequestContext(request);
    if (!auth.client || !auth.userId) {
      // Anonymous viewers have no relationships to report.
      return NextResponse.json({
        viewer_blocks_other: false,
        other_blocks_viewer: false,
        viewer_mutes_other: false,
        signedIn: false,
      });
    }

    const rel = await relationshipBetween(auth.client, auth.userId, otherUserId);
    return NextResponse.json({ ...rel, signedIn: true });
  } catch (err) {
    console.error('[Safety] Relationship error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
