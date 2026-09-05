# BurnBoard Growth Model

North Star, funnel, activation, retention cohorts, network effects and the
measurement that decides every growth decision.

---

## 1. North Star metric

**Weekly Active Users who receive or create meaningful value.** Operationally
approximated with the measurable pieces:

- **WAU** — distinct users with server-validated activity (`rec_events`,
  which records follows, reactions, comments, shares, joins, votes,
  participation) in the last 7 days.
- **Activation rate** — share of new users who hit a strong first-value event
  (follow, join a community, react, comment, share, participate in a
  challenge, vote in a battle, or create content) within their first week.
- **DAU/MAU** — engagement depth (a proxy for "return value", not time spent).
- **Contributing users** — creators active in the last 7 days (content
  authors).
- **Inviting users** — users whose referral links produced activated,
  retained signups.

Supporting: D1/D7/D30 cohort retention, creator retention, community
participation, content creation, shares, successful referrals, follow
relationships. **No single metric is optimized blindly** — the flywheel is
value → retention → network value → sharing → new users → more network value.

## 2. The global growth funnel

```
DISCOVERY → LANDING → SIGNUP → ONBOARDING → ACTIVATION → CONNECTION → RETURN → CONTRIBUTION → SHARING → REFERRAL
```

Measured stages (data source):
- Landing/viewed → `growth_events` (`landing_viewed`, `primary_cta_clicked`)
- Signup → `auth.users.created_at`
- Activation → strong `rec_events` / content created (see §3)
- Connection → `follows` (+ counts per active user)
- Return → cohort retention (D1/D7/D30) from `rec_events` after signup
- Contribution → active creators (social_posts authors, 7d)
- Sharing → `shares` rows + `growth_events` share funnel
- Referral → `referral_visits` → `converted_at` → activated/retained

Drop-off at every stage is measured (see the admin growth dashboard); a
bottleneck in activation is not fixed by buying more traffic.

## 3. Activation definition

Activation is **never "account created."** A user is activated when they
experience real value, e.g. any of:

- Follows a relevant person (`user_followed`)
- Joins a Community (`community_joined`)
- Interacts with content (react / comment / share)
- Receives personalized feed value (implied by engagement)
- Creates first content (social_post / roast)
- Participates in a Challenge or Battle

Personalized paths: creators, community users, content consumers,
competitive users and challenge participants activate through different
actions — the product must not force one journey (onboarding already offers
interest selection + discovery-first options).

## 4. First session

Answers "What can I do here?" and "Why come back?": relevant feed content,
interest selection, quick first interaction, contextual next-best-actions
(`lib/recommendations.js`) and a clear creator/consumer choice — without
overwhelming steps. `lib/onboarding.js` tracks NEW → EXPLORED → PARTICIPATED
→ ACTIVATED → VIRAL READY.

## 5. The connection loop

USER JOINS → DISCOVERS PEOPLE → FOLLOWS → SEES ACTIVITY → INTERACTS →
RECEIVES RESPONSE → FORMS CONNECTION → RETURNS. Relationship formation is a
first-class growth lever; the metric is connections per active user and
mutual interaction — not passive scrolling.

## 6. Network density

Measured as follows per active user (30d) and total follow relationships.
**A smaller dense network retains better than a large disconnected one** —
density is tracked alongside raw size, and community overlap is part of
discovery (affinity + joined-community candidate pools).

## 7. Referral quality

The referral system (MP14) records visits and conversions server-side
(fraud-proof). Quality metrics (added in MP18):

- Visits (7d), conversions (7d), conversion rate
- **Activated conversions** — converted users with strong activity within
  7 days of conversion (this is the metric rewards should attach to, not raw
  signups)

**Optimize retained referrals, not maximum invitations.**

## 8. Viral coefficient & share conversion

Viral coefficient = average invitations × conversion × activation quality ×
retention quality — a direction indicator, never the only success metric.
Share conversion chain: shared → viewed → clicked → landing engagement →
signup → activation → retention. Every share must land on a real, fast,
context-rich page (see share pages) — never an empty page.

## 9. Network effect types

| Effect | Mechanism | Measured by |
| --- | --- | --- |
| Social | friends/creators make the product more valuable | follows, mutuals, density |
| Content | more content improves discovery | content supply, discovery success |
| Community | more members improve interaction | community activity |
| Creator | more audience attracts creators; more creators attract audience | creator retention + audience growth |
| Data/personalization | more high-quality signals improve recommendations | rec_events volume, recommendation quality |

Not all loops activate simultaneously — each is tracked separately, and
**network effects are never claimed without evidence**.

## 10. Liquidity & seeding

Empty Feed / empty Communities / no relevant creators kill retention. Before
market expansion, ensure content liquidity: seed with real creators,
community leaders, early users, relevant content and challenges. **Never fake
accounts, fake engagement, or fake trends** — the growth snapshot measures
creators, communities and content supply so liquidity gaps are visible
before they bite.