/**
 * BURNBOARD Monetization — Payment Provider Abstraction (Master Prompt 15)
 *
 * Application code must never talk to a payment provider directly. Every
 * financial integration flows through the provider registry here:
 *
 *   BURNBOARD PRODUCT → monetization services → PROVIDER DRIVER → provider
 *
 * A driver implements the ProviderDriver interface:
 *   - createCheckout({ purchaseRef, amountMinor, currency, description, ... })
 *       → { checkoutUrl, providerId, sessionId }
 *   - verifyPurchase({ providerId, sessionId })      // fetch authoritative
 *       → { succeeded, providerReference, grossMinor, currency } | throws
 *   - verifyWebhook({ rawBody, signature })          // signature validation
 *   - cancelSubscription({ providerId, subscriptionId })
 *   - refund({ providerId, purchaseId, amountMinor }) → { providerReference }
 *
 * Only `cc_sandbox` ships today — a deterministic dev/test driver behind a
 * hosted checkout page. Real providers (Stripe etc.) are config placeholders
 * in the registry; wiring one in is additive (new driver + env keys), never
 * a rewrite of product logic.
 *
 * ABSOLUTE RULE: sandbox driver refuses to run when MONETIZATION_ENV==='production'.
 */

import crypto from 'crypto';

import { PROVIDER_REGISTRY, ORIGIN, getMonetizationEnv, isSandbox } from '@/lib/monetization/config';

let cachedDriver = null;
let cachedDriverKey = null;

/**
 * Active provider for this deployment. Deterministic: one active provider
 * key across the whole environment (no per-request provider switching).
 */
export function getActiveProvider() {
  const configured = process.env.MONETIZATION_PROVIDER || 'cc_sandbox';
  const env = getMonetizationEnv();
  if (env === 'prod') {
    // In production only real providers are acceptable; fall back to
    // "unconfigured" (monetization surfaces report unavailable) otherwise.
    const entry = PROVIDER_REGISTRY[configured];
    if (entry && !entry.sandboxOnly) return configured;
    throw new Error('MONETIZATION: no production payment provider configured');
  }
  const entry = PROVIDER_REGISTRY[configured];
  return entry ? configured : 'cc_sandbox';
}

export function getPaymentProvider() {
  const key = getActiveProvider();
  const entry = PROVIDER_REGISTRY[key];
  if (!entry) throw new Error(`MONETIZATION: unknown provider "${key}"`);

  // Strict production guard — the sandbox driver can never touch prod records.
  if (entry.sandboxOnly && getMonetizationEnv() === 'prod') {
    throw new Error('MONETIZATION: sandbox provider is disabled in production');
  }

  if (cachedDriverKey !== key) {
    if (key === 'cc_sandbox') {
      cachedDriver = createSandboxDriver();
    } else {
      // Real providers are not implemented yet — the driver registry entry
      // exists so provisioning is additive. Throwing tells callers to
      // surface "monetization unavailable" instead of guessing.
      throw new Error(`MONETIZATION: provider "${key}" is not implemented yet`);
    }
    cachedDriverKey = key;
  }
  return cachedDriver;
}

export function providerAvailable() {
  try {
    getPaymentProvider();
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// Sandbox driver — BurnBoard Test Checkout
// ═══════════════════════════════════════════════════════════
// A fully self-contained checkout flow for dev/test: the checkout page is a
// local route (`/checkout/sandbox`) and the "webhook" is a local, signed
// callback (HMAC with MONETIZATION_WEBHOOK_SECRET). Behavior is deliberately
// deterministic so test flows are reproducible. Every resulting record is
// marked origin 'dev'/'test' and the UI shows a TEST MODE badge.

export const SANDBOX_BASE_URL = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function sandboxSecret() {
  // Default dev secret keeps local `npm run dev` flows working without env
  // setup; production refuses this provider entirely, so this default can
  // never leak into real money records.
  return process.env.MONETIZATION_WEBHOOK_SECRET || 'sb_dev_secret_change_me';
}

function createSandboxDriver() {
  return {
    key: 'cc_sandbox',
    origin: getMonetizationEnv(), // 'dev' or 'test' — never 'prod'
    isSandbox: () => true,

    async createCheckout({ purchaseRef, amountMinor, currency = 'usd', description = '', metadata = {} }) {
      const id = `sb_${purchaseRef.replace(/[^a-z0-9]/gi, '').slice(0, 24)}_${Date.now().toString(36)}`;
      return {
        checkoutUrl: `${SANDBOX_BASE_URL()}/checkout/sandbox?ref=${encodeURIComponent(purchaseRef)}&price=${amountMinor}&curr=${currency}&provider=${id}`,
        providerId: id,
        sessionId: id,
      };
    },

    async verifyPurchase({ providerId }) {
      // The sandbox checkout page simulates the card form; the actual state
      // transition is driven by the local signed webhook (see
      // app/api/monetization/webhook). Verification just confirms the ids.
      return {
        succeeded: false,
        pending: true,
        providerReference: providerId,
        grossMinor: null,
        currency: null,
      };
    },

    verifyWebhook({ rawBody, signature }) {
      // Local signed callback — HMAC-SHA256 over the raw body (same scheme a
      // real provider would use), producing `sb_<base64>`.
      const hmac = crypto
        .createHmac('sha256', sandboxSecret())
        .update(rawBody || '')
        .digest('base64');
      return Boolean(signature) && signature === `sb_${hmac}`;
    },

    async cancelSubscription() {
      return { ok: true };
    },

    async refund() {
      return { ok: true, providerReference: `sb_refund_${Date.now()}` };
    },

    // Deterministic event mapping for the local callback — mirrors what a
    // real provider's webhook would deliver so the pipeline is provider-shaped.
    parseSandboxEvent(body) {
      return {
        eventType: body?.event || 'checkout.completed',
        providerReference: body?.provider_id || null,
        sessionId: body?.session_id || null,
        grossMinor: body?.amount_minor ? Number(body.amount_minor) : null,
        currency: body?.currency || 'usd',
        customerUserId: body?.user_id || null,
      };
    },
  };
}