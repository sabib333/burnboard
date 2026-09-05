import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { createBlock, removeBlock } from '@/lib/safety';

/**
 * POST /api/safety/blocks   { user_id }  — block a user (mutual enforcement)
 * DELETE /api/safety/blocks { user_id }  — unblock
 * GET  /api/safety/blocks                — list the signed-in user's blocks
 *
 * Blocking is a real server-side relationship:
 *   - follow relationships in both directions are removed
 *   - reads hide the blocked user's content for the blocker
 *   - the blocked user cannot follow or interact with the blocker
 */

export async function GET(request) {
  try {
    const auth = await getRequestContext(request);
    if (!auth.client || !auth.userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    const { data } = await auth.client
      .from('user_blocks')
      .select('blocked_id, created_at')
      .eq('blocker_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(100);
    return NextResponse.json({ blockedUsers: data || [] });
  } catch (err) {
    console.error('[Safety] Blocks GET error:', err);
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
    const result = await createBlock({ client: auth.client, blockerUserId: auth.userId, blockedUserId: user_id });
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, blocked: true, alreadyBlocked: !!result.alreadyBlocked });
  } catch (err) {
    console.error('[Safety] Block error:', err);
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
    const result = await removeBlock({ client: auth.client, blockerUserId: auth.userId, blockedUserId: user_id });
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, blocked: false });
  } catch (err) {
    console.error('[Safety] Unblock error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
