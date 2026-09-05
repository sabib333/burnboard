# BurnBoard Growth — Network Effects, Localization & 100M+ Expansion

Master Prompt 18 documentation. The growth philosophy: **don't optimize for
signups — optimize for activated → connected → retained → contributing →
inviting users.** Growth comes from product value, not advertising.

## Documents

| Document | Covers |
| --- | --- |
| [GROWTH_MODEL.md](./GROWTH_MODEL.md) | North Star metric, global funnel, activation definition, first-session value, connection loop, network density, referral quality, viral coefficient, network effect types & measurement, liquidity/seeding |
| [MARKET_EXPANSION.md](./MARKET_EXPANSION.md) | Market selection framework, launch tiers, market launch playbook, campus & city playbooks, community seeding, creator acquisition & ambassadors, safety readiness, cultural fit |
| [LOCALIZATION.md](./LOCALIZATION.md) | i18n architecture (en/bn/hi), language management, multilingual onboarding, local discovery, regional trends, locale capture |
| [GROWTH_OPS.md](./GROWTH_OPS.md) | Growth experimentation, metrics & dashboards, referral fraud protection, paid discipline, unit economics, anomaly detection, growth operating system, 100M+ expansion stages |
| [GROWTH_LOOPS.md](./GROWTH_LOOPS.md) | Wiring diagram of every growth loop (content, referral, challenge, battle, community, creator), how each is measured, and the fraud/abuse controls that keep them honest |
| [GROWTH_ROADMAP.md](./GROWTH_ROADMAP.md) | What exists, what this release added, what NOT to do, next steps |

## What exists today (audit summary)

- **Referral system (MP14):** opaque codes, first-party cookie attribution,
  SECURITY DEFINER RPCs, self-referral-proof, idempotent claims, post-signup
  continuation.
- **Growth funnel events:** `growth_events` taxonomy + funnel metrics
  (`lib/experimentService.js`).
- **Experimentation (MP14-era):** DB-backed experiments, variant assignment,
  exposure/conversion, guardrails.
- **Sharing:** `lib/share.js` (native + clipboard), share pages (`/r/[id]`,
  `/s/[code]`), OG previews.
- **SEO:** RLS-safe `sitemap.js` + `robots.js` (public profiles, posts,
  communities only).
- **Localization:** `lib/lang.js` — en/bn/hi with English fallback.
- **Onboarding / activation:** `lib/onboarding.js` activation model, next-best-
  action recommendations, interests.

## What this release added (Master Prompt 23)

- **Referral rewards, activation-gated** — `referral_rewards` ledger + RPCs
  (`sync_referral_rewards`, `sweep_referral_rewards` in the daily cleanup
  cron). 50 karma per ACTIVATED referral (never raw signups), idempotent per
  visit, monthly-capped, self-referral-proof.
- **User invite hub** — `/invite` page + header "Invite" link: invite link,
  real invite stats, transparent reward rules. The referral loop was
  previously API-only.
- **Fixed referral deep links** — `/s/CODE` invite URLs now serve the
  branded landing + attribution cookie via a middleware rewrite (they 404'd
  before; the handler was stranded at `/api/s/CODE`).
- **Authentic public stats** — `/api/stats` real aggregates + rewritten
  `/stats` page (fabricated numbers removed — no fake social proof).
- **Viral-loop measurement** — snapshot now reports the share funnel and a
  K-factor estimate (direction indicator only).
- **Growth alerts** — `/api/growth/alerts` (retention cliff, activation
  drop, referral abuse) surfaced in `/admin/growth`.
- **Docs** — `GROWTH_LOOPS.md` + roadmap update.

## What this release added (Master Prompt 18)

- **Growth analytics foundation** — `compute_growth_snapshot()` SQL RPC over
  REAL tables: signups, DAU/WAU/MAU, activation rate, weekly cohort retention
  (D1/D7/D30), referral quality, network density, creators, communities,
  regions, anomaly detection (signup spikes).
- **Daily snapshots** — `growth_daily_snapshot` table persisted by the cleanup
  cron (idempotent per date, 400-day retention) for cohort history.
- **Endpoints** — `/api/growth/analytics` (dashboard JSON, cron/admin
  protected) and `/api/growth/snapshot` (capture, cron protected).
- **Admin growth dashboard** — `/admin/growth` (password-gated, read-only):
  North Star stats, activation, cohorts table, referral quality, network
  density, regions, signup-history chart, anomalies.
- **Locale capture** — `user_profiles.locale` (en/bn/hi from Accept-Language
  at auth callback, fail-soft) powering regional analytics.
- **Docs** — this set.

## Golden rules

1. No fake activity, fake followers, fake trends, or dark patterns — ever.
2. Growth must not outpace moderation capacity or safety readiness.
3. Referral rewards must reward retained/activated referrals, never raw signups.
4. No contact uploads required; invitations require user intent; no spam.
5. SEO must respect privacy (RLS-filtered public pages only).
6. Paid acquisition scales only after activation, retention, attribution and
   fraud controls are proven.
7. Measure everything with cohorts — never hide negative metrics.