# Creator Monetization Eligibility & Product Setup

## Status model

```
not_eligible ──► in_progress ──► eligible
                     │
        under_review (manual review pending)
        restricted   (moderation/fraud — authoritative override)
        paused       (creator or platform initiated hold)
```

Creators see exactly one of these plus human-understandable reason codes
(`more_posts`, `more_followers`, `more_engagement`, `account_age`,
`account_restrictions`). **Internal thresholds, fraud signals, and
moderation criteria are never exposed** — they live only inside the
`get_creator_monetization_status` SECURITY DEFINER RPC.

## Configurable thresholds

`monetization_eligibility_config` table, `scope = 'global'` (editable by
admins without code changes):

| Key | Default | Meaning |
| --- | --- | --- |
| `min_account_days` | 14 | account age floor |
| `min_posts` | 3 | social posts created |
| `min_followers` | 5 | followers (no celebrity bar — emerging creators get a fair shot) |
| `min_engagement` | 10 | reactions on own posts |
| `max_restriction_count` | 1 | active restrictions tolerated before restricted status |

## Authoritative rules

1. **Moderation/fraud overrides activity math.** If active restrictions
   exceed the cap, status is `restricted` regardless of engagement.
2. **Manual overrides win.** `under_review`, `paused`, `restricted`, and a
   previously granted `eligible` all survive auto-recomputation (set via
   `user_profiles.monetization_status`).
3. **No fake control.** The status shown is the status enforced — products
   can only be created by `eligible` creators (checked inside the RPC).

## Creator products

Eligible creators create products via `create_creator_product` (SECURITY
DEFINER). Validation happens server-side:

- Types: `creator_subscription` | `digital_product` | `paid_community`
- Pricing capped by `monetization_product_caps` (default $1,000 max; env/
  table-tunable)
- Intervals: `one_time` | `month` | `year` (config-whitelisted)
- Name/key format validated; no unbounded lengths
- Product starts **draft**; an explicit `activate_creator_product` call
  (requiring at least one active price) is the only path to `active`

Nothing goes live by accident, and a half-configured product can never
surface in the public catalog or storefront.

## Storefront

`GET /api/creator/storefront?userId=<uuid>` returns only active products
with active prices — marketing data only. No earnings, no supporter
identity, no internal state. Entitlement gating (whether a buyer can access
exclusive content) is enforced server-side through
`check_entitlement` — never through the frontend.

## What the creator never sees

- Internal fraud scores or thresholds
- Supporter identities in revenue views (route layer strips them)
- Other creators' data
- "This will go viral" style promises — eligibility is factual, not
  promotional