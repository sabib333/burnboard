import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { listCreatorProducts, createCreatorProduct } from '@/lib/monetization/products';

/**
 * GET /api/creator/products — the caller's own product configurations.
 * POST /api/creator/products — create a subscription/digital product/paid
 * community with its initial price (eligibility + pricing caps enforced
 * server-side in the RPC).
 *
 * Private: 401 outside the owner's authenticated session.
 */
export async function GET(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const result = await listCreatorProducts(client, userId);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[Creator Products] Error:', err?.message || err);
    return NextResponse.json({ available: false, products: [] });
  }
}

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

    const result = await createCreatorProduct(client, userId, body);
    if (result.error) {
      const status = result.error === 'not_eligible' ? 403 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('[Creator Products] Error:', err?.message || err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}