import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { activateCreatorProduct } from '@/lib/monetization/products';

/**
 * POST /api/creator/products/[id]/activate
 *
 * Explicit activation step for a draft product. Owner-only (enforced in the
 * RPC); products never go live by accident — a price must exist and the
 * owner must deliberately activate.
 */
export async function POST(req, { params }) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const productId = params?.id;
    if (!productId) {
      return NextResponse.json({ error: 'missing_product' }, { status: 400 });
    }

    const result = await activateCreatorProduct(client, userId, productId);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Creator Products] Activate error:', err?.message || err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}