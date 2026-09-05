import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { createMute, removeMute } from '@/lib/safety';

/**
 * POST /api/safety/mutes   { user_id }  — mute a user
 * DELETE /api/safety/mutes { user_id }  — unmute
 * GET  /api/safety/mutes                — list the signed-in user's mutes
 *
 * Muting is distinct from blocking:
 *   - one-directional; the muted user is never told
 *   - affects feed visibility + notification relevance for the muter
 *   - the muted user can still interact normally (no false signal)
 */

export async function GET(request) {
  try {
    const auth = await getRequestContext(request);
    if (!auth.client || !auth.userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    const { data } = await auth.client
      .from('user_mutes')
      .select('muted_id, created_at')
      .eq('muter_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(100);
    return NextResponse.json({ mutedUsers: data || [] });
  } catch (err) {
    console.error('[Safety] Mutes GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await getRequestContext(request);
    if (!auth.client || !auth.userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    const body = await request.json();
    const { user_id } = body;
    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }
    const result = await createMute({ client: auth.client, muterUserId: auth.userId, mutedUserId: user_id });
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, muted: true, alreadyMuted: !!result.alreadyMuted });
  } catch (err) {
    console.error('[Safety] Mute error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const auth = await getRequestContext(request);
    if (!auth.client || !auth.userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    const body = await request.json();
    const { user_id } = body;
    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }
    const result = await removeMute({ client: auth.client, muterUserId: auth.userId, mutedUserId: user_id });
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, muted: false });
  } catch (err) {
    console.error('[Safety] Unmute error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
