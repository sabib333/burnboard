import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { getCatalog } from '@/lib/monetization/billing';

/**
 * GET /api/monetization/catalog
 *
 * Public product catalog + centralized pricing. Safe for anonymous visitors
 * (marketing data only — no PII, no pricing decisions). Returns available:
 * false when the monetization migration hasn't been applied, so UIs can hide
 * monetization surfaces gracefully.
 */
export async function GET(req) {
  try {
    const { client } = await getRequestContext(req);
    const catalog = await getCatalog(client);
    return NextResponse.json(catalog);
  } catch (err) {
    console.error('[Monetization] Catalog error:', err?.message || err);
    return NextResponse.json({ products: [], available: false });
  }
}