# BurnBoard Growth Operations

Experimentation, dashboards, fraud protection, unit economics and the growth
operating system that turns hypotheses into measured decisions.

---

## 1. Growth metrics (Section 52)

Tracked in the [admin growth dashboard](/admin/growth) + `/api/growth/analytics`:

| Area | Metrics (real data) |
| --- | --- |
| Acquisition | signups total / 7d / 30d (`auth.users`) |
| Activation | activated users (7d) + activation rate vs 7d signups |
| Retention | weekly cohort D1/D7/D30 return rates (`rec_events`) |
| Referral | visits, conversions, conversion rate, activated conversions |
| Virality | share funnel events (`growth_events`) + referral quality |
| Creator growth | active creators (7d) |
| Community growth | total / new (7d) / active (7d) |
| Regional growth | locale distribution (`user_profiles.locale`) |
| Safety | report rates (existing moderation dashboards) |
| Cost | infra cost monitoring (docs/infrastructure) + AI cost (`ai_usage_log`) |

**Never hide negative metrics** — the dashboard shows raw numbers, including
cohorts that decline.

## 2. Growth experimentation

Every growth hypothesis is testable via the experimentation platform
(DB-backed experiments + variant assignment + exposure/conversion +
guardrails):

1. Hypothesis (what, who, why, metric).
2. Control vs treatment with percentage rollout.
3. Decision rule (primary metric + guardrails) defined BEFORE launch.
4. Ship → measure → learn → scale or kill.

**No random growth changes without measurement.** Guardrail thresholds
(error/bounce/dismiss rates) auto-stop an experiment that hurts core UX.

## 3. Referral fraud protection

Already in place (MP14) and preserved: opaque codes, first-party cookie
attribution (no cross-site tracking), SECURITY DEFINER claim logic that is
self-referral-proof and token-forgery-proof, idempotent claims, rate-capped
visits. Quality gate for any future rewards: **rewards attach to activated +
retained referrals, never raw signups** — preventing fake-referral farming.
Growth fraud defenses also include the existing rate limiting + IP hashing +
bot controls; signup spikes are surfaced by the anomaly detector.

## 4. Paid growth discipline

Do not scale paid acquisition until: activation is measured, retention is
acceptable, attribution works, fraud controls exist, and unit economics are
understood. **Never buy vanity users** — paid traffic is only a multiplier
for loops that already work organically.

## 5. Unit economics

Track: acquisition cost, activation cost, retained-user cost, creator
acquisition cost, referral cost, infrastructure cost per active user.
**Never optimize acquisition without considering retention** — a cheap
signup that churns at D1 is a loss.

## 6. Anomaly detection

The snapshot RPC flags **signup spikes** (>3x the 21-day baseline, verified
as real traffic vs bots). Extend with: referral abuse (conversion-rate
outliers), regional retention collapse (cohort cliffs per locale), creator
churn, community collapse — as history accumulates.

## 7. Growth accounting & attribution

Separate acquisition into organic / referral / creator-driven /
community-driven / search / direct / paid / unknown. Referral attribution is
first-party and fraud-proof; other channels are bucket estimates from growth
events. **Never attribute everything to last click.**

## 8. Growth operating system

OBSERVE → FORM HYPOTHESIS → PRIORITIZE → EXPERIMENT → MEASURE → LEARN →
SCALE → REPEAT. Data replaces intuition; the dashboard + experiments are the
loop's instruments.

## 9. 100M+ expansion stages

1. Product-market fit → 2. Dense early communities → 3. Repeatable growth
loops → 4. Multi-market expansion → 5. Global creator network → 6. Regional
network effects → 7. 100M+ scale. **Do not skip stages** — each gate is the
measured prerequisite for the next (activation, then retention, then density,
then loops, then markets).

## 10. Recommended global sequence

1. Strongest organic use cases → 2. strongest user segment → 3. meaningful
activation → 4. retention → 5. dense communities → 6. creator loops → 7.
validate sharing → 8. validate referral quality → 9. one repeatable market →
10. document learnings → 11. similar markets → 12. localize → 13. regional
creator density → 14. international → 15. repeat. Evidence before scale,
always.