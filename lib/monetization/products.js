/**
 * BURNBOARD Monetization — Creator Product Service (Master Prompt 19)
 *
 * Creator-facing product management: subscriptions, digital products, and
 * paid communities. All writes go through SECURITY DEFINER RPCs with
 * centralized pricing caps — creators can never set unbounded prices, and
 * nothing goes live until an explicit activation step.
 *
 * Types:
 *   creator_subscription — recurring monthly/yearly membership
 *   digital_product     — one-time sale of a digital good
 *   paid_community      — recurring membership to a community
 *
 * The MP15 checkout/webhook/entitlement pipeline handles purchase flows;
 * this module only manages product configuration.
 */

import { getCreatorEligibility } from '@/lib/monetization/eligibility';

/**
 * List the caller's own creator products (all statuses, newest first).
 * Returns { available, products } or a safe degradation.
 */
export async function listCreatorProducts(client, userId) {
  if (!client || !userId) return { available: false, products: [] };
  try {
    const { data, error } = await client
      .from('monetization_products')
      .select('id, key, name, description, product_type, status, billing_text, feature_list, created_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    if (error) return { available: false, products: [] };

    return { available: true, products: data || [] };
  } catch (err) {
    console.warn('[Monetization] List products failed:', err?.message || err);
    return { available: false, products: [] };
  }
}

/**
 * Create a creator product with its initial price. Eligibility + pricing
 * caps are enforced inside the RPC — this function never trusts the client.
 */
export async function createCreatorProduct(client, userId, input) {
  if (!client || !userId) return { error: 'unauthorized' };
  if (!input?.name || !input?.priceMinor) return { error: 'missing_fields' };

  const elig = await getCreatorEligibility(client, userId);
  if (elig.available && elig.status !== 'eligible') {
    return { error: 'not_eligible' };
  }

  try {
    const { data, error } = await client.rpc('create_creator_product', {
      p_key: input.key || 'product',
      p_name: String(input.name).slice(0, 80),
      p_description: String(input.description || '').slice(0, 500),
      p_product_type: input.type || 'creator_subscription',
      p_billing_text: String(input.billingText || '').slice(0, 300),
      p_feature_list: Array.isArray(input.features) ? input.features : [],
      p_amount_minor: Math.round(Number(input.priceMinor) || 0),
      p_currency: input.currency || 'usd',
      p_billing_interval: input.interval || 'month',
    });
    if (error || !data?.length) {
      const rpcErr = data?.[0]?.error || error?.message || 'create_failed';
      return { error: rpcErr };
    }
    return { productId: data[0].product_id, priceId: data[0].price_id };
  } catch (err) {
    console.warn('[Monetization] Create product failed:', err?.message || err);
    return { error: 'create_failed' };
  }
}

/**
 * Activate a draft product (explicit, deliberate step — nothing goes live
 * by accident).
 */
export async function activateCreatorProduct(client, userId, productId) {
  if (!client || !userId || !productId) return { error: 'missing_product' };
  try {
    const { data, error } = await client.rpc('activate_creator_product', {
      p_product_id: productId,
    });
    if (error || data !== true) return { error: 'activation_failed' };
    return { ok: true };
  } catch (err) {
    console.warn('[Monetization] Activate product failed:', err?.message || err);
    return { error: 'activation_failed' };
  }
}