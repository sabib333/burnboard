# Monetization Operations

## Financial observability (what /admin/financials shows)

| Check | Meaning | Action when non-zero |
| --- | --- | --- |
| Entitlement drift | succeeded purchase missing active entitlement | run `reconcile_monetization()`; correct via adjustments/audit — never silent edits |
| Stuck events | webhook events > 24h in received/processing | inspect `monetization_payment_events`; retry idempotently |
| Failed events | events stuck in failed | investigate payload; replays are safe (unique event gate) |
| Pending payouts | payouts not provider-confirmed | never mark paid without provider confirmation |
| Audit volume | financial actions in last 24h | baseline for anomaly detection |

Snapshot: `captureDailyRevenueSnapshot()` runs inside the daily cleanup
cron (idempotent per date) and is also exposed as
`GET /api/cron/revenue-snapshot` for standalone scheduling.

## Refunds & disputes

- Refunds **append** adjustment rows (`refund` / `dispute` / `reversal` /
  `correction` / `fee_change`) — history is never deleted or edited.
- Full refund → purchase `refunded`, entitlement `revoked`.
- Partial refund → purchase `partially_refunded`, access kept for the paid
  window.
- Creator balances are reversed by the net the creator earned (never more).
- `refund_monetization_purchase` is **service_role only** — regular users
  can never refund, and provider-confirmed chargebacks are the normal path.

## Payouts

States: `pending → held | processing → paid | failed | reversed`.

- Payouts are only ever marked `paid` after provider confirmation.
- `request_token` is unique — duplicate payout requests are impossible.
- Eligibility for payout (threshold, identity, fraud review) lives in the
  service layer; no payout driver moves real money until a compliant
  provider is wired in.

## Fraud & abuse controls (layered)

1. Self-purchase prevention at checkout (creator can't buy own product).
2. Origin isolation — sandbox transactions can never mix with real records.
3. Idempotent event intake — replays never double-credit.
4. Pricing caps — no unbounded creator-set prices.
5. Eligibility gate — only trusted accounts can create sellable products.
6. Reconciliation — drift is detected, not assumed away.
7. Audit log — every financial action is attributable (actor, target, why).

Future layers (roadmap): velocity checks, device fingerprinting,
self-dealing pattern detection, refund-abuse monitoring — all additive to
the ledger, never mutable balances.

## Provider failure handling

- Transaction state is never lost: purchases stay `pending`, events stay
  `received`; retries are idempotent.
- The unique `(provider, provider_event_id)` constraint prevents duplicate
  charges during retry storms.
- Reconciliation compares internal ledger vs provider records periodically.

## Compliance readiness (not legal advice)

- Regional pricing/tax is table-driven (`region` on prices, `scope` on
  configs) — no hard-coded single-country model.
- Payout restrictions / identity verification are future service-layer
  gates; nothing claims jurisdiction-specific compliance today.
- Sensitive financial tables have no client read/write policies — least
  privilege is the default posture.

## Currency & precision

- All money is integer minor units; never floats.
- Transaction/settlement/display currency separation is ready via the
  `currency` column on every financial table.