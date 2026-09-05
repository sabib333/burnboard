/**
 * BURNBOARD Monetization — Billing & Entitlement Service (Master Prompt 15)
 *
 * The application-facing layer between API routes and the provider
 * abstraction. All writes to financial tables funnel through SECURITY
 * DEFINER RPCs or owner-scoped pending-insert policies — this module never
 * trusts client state. Every function degrades to a safe "unavailable"
 * result if the monetization migration hasn't been applied yet.
 *
 * Money is always integer minor units; splits come from the centralized
 * revenue policy in config.js.
 */

import crypto from 'crypto';

import {
  getMonetizationEnv,
  isMonetizationEnabled,
  entitlementKeyFor,
  computeSplits,
  formatMoney,
  REVENUE_SPLIT,
} from '@/lib/monetization/config';
import { getPaymentProvider, providerAvailable } from '@/lib/monetization/providers';
import { recordGrowthEvent } from '@/lib/experimentService';

function notReady() {
  return null;
}

// ── Public catalog ──────────────────────────────────────────
export async function getCatalog(client) {
  if (!client) return { products: [], available: false };
  try {
    const { data: products } = await client
      .from('monetization_products')
      .select('id, key, name, description, product_type, status, billing_text, feature_list')
      .eq('status', 'active')
      .order('created_at', { ascending: true });
    if (!products?.length) return { products: [], available: false };

    const ids = products.map(p => p.id);
    const { data: prices } = await client
      .from('monetization_prices')
      .select('id, product_id, amount_minor, currency, billing_interval, interval_count, label, status')
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
        periodLabel: p.billing_interval === 'month' ? 'per month' : p.billing_interval === 'year' ? 'per year' : 'one-time',
      });
    }

    return {
      available: true,
      provider: providerAvailable() ? getPaymentProvider().key : null,
      testMode: getMonetizationEnv() !== 'prod',
      products: products.map(p => ({
        id: p.id,
        key: p.key,
        name: p.name,
        description: p.description,
        type: p.product_type,
        billingText: p.billing_text,
        features: p.feature_list || [],
        prices: byProduct[p.id] || [],
      })),
    };
  } catch {
    return { products: [], available: false };
  }
}

// ── Checkout initiation ─────────────────────────────────────
// Creates a PENDING purchase row, asks the provider for a hosted checkout,
// and returns the URL. The provider webhook is what promotes it — never a
// client callback.
export async function createCheckout({ client, userId, priceId, productOwnerId = null, metadata = {} }) {
  if (!client || !userId) return { error: 'unauthorized' };
  if (!isMonetizationEnabled()) return { error: 'disabled' };
  if (!providerAvailable()) return { error: 'unavailable' };

  try {
    const { data: price, error: priceErr } = await client
      .from('monetization_prices')
      .select('*, monetization_products(*)')
      .eq('id', priceId)
      .eq('status', 'active')
      .single();
    if (priceErr || !price) return { error: 'invalid_price' };

    const product = price.monetization_products;
    if (!product || product.status !== 'active') return { error: 'invalid_product' };

    // Self-dealing prevention: a creator can never purchase their own product.
    if (product.owner_id && product.owner_id === userId) {
      return { error: 'self_purchase' };
    }

    const transactionRef = `mm_${crypto.randomBytes(12).toString('hex')}`;
    const origin = getMonetizationEnv();

    // Ask the provider for the checkout link (uses the pending ref only).
    const driver = getPaymentProvider();
    const checkout = await driver.createCheckout({
      purchaseRef: transactionRef,
      amountMinor: price.amount_minor,
      currency: price.currency,
      description: product.name,
      metadata,
    });

    const entitlementKey = entitlementKeyFor(product.key, product.owner_id);

    // Persist the pending purchase (RLS restricts inserts to status 'pending').
    const { data: purchase, error: insertErr } = await client
      .from('monetization_purchases')
      .insert({
        transaction_ref: transactionRef,
        provider_id: checkout.providerId,
        provider: driver.key,
        user_id: userId,
        product_id: product.id,
        price_id: price.id,
        entitlement_key: entitlementKey,
        status: 'pending',
        amount_minor: price.amount_minor,
        currency: price.currency,
        origin,
        metadata: { product_key: product.key },
      })
      .select('id')
      .single();
    if (insertErr || !purchase) return { error: 'checkout_failed' };

    // Revenue funnel event (MP24, Section 87): checkout initiated. Best-effort
    // and non-blocking — attribution must never block a payment.
    recordGrowthEvent('payment_started', userId, {
      product_key: product.key,
      product_type: product.product_type,
      price_id: price.id,
    }).catch(() => {});

    return {
      ok: true,
      checkoutUrl: checkout.checkoutUrl,
      purchaseId: purchase.id,
      testMode: origin !== 'prod',
      amountMinor: price.amount_minor,
      currency: price.currency,
      display: formatMoney(price.amount_minor, price.currency),
    };
  } catch (err) {
    console.error('[Monetization] createCheckout error:', err?.message || err);
    return { error: 'unavailable' };
  }
}

// ── Tips / creator support ────────────────────────────────
// One-time voluntary tips made to a creator (creator-defined via the
// standardized tiers). Provisioning is idempotent (RPC); the checkout layer
// enforces the self-purchase guard (creators can never tip themselves).
export async function getTipOptions({ client, userId, creatorId }) {
  if (!client || !userId || !creatorId) return { available: false, prices: [] };
  if (!isMonetizationEnabled()) return { available: false, prices: [] };
  if (!providerAvailable()) return { available: false, prices: [] };
  if (creatorId === userId) {
    return { available: false, self: true, prices: [] };
  }

  try {
    const { data, error } = await client.rpc('ensure_creator_tip_product', {
      p_creator: creatorId,
    });
    if (error || !data || !data[0]?.product_id) {
      return { available: false, prices: [] };
    }
    const productId = data[0].product_id;

    const { data: prices } = await client
      .from('monetization_prices')
      .select('id, amount_minor, currency, billing_interval, label, status')
      .eq('product_id', productId)
      .eq('status', 'active')
      .eq('billing_interval', 'one_time')
      .order('amount_minor', { ascending: true });

    return {
      available: true,
      self: false,
      productId,
      testMode: getMonetizationEnv() !== 'prod',
      prices: (prices || []).map(p => ({
        id: p.id,
        amountMinor: p.amount_minor,
        currency: p.currency,
        display: formatMoney(p.amount_minor, p.currency),
        label: p.label,
      })),
    };
  } catch {
    return { available: false, prices: [] };
  }
}

// ── Billing history (private, owner-scoped) ─────────────────
export async function getBilling(client, userId) {
  if (!client || !userId) return { entitlements: [], purchases: [], available: false };
  try {
    const { data: entitlements } = await client
      .from('monetization_entitlements')
      .select('id, product_id, key, status, current_period_end, cancel_at_period_end, source, granted_at')
      .eq('user_id', userId)
      .order('granted_at', { ascending: false })
      .limit(50);

    const { data: purchases } = await client
      .from('monetization_purchases')
      .select('id, product_id, price_id, status, amount_minor, currency, period_start, period_end, origin, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    // Product meta (active products are publicly readable).
    const productIds = [...new Set([
      ...(entitlements || []).map(e => e.product_id),
      ...(purchases || []).map(p => p.product_id),
    ])];
    const productsById = {};
    if (productIds.length) {
      const { data: products } = await client
        .from('monetization_products')
        .select('id, key, name, product_type')
        .in('id', productIds);
      for (const p of products || []) productsById[p.id] = p;
    }

    return {
      available: true,
      testMode: getMonetizationEnv() !== 'prod',
      entitlements: (entitlements || []).map(e => ({
        id: e.id,
        key: e.key,
        status: e.status,
        currentPeriodEnd: e.current_period_end,
        cancelAtPeriodEnd: e.cancel_at_period_end,
        source: e.source,
        grantedAt: e.granted_at,
        product: productsById[e.product_id]
          ? { name: productsById[e.product_id].name, key: productsById[e.product_id].key }
          : null,
      })),
      purchases: (purchases || []).map(p => ({
        id: p.id,
        status: p.status,
        amountMinor: p.amount_minor,
        currency: p.currency,
        display: formatMoney(p.amount_minor, p.currency),
        periodStart: p.period_start,
        periodEnd: p.period_end,
        origin: p.origin,
        createdAt: p.created_at,
        testMode: p.origin !== 'prod',
        product: productsById[p.product_id]
          ? { name: productsById[p.product_id].name, key: productsById[p.product_id].key }
          : null,
      })),
    };
  } catch {
    return { entitlements: [], purchases: [], available: false };
  }
}

// ── Subscription cancellation (end-of-period, understandable) ─
export async function cancelSubscription(client, userId, key) {
  if (!client || !userId || !key) return { error: 'invalid' };
  try {
    const { data, error } = await client.rpc('cancel_monetization_subscription', {
      p_user: userId,
      p_key: key,
      p_immediate: false,
    });
    if (error) return { error: 'cancel_failed' };
    // Tell the provider to stop renewing (sandbox is a no-op).
    try {
      const driver = getPaymentProvider();
      await driver.cancelSubscription({ providerId: null, subscriptionId: key });
    } catch {
      // Provider cancel is best-effort; the DB cancel_at_period_end is truth.
    }
    // Revenue funnel event (MP24): transparent cancellation is good for
    // retention analysis — never a guilt trip, just the fact.
    recordGrowthEvent('subscription_cancelled', userId, { key }).catch(() => {});
    return { ok: Boolean(data) };
  } catch {
    return { error: 'cancel_failed' };
  }
}

// ── Creator payout request (MP24) ───────────────────────────
// Moves the creator's AVAILABLE balance into a pending payout request. No
// real money moves yet — payouts stay 'pending' until a compliant provider
// payout driver processes them. All guards (threshold, single open payout,
// owner-scope) are enforced inside the SECURITY DEFINER function.
export async function requestCreatorPayout(client, userId) {
  if (!client || !userId) return { error: 'unauthorized' };
  if (!isMonetizationEnabled()) return { error: 'disabled' };
  try {
    const { data, error } = await client.rpc('request_creator_payout', {
      p_user: userId,
      p_min_minor: REVENUE_SPLIT.payoutMinMinor,
      p_origin: getMonetizationEnv(),
    });
    if (error || !data) return { error: 'payout_failed' };
    return { ok: data.ok === true, result: data, error: data.ok ? null : (data.reason || 'payout_failed') };
  } catch (err) {
    console.error('[Monetization] Payout request error:', err?.message || err);
    return { error: 'payout_failed' };
  }
}

// ── Creator revenue (private, ledger-derived) ───────────────
// Only the creator's own verified earnings. Supporter identity is never
// returned — amounts and dates only.
export async function getCreatorRevenue(client, userId) {
  if (!client || !userId) return { available: false };
  try {
    const { data: balance } = await client
      .from('monetization_creator_balances')
      .select('earned_minor, pending_minor, available_minor, held_minor, paid_out_minor, reversed_minor, currency')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: payouts } = await client
      .from('monetization_payouts')
      .select('amount_minor, currency, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Recent purchases on the creator's OWN products (supporter ids stripped).
    const { data: sales } = await client
      .from('monetization_purchases')
      .select('amount_minor, currency, status, product_id, created_at')
      .eq('status', 'succeeded')
      .order('created_at', { ascending: false })
      .limit(100);

    // Only sales on products this user owns (RLS already enforces this, but
    // we re-derive the product names for display).
    const productIds = [...new Set((sales || []).map(s => s.product_id))];
    const namesById = {};
    if (productIds.length) {
      const { data: products } = await client
        .from('monetization_products')
        .select('id, name')
        .in('id', productIds);
      for (const p of products || []) namesById[p.id] = p.name;
    }

    const currency = balance?.currency || 'usd';
    return {
      available: true,
      testMode: getMonetizationEnv() !== 'prod',
      payoutMin: {
        amountMinor: REVENUE_SPLIT.payoutMinMinor,
        display: formatMoney(REVENUE_SPLIT.payoutMinMinor, currency),
      },
      revenueShare: {
        platformFeePct: REVENUE_SPLIT.platformFeePct,
        processingPct: REVENUE_SPLIT.processingPct,
        creatorNetPct: Math.max(0, 100 - REVENUE_SPLIT.platformFeePct - REVENUE_SPLIT.processingPct),
      },
      balance: {
        earned: balance?.earned_minor || 0,
        pending: balance?.pending_minor || 0,
        available: balance?.available_minor || 0,
        held: balance?.held_minor || 0,
        paidOut: balance?.paid_out_minor || 0,
        reversed: balance?.reversed_minor || 0,
        currency,
        earnedDisplay: formatMoney(balance?.earned_minor || 0, currency),
        availableDisplay: formatMoney(balance?.available_minor || 0, currency),
      },
      payouts: (payouts || []).map(p => ({
        amountMinor: p.amount_minor,
        currency: p.currency,
        display: formatMoney(p.amount_minor, p.currency),
        status: p.status,
        createdAt: p.created_at,
      })),
      sales: (sales || []).map(s => ({
        amountMinor: s.amount_minor,
        currency: s.currency,
        display: formatMoney(s.amount_minor, s.currency),
        status: s.status,
        createdAt: s.created_at,
        product: namesById[s.product_id] || null,
      })),
    };
  } catch {
    return { available: false };
  }
}