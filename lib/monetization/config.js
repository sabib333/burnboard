/**
 * BURNBOARD Monetization — Central Configuration (Master Prompt 15)
 *
 * All financial policy lives here so percentages/limits never scatter across
 * the app: revenue splits, feature flags, environment classification, and
 * provider registry keys. Money amounts are always integer minor units.
 */

import crypto from 'crypto';

// ── Environment classification (sandbox isolation) ──────────
// 'production' → real financial records (origin 'prod'); anything else is
// explicitly dev/test (origin 'dev' | 'test') so sandbox transactions can
// never mix with real money records.
export function getMonetizationEnv() {
  return process.env.MONETIZATION_ENV === 'production' ? 'prod' : 'dev';
}

export function isSandbox() {
  return getMonetizationEnv() !== 'prod';
}

export const ORIGIN = {
  PROD: 'prod',
  DEV: 'dev',
  TEST: 'test',
};

// ── Provider registry ───────────────────────────────────────
// Payment Provider Abstraction Layer: application code talks to this map;
// each driver is isolated behind the provider interface (see providers.js).
// Adding Stripe/PayPal/regional providers = adding a driver + env keys here —
// no app-wide rewrites.
export const PROVIDER_REGISTRY = {
  // 'cc_sandbox' is BurnBoard's built-in dev/test driver: hosted checkout
  // that mimics a card processor without touching real money. It is only
  // ever active when MONETIZATION_ENV !== 'production' — production refuses
  // to run it, so it can never process real financial records.
  cc_sandbox: {
    label: 'BurnBoard Test Checkout',
    sandboxOnly: true,
    requiredEnv: [],
  },
  // Future providers (configuration placeholders, not implemented):
  stripe: {
    label: 'Stripe',
    sandboxOnly: false,
    requiredEnv: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  },
  paypal: {
    label: 'PayPal',
    sandboxOnly: false,
    requiredEnv: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_SECRET'],
  },
};

// ── Revenue split policy (centralized) ──────────────────────
// Configured via env so it can be tuned operationally without deploys.
// These are PERCENTAGE points, applied to the gross creator-tied amount.
// This is the OFFICIAL policy — nothing in the app hardcodes a split.
export const REVENUE_SPLIT = {
  // Platform fee % on creator products (creator subscriptions, tips, paid
  // communities, digital products).
  platformFeePct: clampInt(process.env.MONETIZATION_PLATFORM_FEE_PCT, 15),
  // Payment processing drag % (estimated provider cost; future providers can
  // compute exact amounts).
  processingPct: clampInt(process.env.MONETIZATION_PROCESSING_PCT, 3),
  // Minimum net earnings before a creator can request a payout (minor units).
  payoutMinMinor: parseMinor(process.env.MONETIZATION_PAYOUT_MIN, 1000), // $10.00
};

function clampInt(value, fallback) {
  const n = parseInt(value, 10);
  if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
  return fallback;
}

function parseMinor(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ── Feature flags (staged rollout) ──────────────────────────
// Every monetization feature supports disabled → internal → beta → regional
// → global. Flags here gate both UI surfaces and server-side enforcement.
export function monetizationFeature(state) {
  const raw = process.env.MONETIZATION_FEATURES || '';
  const flags = raw.split(',').map(s => s.trim()).filter(Boolean);
  return flags.includes(state);
}

export function isMonetizationEnabled() {
  // Master switch: everything off unless explicitly enabled.
  return process.env.MONETIZATION_ENABLED === 'true';
}

// ── Product keys ────────────────────────────────────────────
export const PRODUCT_KEYS = {
  PREMIUM: 'premium',
  CREATOR_SUBSCRIPTION: 'creator_subscription',
  TIP: 'tip',
};

// ── Entitlement key derivation (stable, owner-scoped) ──────
// e.g. premium → 'premium'; creator_subscription → 'creator_sub:OWNER_ID'
export function entitlementKeyFor(productKey, ownerId = null) {
  if (productKey === PRODUCT_KEYS.CREATOR_SUBSCRIPTION && ownerId) {
    return `creator_sub:${ownerId}`;
  }
  return productKey;
}

// ── Money helpers ───────────────────────────────────────────
// Compute the official platform/processing split for creator-tied gross
// amounts (minor units). Centralized policy — never scattered in app code.
// Returns only non-negative integer amounts, net = gross − fees.
export function computeSplits(grossMinor) {
  const gross = Math.max(0, Number(grossMinor) || 0);
  const platformFeeMinor = Math.round((gross * REVENUE_SPLIT.platformFeePct) / 100);
  const processingFeeMinor = Math.round((gross * REVENUE_SPLIT.processingPct) / 100);
  return {
    grossMinor: gross,
    platformFeeMinor,
    processingFeeMinor,
    feeMinor: platformFeeMinor + processingFeeMinor,
    netMinor: Math.max(0, gross - platformFeeMinor - processingFeeMinor),
  };
}

export function formatMoney(minor, currency = 'usd') {
  const amount = (minor || 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

// ── Webhook signature verification ──────────────────────────
// HMAC-SHA256 over the RAW body with a per-provider shared secret.
// The signature carries no secret material, so a non-constant-time compare
// would only leak the hash itself — but we still use a timing-safe compare
// as defense in depth.
export function verifyWebhookSignature({ secret, rawBody, signature, expectedPrefix = 'sb_' }) {
  if (!secret) return false;
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');
  // Accept both bare base64 and `sb_<base64>` forms.
  const candidate = signature.startsWith(expectedPrefix)
    ? signature.slice(expectedPrefix.length)
    : signature;
  try {
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}