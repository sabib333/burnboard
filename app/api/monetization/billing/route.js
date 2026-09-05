import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { getBilling } from '@/lib/monetization/billing';

/**
 * GET /api/monetization/billing
 *
 * Private billing history + entitlements for the authenticated owner.
 * 401 for anonymous; never exposes payment details beyond amounts/dates.
 */
export async function GET(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const billing = await getBilling(client, userId);
    return NextResponse.json(billing);
  } catch (err) {
    console.error('[Monetization] Billing error:', err?.message || err);
    return NextResponse.json({ entitlements: [], purchases: [], available: false });
  }
}