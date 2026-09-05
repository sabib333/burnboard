# Monetization Roadmap

## Master Prompt 24 — what this release added

Closed the remaining creator-economy + revenue-trust gaps on top of the
MP15/MP19 foundation:

- **Creator payout requests** — `request_creator_payout` (owner-scoped,
  minimum threshold, single-open-payout, audited, ledger-consistent),
  `POST /api/creator/revenue`, and a payout request panel with transparent
  eligibility messaging in the Creator Studio Revenue tab.
- **Revenue-share transparency** — the Creator Studio now shows the exact
  centralized split (creator net %, platform %, processing %) and the payout
  minimum. Fees are never hidden (Section 9/10).
- **Revenue funnel events** — `payment_started` / `payment_succeeded` /
  `subscription_cancelled` / `tip_sent` / `upgrade_started` are recorded
  (server-verified where possible) and join the growth funnel, so revenue
  is analyzed with the user journey, never in isolation (Section 87).
- **Ad honesty** — removed the fabricated "thousands of tech founders"
  reach claim from AdSlot; only real profile counts are shown, and
  `ad_impression` events are tracked (Sections 19–23).
- **Docs** — `REVENUE_MODEL.md` (layers, free core, creator economy,
  payouts, ad governance, ethics, scale roadmap) + this roadmap update.

Deferred (intentionally, per the roadmap below): real payment provider,
paid-community content gating, brand marketplace, advertising platform,
regional pricing — each gated on liquidity, evidence, or compliance.

## Where we are

Phases 1–2 foundation is complete (MP15 + MP19): ledger, entitlements,
provider abstraction, sandbox, tips, creator eligibility, creator product
creation, revenue analytics, financial observability, user purchase
history. The **money does not move yet** in production by design — the
sandbox driver refuses production, and no real provider is wired in.

## Phase 2 (next): real money, safe rollout

1. Wire a real provider (Stripe first) — add driver + env keys, no app
   rewrites (provider abstraction exists).
2. `MONETIZATION_ENV=production` + `MONETIZATION_PROVIDER=stripe` behind
   feature flags.
3. Internal cohort → percentage rollout → regions.
4. Watch refund rate, dispute rate, fraud, and creator adoption — not just
   revenue (see metrics below).

## Phase 3: paid communities + creator stores

Schema and creation flows exist. Remaining: membership access UI, content
gating enforcement (entitlement checks in post visibility), and promotion
(labeling required — paid ≠ organic, ever).

## Phase 4: brand marketplace

Do not build before liquidity. Signals to watch: creator density, audience
quality, demand evidence. Every campaign requires explicit creator
acceptance; sponsored content is labeled.

## Phase 5: advertising platform

Do not build before marketplace learnings. Organic ranking and paid
placement stay **fully separated**; ads pass policy/fraud/landing checks;
targeting is cohort-based and never exposes private identity.

## Metrics that matter (never revenue alone)

- Creator adoption & retention (D30 creator retention)
- Refund rate, dispute rate, fraud losses
- Revenue retention (repeat purchases / subscription renewal)
- User satisfaction (hide rate, negative feedback)
- Payout completion rate and latency
- Unit economics: cost per active user, revenue per active user

## Non-goals (explicitly deferred)

- AI-controlled payouts (AI assists insights only — never financial
  authority)
- Hidden paid ranking / undisclosed sponsored content
- Unregulated financial products, crypto speculation
- Fake earnings displays or fake advertiser metrics
- Marketplace launch before liquidity exists