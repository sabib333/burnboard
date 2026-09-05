# BurnBoard Social Layer

The social product — the follow graph, communities, conversations, notifications, and the
boundaries around them — ships in two layers: the **live application** (real tables, real RLS,
real enforcement) and the **measurement layer** that watches it honestly. This doc maps both
against the Master Prompt 28 quality gates.

## Relationship model

BurnBoard has one explicit, user-initiated person-to-person relationship: **follow** (one-way,
stored in `follows`). There is no auto-converted friendship: a "mutual" pair is two follows,
never an inferred social status. Relationship-adjacent state is also explicit:

| Relationship | Store | Semantics |
| --- | --- | --- |
| Follow / unfollow | `follows` | One-way, created and removed by the follower only. Unfollow deletes the row (no tombstone). |
| Block | `user_blocks` | **Mutual by design** — enforced server-side and in RLS-read paths (`hiddenAuthorIds`), removes follows in both directions, suppresses notifications, and refuses new follows. |
| Mute | `user_mutes` | One-directional, silent — hides content and suppresses notifications from the muted user; the muted user is never told. |
| Community membership | `community_members` | Explicit join with a real role (`owner`/`moderator`/`member`); roles are DB-enforced via definer helpers (`is_community_member`, `is_community_moderator`, `is_community_owner`). |

Nothing inferred is ever displayed as explicit: recommendation rails return truthful reason
strings ("Follows you", "Popular in a community you joined") and the feed filters on real
relationship state (blocks, mutes, private-community membership).

## What is real (preserved, not rebuilt)

Audited before this prompt was executed — all of these already exist and were left untouched:

- **Follow API** — `/api/follow` with layered rate limits, self-follow and mutual-block refusal
  (`relationshipBetween`), real follow/unfollow signals into the reco graph, follower milestones,
  and preference- + safety-gated new-follower notifications.
- **Communities** — membership + assignable roles, rules, curated topics, private visibility,
  moderator removal/detach RPCs (definer, DB-authoritative), real member lists and counts,
  community feeds over canonical `social_posts`, moderation state on all content.
- **Conversations** — threaded comments on posts/roasts with moderation state, replies,
  reactions, and a unified moderation/auto-review pipeline driven by distinct reporters
  (never raw volume).
- **Return loop** — a notification engine with per-type dedup windows, preference fields, and a
  definer safety gate (`safety_notify_allowed`) so muted/blocked actors can never notify.
- **Discovery** — "Suggested for you" (real mutual-follow suggestions), community discovery,
  creator discovery; people recommendations cannot recommend blocked users (blocks are
  mutual and consulted server-side).
- **Enforcement** — platform moderator RPCs, action-specific time-bounded restrictions, bans,
  appeals, and full audit rows in `moderation_actions` + `safety_events`.

## What Master Prompt 28 added

The gap was measurement: the graph, communities, and conversations ran rich but nothing
measured them. Added:

- **`lib/socialHealth.js`** — real-row aggregate probes: follow edges (24h/7d/30d), new-user
  social activation (first follow / first community / first post / first comment within 7 days
  of signup, on the newest-accounts cohort), follow-back reciprocity within that cohort,
  community joins/joiners/activity, conversation depth (reply share) vs one-tap reactions,
  notification delivery, and blocks/mutes.
- **`GET /api/admin/social`** — admin-gated (the MP26 fail-closed gate), service-key-only,
  aggregate-only, with computed directional alerts (activation low, graph idle, boundary-ratio
  high, conversation idle, community stagnation, silent return loop).
- **`/admin/social`** — Social Network Health dashboard in the admin console.
- **`docs/social/SOCIAL_HEALTH.md`** — measurement definitions, thresholds, and limits.

## Honest limits (schema-level)

- **Unfollows and community leaves are deleted rows** — net graph growth and community churn
  are not measurable from this schema.
- **Activation and reciprocity are bounded samples** of recent accounts / edges, always labeled
  as such — never presented as a census.
- **"Conversation quality" is proxied** by reply share of comments; there is no per-user
  satisfaction instrument yet (no surveys, no explicit feedback-loop UI beyond corrections).

## Future rails (documented, not built)

Friendships (request/approval), direct messaging, private/invite-only communities, community
events, collaborative projects, presence, and local/city networks are all deliberately deferred
until the product and moderation model justify them — see the Master Prompt 28 gates and the
scale stages in `docs/infrastructure/`.
