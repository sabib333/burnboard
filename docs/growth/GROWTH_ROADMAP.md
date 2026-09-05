# BurnBoard Growth — Roadmap

What exists, what this release added, what NOT to do, and the ordered next
steps.

---

## 0. Master Prompt 23 — Growth Engine (this release)

Closes the remaining gaps between the growth *foundation* (MP14/MP18) and a
complete, ethical growth *engine*:

**Added:**
- **Referral rewards (finally attached, activation-gated)** — `referral_rewards`
  ledger, `grant_eligible_referral_rewards` core logic, `sync_referral_rewards`
  (owner-scoped on-demand) and `sweep_referral_rewards` (service-role daily
  sweep wired into the cleanup cron). Rewards are 50 karma per ACTIVATED
  referral (strong first-value activity within 7 days of conversion),
  idempotent per visit, monthly-capped (10/month). Raw signups earn nothing.
- **User-facing invite hub** — `/invite` page (invite link, honest invite
  stats, transparent reward rules, recent rewards) + "Invite" link in the
  app header. The referral loop was previously API-only and invisible.
- **Fixed broken referral deep link** — invite URLs `/s/CODE` 404'd (the
  handler lived at `/api/s/CODE`). A middleware rewrite now serves the
  branded landing + server-side attribution cookie at the public URL.
- **Authentic public stats** — `/api/stats` (real aggregates only) and a
  rewritten `/stats` page. Removed the fabricated hardcoded numbers (fake
  social proof — a quality-gate violation).
- **Viral-loop measurement** — growth snapshot now includes share funnel
  (`shares.total7d`, `shares.byChannel`) and K-factor estimate
  (`virality.invitingUsers7d`, `virality.kFactorEstimate`).
- **Growth alerts** — `/api/growth/alerts` (retention cliff, activation
  drop, referral abuse, signup anomaly) surfaced in `/admin/growth`.
- **Docs** — `GROWTH_LOOPS.md` (loop wiring diagram, measurement, fraud
  controls) + this roadmap update.

**Deferred (intentionally):** rewards are karma-only for now (no cash/premium
credits until unit economics are proven); regional/language-specific reward
tiers; paid acquisition; market launches — all gated on activation/retention
evidence per the guardrails below.

---

## 1. What exists today

- **Referral system (MP14):** fraud-proof attribution, idempotent claims,
  post-signup continuation — rewards deliberately not granted yet.
- **Growth funnel events + experiments (MP14-era):** DB-backed experiments,
  exposure/conversion, guardrails, funnel metrics.
- **Sharing + SEO:** native share + clipboard, RLS-safe sitemap/robots, OG
  previews, share landing pages.
- **Onboarding/activation:** activation model, interests, next-best-actions.
- **Localization:** en/bn/hi via `lib/lang.js`.
- **MP18 additions:** growth analytics snapshot (signups, DAU/WAU/MAU,
  activation, cohort D1/D7/D30, referral quality, network density, creators,
  communities, regions, anomalies), daily snapshot persistence, admin growth
  dashboard (`/admin/growth`), locale capture at signup, `docs/growth/`.

## 2. What NOT to do (Section 68)

- ❌ Fake followers, fake installs, fake Communities, fake engagement, fake trends.
- ❌ Forced contact uploads; spam invitations; deceptive referral rewards; dark patterns.
- ❌ Optimize only daily screen time.
- ❌ Expand faster than moderation capacity.
- ❌ Spend heavily before retention exists.
- ❌ Copy Instagram/TikTok/Facebook mechanically — BurnBoard's loops must be
  native to its mechanics (Hot Seat, roasts, challenges, battles).

## 3. Ordered next steps

1. **Run the daily cleanup cron** (or `GET /api/growth/snapshot`) to persist
   the first growth snapshot; verify `/admin/growth` renders real numbers.
2. **Define activation targets** from the cohort data (current D1/D7/D30 +
   activation rate) and pick ONE activation experiment (e.g. onboarding
   order) through the experimentation platform.
3. ✅ **Referral rewards attached** to activated conversions (MP23) — now
   monitor reward quality: monthly cap hit rate, karma inflation vs content
   karma, and whether invited activated users retain beyond D7.
4. **Pick a Tier-2 market** (Bengali-speaking — product is already localized)
   and run the market playbook: creator seeding → campus/city community →
   campus Challenge → measure density + activation + safety.
5. **Regional trends** — add language-filtered trending (data layer:
   `ai_content_metadata.language`) when a second market shows density.
6. **Extend anomaly detection** — referral-abuse and regional cohort-cliff
   alerts once history accumulates (30+ snapshots).

## 4. Guardrails that never change

- Growth = value → connection → retention → contribution → sharing → network
  effect. No shortcuts, no fake metrics, no dark patterns.
- Safety, trust, privacy and blocking are authoritative — growth never
  overrides them.
- Every expansion stage is gated on measured activation, retention, density
  and safety readiness.