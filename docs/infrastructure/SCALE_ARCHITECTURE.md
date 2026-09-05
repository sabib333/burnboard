# BurnBoard Scale Architecture

Current-state audit, module boundaries, staged growth plan, and the scaling strategy for
every high-traffic domain. This is the architectural map that lets BurnBoard grow from a
small community to a global platform without rewriting the foundation.

---

## 1. Current state (audit summary)

| Area | Current implementation | Scale-readiness |
| --- | --- | --- |
| Compute | Next.js 14 App Router on Vercel, serverless functions | Stateless by default → horizontally scalable ✅ |
| Database | Supabase Postgres (single instance, RLS enforced) | Indexed for 1M+; single-writer (fine at Stage A/B) |
| Cache | In-memory per-instance (`lib/cache.js`, TTL + SWR) | Per-instance only — no cross-instance coherence (fine now, documented) |
| Rate limiting | In-memory sliding window (`lib/serverRateLimit.js`) + DB-backed IP checks | Per-instance — must become shared (Upstash/Redis) before multi-instance abuse is a risk |
| Background jobs | Vercel cron + Postgres queue tables (`notification_queue`) + batch RPCs | Reliable pattern; improved in `2026_09_08_scale_reliability.sql` |
| Search | Postgres queries (ILIKE / filters) via API routes | OK to ~1M rows; separate search engine (pg_search / Meilisearch / Typesense) is the Stage B upgrade path |
| Real-time | Supabase Realtime + polling fallback | Scales with Supabase; connection count is managed by Supabase, not the app |
| Media | Images unoptimized (`next.config.js`), OG image endpoint | Object storage + CDN is the Stage B path |
| Observability | Structured logs (`lib/logger.js`), `/api/health`, `@vercel/analytics`, `/api/metrics` | Solid foundation; add external ingestion (Axiom/Logtail) at Stage B |
| Email / push | Resend + FCM batch multicast | Fine; batch token fetch fixed in this release |
| Payments | `lib/monetization/` (Stripe-style checkout/webhooks) | Isolated module; webhook verification is required, capacity is separate from feed traffic |

### Verified working (must never be broken by scale work)

Auth (Supabase SSR + middleware refresh), profiles, For You feed, Following feed, roasts,
reactions, comments, follows, communities, challenges, battles, search, explore,
notifications, creator dashboard/analytics, growth systems (referrals, shares), sharing,
monetization/entitlements, Trust & Safety (moderation, blocking, privacy).

---

## 2. Module map (modular monolith)

The codebase is already organized as a modular monolith. Each `lib/` domain is a module
with clear ownership; API routes are thin adapters. This is the foundation for eventual
service extraction — modules are extracted only when traffic/ownership/failure isolation
justifies it, never for fashion.

| Module | Code | Extraction candidate |
| --- | --- | --- |
| Auth / sessions | `middleware.ts`, `lib/routeAuth.js`, `lib/supabase/` | Never extract (stays with gateway) |
| User / profile | `lib/social/profile.js`, `lib/social/index.js` | No |
| Social graph (follows, blocks) | `lib/social/follows.js`, `lib/safety.js` | Yes (Stage C: high read/write) |
| Content (posts, roasts, reactions, comments) | `lib/social/content.js`, `lib/social/reactions.js` | No |
| Feed (Following / For You / Trending) | `lib/reco/feedBuilder.js`, `lib/reco/viewer.js`, `app/api/feed/route.js` | **Yes — Stage B/C (highest QPS)** |
| Recommendations | `lib/reco/` (signals, items, discovery, config) | Yes (Stage C: ranking workers) |
| Search | `app/api/search/*`, `app/api/explore/*` | Yes (Stage B: dedicated engine) |
| Communities | `lib/communities.js`, `app/api/communities/*` | No |
| Challenges & battles | `lib/challenges.js`, `app/api/challenges/*`, `app/api/battle/*` | No |
| Notifications | `lib/notifications.js`, `notification_queue`, `/api/process-notifications`, `/api/notify` | **Yes — Stage B (already queue-backed)** |
| Moderation / Trust & Safety | `lib/safety.js`, `lib/moderationService.js`, `app/api/safety/*`, `app/api/report/*` | No (must stay authoritative) |
| Monetization | `lib/monetization/*` (billing, providers, webhook), `app/api/monetization/*` | **Yes — Stage B (isolation + independent capacity)** |
| Analytics | `lib/analytics.js`, `lib/creator/*`, `app/api/creator/*` | Yes (Stage B: separate ingestion) |
| Growth | `lib/growth/*`, `lib/referral*`, `lib/share.js`, `app/api/referral/*` | No |
| AI / roast generation | `lib/aiService.js`, `lib/roastGenerator.js`, `app/api/ai/*` | Yes (Stage C: rate-limited external calls) |
| Experiments / feature flags | `lib/experiments.js`, `lib/featureFlags.js` | No |

**Extraction rule (Section 4 of the master prompt):** extract a service only when at least
two of these are true — independent scaling need, failure isolation benefit, team
ownership, deployment cadence. Feed, notifications, search, monetization and analytics
are the only candidates on the current horizon.

---

## 3. Staged scale plan

### Stage A — Early Product (1K–100K users) ← **WE ARE HERE**

Already in place:

- Modular Next.js app, single Postgres, RLS security, object-storage-ready media (none stored in DB),
  CDN via Vercel, basic per-instance cache, background jobs via cron + Postgres queue,
  monitoring via `/api/health`, `/api/metrics`, structured logs.

### Stage B — Product Growth (100K–1M+ users)

Add **only when measured** (see [OBSERVABILITY.md](./OBSERVABILITY.md) for the metrics that
trigger these):

1. **Shared cache + shared rate limiting** — replace per-instance `lib/cache.js` /
   `lib/serverRateLimit.js` backends with Redis (Upstash) when multiple concurrent
   instances make per-instance limits incoherent. Keep the same API so call sites don't change.
2. **Read replicas** — Supabase read replicas for read-heavy endpoints (public feeds,
   profiles, trending) once primary CPU/latency says so.
3. **Dedicated search** — pg_search (Postgres-native, no new infra) first, then
   Meilisearch/Typesense when PG search proves insufficient.
4. **Queue scaling** — `notification_queue` already batches; add worker retries with
   exponential backoff + dead-letter visibility (attempts column) when failures are observed.
5. **Analytics separation** — ship analytics events to a queue (same `notification_queue`
   pattern or Postgres `analytics_events` table processed by cron) instead of
   localStorage + console.
6. **Object storage** — move uploads to Supabase Storage / S3-compatible bucket with CDN,
   async derivative generation (thumbnails) via queue.

### Stage C — Large Scale (1M–10M+ users)

- Extract **feed** and **notifications** into independently scaled services behind the same
  API contract (the API layer is already thin adapters, so this is a deployment move, not a rewrite).
- Time-based partitioning for `notifications`, analytics/activity tables.
- Dedicated recommendation/ranking workers (offline candidate precompute, online fallback).
- Regional delivery optimization (edge caching of public pages, share previews).

### Stage D — Global Platform (10M–100M+ users)

- Multi-region deployment (Vercel regions), regional CDN edges, failover.
- Data replication strategy with **explicit consistency boundaries** — see §7.
- Independent high-volume services (feed, search, notifications) with global observability.

### Stage E — Extreme Scale (100M+ → billion)

Only when justified by actual traffic. Candidate timeline: read replicas → regional
primary/read topology → sharding of user-scoped tables → event streaming. Never "because
Kafka sounds scalable".

---

## 4. Feed scaling strategy

Separate feed types conceptually (already done in `app/api/feed/route.js` + `lib/reco/feedBuilder.js`):

| Feed | Current | Scale path |
| --- | --- | --- |
| Following | Fan-out **on read** — query posts by followed IDs with cursor pagination | Hybrid fan-out at Stage C: precompute inbox fragments for normal users, read-time aggregation for high-fanout creators |
| For You | Candidate generation → eligibility → safety → scoring → diversity, all in-request | Move candidate generation + ranking to a **background worker** at Stage B/C; cache ranked fragments per user (short TTL); graceful fallback to generic ranking on failure (already implemented) |
| Trending | Engagement × time-decay over `roasts`/`social_posts` | Precompute in cron (already cached 15s); compute is bounded by indexed time windows |
| Community / Topic / Profile | Filtered queries | Add composite indexes as measured; cache hot community feeds |

**Never** run the full personalized pipeline synchronously for every request at scale.
The architecture already separates candidate generation from ranking; the next step is
moving it off the request path entirely.

## 5. High-fanout (celebrity) users

- **Never fan out synchronously** to millions of inboxes. Currently a post from a
  high-follower account is read via `following` fan-out-on-read, so it costs nothing to
  publish — this is the correct default and scales.
- Define a threshold (config, not code) e.g. `HIGH_FANOUT_FOLLOWER_THRESHOLD = 100_000`
  in `lib/reco/config.js`. Above it, keep read-time aggregation and skip any per-follower
  write fan-out (notification storms, inbox copies).
- Notifications from high-fanout accounts must be **aggregated + rate-limited per
  recipient** (e.g. one "X posted 5 new things" digest per day) — enforced in the
  notification worker, not the client.

## 6. Notifications scaling

Pipeline already separated: **generation → queue → preference/safety filtering → delivery →
storage**. `notification_queue` batches inserts (dedup keys), a cron worker moves batches
to `notifications`, FCM push uses `sendEachForMulticast` with batch token cleanup.

Remaining work (Stage B): per-recipient digesting, per-sender throttling, exponential
backoff + retry counters with dead-letter visibility, push via platform queues (FCM
batches already; APNs when needed).

## 7. Real-time architecture

- Supabase Realtime handles connection management + distribution; the app never manages
  WebSocket fleets. Battles/challenges/comments use it today with polling fallback.
- Rules: never broadcast every event to every connection; subscribe per-resource
  (battle_id, post_id). Heartbeats/backpressure/reconnection are handled by the
  Realtime layer — document that a future self-hosted realtime tier (e.g. Ably/Pusher)
  must keep the same channel-scoped subscription model so clients don't change.

## 8. Consistency boundaries (global data)

| Data | Consistency requirement |
| --- | --- |
| Payments, entitlements, refunds | **Strong** (single writer, webhook verified, idempotent by event ID) |
| Moderation decisions, blocks | **Strong** (authoritative; replicated only by the moderation pipeline) |
| Auth/sessions | **Strong** (Supabase managed) |
| Search indexes | Eventual (acceptable, reindex from source of truth) |
| Analytics, trending, public counters | Eventual (batch/queue, dedupe by event ID) |
| Feed ranking | Eventual (ranked fragments refresh in background) |

## 9. Single points of failure — current + staged mitigations

| SPOF | Risk at Stage A | Staged mitigation |
| --- | --- | --- |
| Single Supabase Postgres | Acceptable (managed, PITR + backups) | Stage B: read replicas; Stage C: region failover; never split writes before sharding is proven |
| Per-instance cache | Only perf risk (cold misses), not correctness | Stage B: shared Redis |
| Per-instance rate limiter | Abuse bypass with many instances | Stage B: shared Redis rate limiter (same API) |
| Single cron worker (Vercel) | Missed runs; jobs are idempotent by design | RPCs are idempotent (batch claim w/ `FOR UPDATE SKIP LOCKED`); monitor cron success in `/api/metrics` |
| Firebase/Resend providers | Outage = degraded notifications only | Non-critical path; app degrades to in-app only |
| AI service (Gemini) | Outage = roast generation degraded | `lib/aiService.js` has fallback templates; never blocks core roasts |

## 10. Graceful degradation order (under stress)

**Preserve first:** auth, content access/feeds (fallback ranking), safety/moderation,
critical transactions (battles votes, payments).

**Degrade first:** advanced recommendations → trending freshness → analytics refresh →
non-critical notifications → AI features → email delivery.

The feed already implements this: personalized pipeline failure falls back to the generic
ranked feed (`buildGenericFeed`), never a blank page.

## 11. Security at scale

Already in place: RLS everywhere, service-role keys server-side only, signed webhook
verification (`lib/monetization/webhook.js`), secret-based cron auth, input validation,
layered rate limits, hashed IPs (`RATE_LIMIT_SALT`), profanity/deterministic policy
checks, block lists. Add: secret rotation schedule, audit logging for admin actions,
least-privilege service roles per job (Stage B), and never trust internal traffic once
services are extracted (zero-trust boundaries, mTLS or signed service tokens).