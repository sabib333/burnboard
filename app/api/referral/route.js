import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';

/**
 * GET /api/referral (authenticated)
 *
 * Returns the viewer's durable invite code (+ shareable link), creating the
 * opaque code on first request (server-side, collision-safe, owner-scoped).
 */
export async function GET(request) {
  const { client, userId } = await getRequestContext(request);
  if (!client || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await client.rpc('create_referral_code', { p_user: userId });
    if (error || !data) {
      return NextResponse.json({ error: 'Referral code unavailable' }, { status: 500 });
    }
    return NextResponse.json({
      code: data,
      inviteUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://burnboard.app'}/s/${data}`,
    });
  } catch (err) {
    console.error('[Referral] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}