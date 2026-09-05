/**
 * BURNBOARD Monetization — Webhook Pipeline (Master Prompt 15)
 *
 * The ONLY path that turns real (or sandbox-verified) provider events into
 * purchases, entitlements, and creator earnings:
 *
 *   1. Signature verification (HMAC over the raw body, provider secret).
 *   2. Durable event ingestion (record_monetization_event) — idempotent at
 *      the database level: replaying a webhook is a no-op, never a
 *      double-credit.
 *   3. Purchase matching + amount cross-validation (a forged/idempotency-
 *      violating event can never promote a different amount).
 *   4. Fulfillment via the SECURITY DEFINER RPC (fulfill_monetization_purchase)
 *      which is the only writer that can promote pending → succeeded and
 *      create active entitlements / credit creator balances.
 *   5. A billing notification to the purchaser.
 *
 * Everything degrades to a safe refusal on any validation failure.
 */

import { computeSplits } from '@/lib/monetization/config';
import { getPaymentProvider } from '@/lib/monetization/providers';
import { notifyBilling } from '@/lib/notifications';
import { recordGrowthEvent } from '@/lib/experimentService';

function computePeriodEnd(billingInterval, from = new Date()) {
  if (billingInterval === 'month') {
    const d = new Date(from);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  }
  if (billingInterval === 'year') {
    const d = new Date(from);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString();
  }
  return null; // one-time purchases have no auto-renewal period
}

/**
 * Handle a verified provider webhook. `rawBody` must be the exact raw request
 * body bytes used for signature verification.
 */
export async function handleProviderWebhook({ client, provider, rawBody, signature }) {
  try {
    if (!client || !provider || !rawBody) {
      return { ok: false, reason: 'invalid_request' };
    }

    const driver = getPaymentProvider();
    if (driver.key !== provider) {
      return { ok: false, reason: 'unknown_provider' };
    }

    // 1) Signature verification.
    const verified = driver.verifyWebhook({ rawBody, signature });
    if (!verified) {
      return { ok: false, reason: 'signature_invalid' };
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: 'invalid_payload' };
    }

    // 2) Deterministic event mapping (provider-shaped in driver).
    const event = typeof driver.parseSandboxEvent === 'function'
      ? driver.parseSandboxEvent(body)
      : { eventType: body.event, providerReference: body.provider_reference, grossMinor: null, currency: null };

    if (!event.providerReference && !event.sessionId) {
      return { ok: false, reason: 'missing_reference' };
    }
    const eventId = `${event.eventType || 'event'}_${(event.providerReference || event.sessionId)}_${driver.key}`;

    // 3) Durable, idempotent ingestion. Replays return null → no-op.
    const { data: recordedId, error: recordErr } = await client.rpc('record_monetization_event', {
      p_provider: driver.key,
      p_event_id: eventId,
      p_payload: body,
    });
    if (recordErr || !recordedId) {
      return { ok: true, replayed: true };
    }

    // 4) Match the pending purchase by the provider session id.
    const { data: purchase } = await client
      .from('monetization_purchases')
      .select('id, user_id, product_id, price_id, amount_minor, currency, entitlement_key, status')
      .eq('provider_id', event.sessionId || event.providerReference)
      .eq('status', 'pending')
      .maybeSingle();

    if (!purchase || purchase.status !== 'pending') {
      return { ok: false, reason: 'no_pending_purchase' };
    }

    // 5) Amount cross-validation: the provider-reported gross must equal the
    //    pending purchase's price (defense against amount tampering).
    if (event.grossMinor != null && Number(event.grossMinor) !== Number(purchase.amount_minor)) {
      return { ok: false, reason: 'amount_mismatch' };
    }

    // 6) Determine the entitlement period from the purchased price interval.
    let periodEnd = null;
    try {
      const { data: price } = await client
        .from('monetization_prices')
        .select('billing_interval')
        .eq('id', purchase.price_id)
        .maybeSingle();
      periodEnd = computePeriodEnd(price?.billing_interval);
    } catch {
      // periodEnd stays null — one-time style grants still activate.
    }

    // 7) Centralized split policy (creator-tied products only matter; the
    //    platform premium has no owner so fees are informational).
    const splits = computeSplits(purchase.amount_minor);

    // 8) Fulfill via the only authorized writer.
    const { data: fulfilled, error: fulfillErr } = await client.rpc('fulfill_monetization_purchase', {
      p_purchase_id: purchase.id,
      p_event_id: recordedId,
      p_status: 'succeeded',
      p_provider_reference: event.providerReference || event.sessionId || null,
      p_period_start: new Date().toISOString(),
      p_period_end: periodEnd,
      p_metadata: {
        platform_fee_minor: splits.platformFeeMinor,
        processing_fee_minor: splits.processingFeeMinor,
        net_minor: splits.netMinor,
      },
    });

    if (fulfillErr || !fulfilled) {
      return { ok: false, reason: 'fulfillment_failed' };
    }

    // 9) Revenue funnel events (MP24, Section 87) — payment succeeded, and a
    //    distinct tip event when the product is a voluntary tip. Best-effort;
    //    analytics must never block fulfillment.
    let productType = null;
    try {
      const { data: product } = await client
        .from('monetization_products')
        .select('product_type')
        .eq('id', purchase.product_id)
        .maybeSingle();
      productType = product?.product_type || null;
    } catch {
      // Product type is informational only.
    }
    recordGrowthEvent('payment_succeeded', purchase.user_id, {
      product_id: purchase.product_id,
      product_type: productType,
      amount_minor: purchase.amount_minor,
      currency: purchase.currency,
    }).catch(() => {});
    if (productType === 'tip') {
      recordGrowthEvent('tip_sent', purchase.user_id, {
        amount_minor: purchase.amount_minor,
        currency: purchase.currency,
      }).catch(() => {});
    }

    // 10) Billing notification (deduped, preference-respecting).
    await notifyBilling({
      userId: purchase.user_id,
      title: '💳 Purchase complete',
      message: 'Your payment was verified and your access is now active. Thank you for supporting BurnBoard.',
      link: '/settings/billing',
      entityType: 'purchase',
      entityId: purchase.id,
    });

    return { ok: true, purchaseId: purchase.id };
  } catch (err) {
    console.error('[Monetization] Webhook error:', err?.message || err);
    return { ok: false, reason: 'internal_error' };
  }
}