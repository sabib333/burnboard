import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';

/**
 * POST   /api/signup/destination  { path, ref }  — save the visitor's
 *        intended destination (internal path only, validated server-side).
 * GET    /api/signup/destination                — consume + return it once.
 *
 * Post-signup continuation (Master Prompt 14 §8): a shared link → signup →
 * back to the original content. Used when email confirmation interrupts the
 * flow and the returning user needs their destination restored.
 */

export async function POST(req) {
  const { client, userId } = await getRequestContext(req);
  if (!client || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let path;
  try {
    const body = await req.json();
    path = body?.path;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Internal-only validation (mirrors the SQL RPC guard).
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) {
    return NextResponse.json({ error: 'Path must be an internal URL' }, { status: 400 });
  }
  if (path.includes('\r') || path.includes('\n') || path.length > 500) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }
  const ref = typeof body?.ref === 'string' && /^[a-z0-9]{6,12}$/i.test(body.ref) ? body.ref : null;

  try {
    const { data, error } = await client.rpc('save_signup_destination', {
      p_path: path,
      p_ref: ref || '',
    });
    if (error || !data) {
      return NextResponse.json({ error: 'Failed to save destination' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Signup Destination] Save error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req) {
  const { client, userId } = await getRequestContext(req);
  if (!client || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data } = await client
      .from('signup_destinations')
      .select('path, used_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data || data.used_at || !data.path || !/^\/[^/\\]/.test(data.path)) {
      return NextResponse.json({ path: null });
    }

    // Consume once.
    await client
      .from('signup_destinations')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', userId);

    return NextResponse.json({ path: data.path });
  } catch (err) {
    console.error('[Signup Destination] Read error:', err);
    return NextResponse.json({ path: null });
  }
}