import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { formatMoney } from '@/lib/monetization/config';

/**
 * GET /api/monetization/purchases
 *
 * The viewer's own purchase history: purchases (with product names and
 * amounts) plus refund adjustments. Private — only the owner's own rows are
 * ever returned, supporter identity is never included, and no financial
 * internals are exposed. 401 outside the owner's session.
 */
export async function GET(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ purchases: [], available: false }, { status: 401 });
    }

    const { data: purchases, error } = await client
      .from('monetization_purchases')
      .select('id, product_id, status, amount_minor, currency, created_at, period_start, period_end, entitlement_key, metadata')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ purchases: [], available: false });
    }

    // Attach product names (public catalog fields only).
    const productIds = [...new Set((purchases || []).map(p => p.product_id))];
    const names = {};
    if (productIds.length) {
      const { data: products } = await client
        .from('monetization_products')
        .select('id, name, product_type')
        .in('id', productIds);
      for (const p of products || []) names[p.id] = p;
    }

    // Attach refund adjustments per purchase.
    const purchaseIds = (purchases || []).map(p => p.id);
    const adjustmentsByPurchase = {};
    if (purchaseIds.length) {
      const { data: adjustments } = await client
        .from('monetization_adjustments')
        .select('purchase_id, adjustment_type, amount_minor, currency, reason, created_at')
        .in('purchase_id', purchaseIds)
        .order('created_at', { ascending: false });
      for (const a of adjustments || []) {
        adjustmentsByPurchase[a.purchase_id] = adjustmentsByPurchase[a.purchase_id] || [];
        adjustmentsByPurchase[a.purchase_id].push({
          type: a.adjustment_type,
          amountMinor: a.amount_minor,
          currency: a.currency,
          reason: a.reason,
          createdAt: a.created_at,
          display: formatMoney(a.amount_minor, a.currency),
        });
      }
    }

    const result = (purchases || []).map(p => {
      const product = names[p.product_id] || {};
      const refundTotal = (adjustmentsByPurchase[p.id] || [])
        .filter(a => a.type === 'refund')
        .reduce((sum, a) => sum + Math.abs(a.amountMinor), 0);
      return {
        id: p.id,
        productName: product.name || 'BurnBoard',
        productType: product.product_type || null,
        status: p.status,
        amountMinor: p.amount_minor,
        currency: p.currency,
        display: formatMoney(p.amount_minor, p.currency),
        refundedMinor: refundTotal,
        refundedDisplay: formatMoney(refundTotal, p.currency),
        createdAt: p.created_at,
        periodStart: p.period_start,
        periodEnd: p.period_end,
        entitlementKey: p.entitlement_key,
        adjustments: adjustmentsByPurchase[p.id] || [],
      };
    });

    return NextResponse.json({ purchases: result, available: true });
  } catch (err) {
    console.error('[Monetization] Purchase history error:', err?.message || err);
    return NextResponse.json({ purchases: [], available: false });
  }
}