# BurnBoard Monetization Architecture

## Domains (modular, not one giant "payment system")

```
CREATOR EARNINGS      — ledger-derived balances, payout states
SUBSCRIPTIONS         — platform premium + creator subscriptions
TIPS / SUPPORT        — voluntary one-time support
DIGITAL PRODUCTS      — one-time digital goods
PAID COMMUNITIES      — recurring community membership
CREATOR STOREFRONT    — what a creator sells, transparently
PAYOUTS               — withdrawal lifecycle, provider-confirmed
BILLING               — checkout, webhooks, entitlements
REVENUE ANALYTICS     — aggregate ledger-derived metrics
FRAUD & RISK          — layered detection, holds, review
DISPUTES & REFUNDS    — adjustment-led, never silent
```

Each domain owns its tables/RPCs; none depends on another domain's
internals. This is the boundary set for future service extraction — no
domain is a microservice today.

## The financial truth chain

```
CLIENT (checkout intent only)
  ↓  pending purchase row (status enforced 'pending' at insert)
PROVIDER (hosted checkout)
  ↓  verified webhook event (signature over raw body)
EVENT INTAKE (record_monetization_event — idempotent, unique per event)
  ↓
FULFILLMENT (fulfill_monetization_purchase — pending→succeeded only,
             entitlement activation, creator earnings credit)
  ↓
LEDGER (append-only purchases + adjustments)
  ↓
DERIVED (balances, revenue analytics — computed, never stored mutable)
```

Clients can never write a 'succeeded' row, can never edit an amount, and
can never see internal event/audit tables (no read policy at all).

## Payment provider abstraction

```
PRODUCT → monetization services → PROVIDER DRIVER → provider
```

- `lib/monetization/providers.js` — registry + active-provider resolution.
- `cc_sandbox` — built-in dev/test driver; **refuses to run when
  `MONETIZATION_ENV === 'production'`**.
- `stripe` / `paypal` — config placeholders; wiring one in is a new driver +
  env keys, never an app rewrite.
- Webhooks verify HMAC signatures over the raw body (timing-safe compare).

## Revenue streams (prioritized, not all active)

| Stream | Status | Notes |
| --- | --- | --- |
| Platform Premium | seeded catalog (MP15) | $4.99/mo, $39.99/yr |
| Creator subscriptions | creator-created (MP19) | monthly/yearly, capped pricing |
| Tips | auto-provisioned (MP15) | $1/$3/$5/$10, self-purchase blocked |
| Digital products | creator-created (MP19) | one-time, capped pricing |
| Paid communities | creator-created (MP19) | recurring membership |
| Brand marketplace / ads | **not built** | requires liquidity; see roadmap |

## Revenue split (centralized in config)

`MONETIZATION_PLATFORM_FEE_PCT` (default 15) and
`MONETIZATION_PROCESSING_PCT` (default 3) are applied to gross at
fulfillment; gross + fees are recorded verbatim in purchase metadata, net
is what credits the creator balance. Split policy lives in
`lib/monetization/config.js` — nothing in app code hardcodes a split.

## Phased rollout (from the master prompt)

- **Phase 1** — analytics, eligibility, monetization foundation → **done (MP15+19)**
- **Phase 2** — subscriptions, tips, digital products → **foundation done; provider + UI remaining**
- **Phase 3** — paid communities, creator stores, promotion → schema done; rollout gated
- **Phase 4** — brand marketplace → design only
- **Phase 5** — advertising platform → design only

Every phase is behind `MONETIZATION_ENABLED` and `MONETIZATION_FEATURES`
flags. Nothing activates globally without a staged rollout.

## Feature flags

- `MONETIZATION_ENABLED=true` — master switch (everything off by default).
- `MONETIZATION_ENV` — `production` vs dev/test (sandbox isolation).
- `MONETIZATION_PROVIDER` — active provider key.
- `MONETIZATION_FEATURES` — comma list of enabled surface states
  (e.g. `subscriptions,tips,digital_products`).
- `MONETIZATION_PLATFORM_FEE_PCT`, `MONETIZATION_PROCESSING_PCT`,
  `MONETIZATION_PAYOUT_MIN` — policy knobs, env-tunable.

## Scale posture

- Async + idempotent everywhere: event intake, fulfillment, snapshots.
- Ledger rows are append-only → partitionable by `created_at` later.
- Revenue snapshots are aggregate-only; no user-level data leaves the DB.
- Financial observability catches drift (missing entitlements, stuck
  events, duplicate successes) before it becomes a user-facing problem.