import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { cancelSubscription } from '@/lib/monetization/billing';

/**
 * POST /api/monetization/subscription/cancel { key }
 *
 * End-of-period cancellation for the viewer's own subscription. Owner-only
 * (enforced server-side); access continues until the end of the paid period —
 * never a hidden or hard-cancelled flow. Auth required.
 */
export async function POST(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    if (!body?.key) {
      return NextResponse.json({ error: 'missing_key' }, { status: 400 });
    }

    const result = await cancelSubscription(client, userId, body.key);
    if (result.error) {
      return NextResponse.json({ error: 'Could not cancel the subscription.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Monetization] Cancel error:', err?.message || err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}