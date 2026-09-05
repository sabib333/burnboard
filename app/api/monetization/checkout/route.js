import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { createCheckout } from '@/lib/monetization/billing';

/**
 * POST /api/monetization/checkout { price_id }
 *
 * Creates a PENDING purchase and returns the provider-hosted checkout URL.
 * The provider's verified webhook is what promotes the purchase — the client
 * never confirms payment itself. Auth required.
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

    if (!body?.price_id) {
      return NextResponse.json({ error: 'missing_price' }, { status: 400 });
    }

    const result = await createCheckout({
      client,
      userId,
      priceId: body.price_id,
      productOwnerId: body.owner_id || null,
    });

    if (result.error === 'unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (result.error === 'self_purchase') {
      return NextResponse.json({ error: 'You cannot purchase your own product.' }, { status: 400 });
    }
    if (result.error === 'disabled') {
      return NextResponse.json({ error: 'Monetization is not enabled on this deployment.' }, { status: 403 });
    }
    if (result.error || !result.ok) {
      return NextResponse.json({ error: 'Checkout could not be started.' }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[Monetization] Checkout error:', err?.message || err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}