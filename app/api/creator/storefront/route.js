import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { formatMoney } from '@/lib/monetization/config';

/**
 * GET /api/creator/storefront?userId=<uuid>
 *
 * Public creator storefront: the creator's ACTIVE sellable products with
 * active prices (subscriptions, digital products, paid communities). Only
 * marketing/sales data — no earnings, no supporter identity, no internal
 * state. Returns { available: false } when monetization is off or the
 * creator has nothing active.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get('userId');
    if (!creatorId) {
      return NextResponse.json({ items: [], available: false }, { status: 400 });
    }

    const { client } = await getRequestContext(req);
    if (!client) {
      return NextResponse.json({ items: [], available: false });
    }

    const { data: products, error } = await client
      .from('monetization_products')
      .select('id, key, name, description, product_type, billing_text, feature_list')
      .eq('owner_id', creatorId)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (error || !products?.length) {
      return NextResponse.json({ items: [], available: false });
    }

    const ids = products.map(p => p.id);
    const { data: prices } = await client
      .from('monetization_prices')
      .select('id, product_id, amount_minor, currency, billing_interval, interval_count, label')
      .eq('status', 'active')
      .in('product_id', ids);

    const byProduct = {};
    for (const p of prices || []) {
      byProduct[p.product_id] = byProduct[p.product_id] || [];
      byProduct[p.product_id].push({
        id: p.id,
        amountMinor: p.amount_minor,
        currency: p.currency,
        billingInterval: p.billing_interval,
        intervalCount: p.interval_count,
        label: p.label,
        display: formatMoney(p.amount_minor, p.currency),
      });
    }

    const items = products
      .map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        type: p.product_type,
        billingText: p.billing_text,
        features: p.feature_list || [],
        prices: byProduct[p.id] || [],
      }))
      .filter(p => p.prices.length > 0);

    return NextResponse.json({ items, available: true });
  } catch (err) {
    console.error('[Creator Storefront] Error:', err?.message || err);
    return NextResponse.json({ items: [], available: false });
  }
}