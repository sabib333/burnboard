# BurnBoard Data Scaling

Database health, indexing justification, migration safety, caching boundaries, CDN
boundaries, event contracts, and deletion propagation.

---

## 1. Entity access patterns (audit)

| Entity | Primary reads | Primary writes | Indexes (existing) | Notes |
| --- | --- | --- | --- | --- |
| `profiles` / `user_profiles` | by id, username, platform lists | profile edits | platform lists, username | Roast counts refreshed in **batch** (`refresh_profile_roast_counts`) — no N+1 |
| `roasts` | profile feed, global feed, trending | create, reactions | `(profile_id, created_at)`, `(user_id, created_at)`, `(ip_hash, created_at)`, `upvotes`, `created_at` | Duplicate/spam checks are index-backed time windows |
| `social_posts` | feeds (by user/community/challenge), moderation | create | user, community, challenge, moderation_state, content_type | Feed queries use `created_at desc` + cursor |
| `comments` | by target, newest/top | create, react, upvote | target, user, created_at, moderation_state, replies | Reply counts fetched via batched `IN` (no per-row query) |
| `reactions` | counts per target | upsert | target, participant, type | |
| `follows` | follower/following lists + counts | follow/unfollow | follower_created, following_created | Counts via `count: 'exact', head: true` — index-backed |
| `notification_queue` | worker claims batches | enqueue (batched RPC) | `(processed, priority, created_at)` | Claimed atomically with `FOR UPDATE SKIP LOCKED` |
| `notifications` | per-user inbox | worker inserts | `(user_id, created_at)`, `(user_id, is_read, created_at)` | Partition candidate at Stage C |
| `shares` | share counts, referral attribution | insert (idempotent) | resource, actor, recent, unique idempotency | Unique `(resource_type, resource_id, actor_id, ...)` prevents double counts |
| `battle_votes` | battle tallies | vote (RPC recomputes tallies) | battle, user | Vote totals always derived in RPC, never client-supplied |
| `communities` / `community_members` | discovery, member lists | create, join | slug, visibility, member role | |
| `challenges` / entries | challenge pages, entries | create, accept, complete | community, slug | |
| `monetization_*` | entitlements, ledger | checkout/webhook | (see monetization migration) | Strong consistency; webhook idempotency by event ID |
| analytics/events | dashboards | ingestion | time-bucketed | Must move off the transactional DB at Stage B |

## 2. Indexing policy

- **Index for real workloads, not guesses.** Every index above maps to a query that exists
  in the codebase (feed cursor, profile feed, spam window, queue claim, notification
  inbox). No blind index creation.
- **Don't over-index write-heavy tables.** `reactions`, `follows`, `battle_votes` are
  write-heavy; they carry exactly the indexes their reads need and no more.
- **New indexes go in migrations with a comment citing the query they serve.**
- The `2026_09_08_scale_reliability.sql` migration adds one guarded index
  (`fcm_tokens(user_id)`) serving the push worker's batch token fetch.

## 3. Migration safety rules (all migrations so far comply)

1. **Non-destructive:** only `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`.
2. **Backward compatible:** new columns have defaults; functions keep signatures.
3. **Never combine** a schema change, a large data migration, and an app dependency in one
   risky release — stage them.
4. **Avoid long blocking rewrites:** prefer `CREATE INDEX CONCURRENTLY` in production for
   large tables; keep data transforms in idempotent RPCs run by cron.
5. **No destructive column removal** without a documented, rollback-aware plan.

## 4. Partitioning & sharding preparation (do not implement yet)

- **Partition candidates when they grow:** `notifications`, analytics/activity tables,
  audit logs — time-based (e.g. monthly) partitions.
- **Sharding preparation:** keep IDs stable (UUIDs everywhere ✅), avoid cross-table joins
  that assume co-location in hot paths, separate global vs user-scoped data. Do **not**
  shard the primary DB until read replicas + partitioning are proven insufficient.
- Everything user-scoped is keyed by `user_id`/`profile_id`, so a future user-range or
  hash shard is feasible without schema changes.

## 5. Read / write scaling

- **Write path today:** single Postgres primary, transactional RPCs, batched queue
  inserts. Correct and cheap.
- **Read path:** indexed queries + per-instance cache + CDN `Cache-Control` on public
  endpoints. Next lever is shared Redis, then read replicas — in that order.
- Consistency boundary: reads may be slightly stale via cache/replicas; **writes and
  financial state always hit the primary.**

## 6. Cache boundaries

Every cache entry must define: key, TTL, invalidation, privacy scope, failure behavior.

| Cache | Key | TTL | Invalidation | Privacy |
| --- | --- | --- | --- | --- |
| Trending (`lib/cache.js`) | `trending:{window}` | 15s | time-based only | public |
| Leaderboard | `leaderboard:{window}` | 30s | time-based | public |
| Hot seat | `hot_seat:{id}` | 30s | delete on state change | public |
| Weekly recap | `weekly_recap` | 60s | time-based | public |
| Experiment config | `experiment_config` | 60s | time-based | public |

**Rules:**
- Never cache auth state, permission-sensitive content, or fresh mutation results
  (`CACHE_TTL.AUTH = 0`, `MUTATIONS = 0`).
- Personalized data must include viewer identity in the key (e.g. `foryou:{userId}:{offset}`)
  — never a shared key with per-user content.
- Failure behavior: cache-aside + stale-while-revalidate means a cache miss hits the DB;
  a cache *failure* must fall through to compute, never to wrong data.
- Per-instance cache is safe at Stage A/B; when multiple instances run, promote to shared
  Redis **behind the same `cacheGet/cacheSet/cacheAside` API** so no call site changes.

## 7. CDN boundaries

Handled via `vercel.json` headers + route-level `Cache-Control`:

| Route | Cache-Control | Why |
| --- | --- | --- |
| `/api/og` (share previews) | `public, s-maxage=3600, stale-while-revalidate=86400` | Public, expensive to render |
| `/sitemap.xml`, `/robots.txt` | `public, s-maxage=3600` | SEO |
| `/api/trending` | `public, s-maxage=15, swr=30` | Public, cheap to refresh |
| `/api/leaderboard`, `/api/weekly-recap` | `public, 30–60s` | Public aggregates |
| `/api/health`, `/api/metrics` | `no-store` | Must be live |
| Authenticated APIs (`/api/feed`, `/api/notifications`, …) | **private (no public caching)** | Personalized/sensitive |

**Never** cache personalized authenticated responses as public. Image/media delivery goes
through Vercel's edge + unoptimized images today; at Stage B, object storage + CDN with
versioned URLs (`?v=hash`) and lifecycle policies for deleted content.

## 8. Event contracts

Stable internal event shape (used for queue payloads, signals, analytics):

```json
{
  "event_id": "uuid",
  "event_type": "POST_CREATED",
  "event_version": 1,
  "timestamp": "ISO-8601",
  "actor_id": "uuid|null",
  "resource_type": "social_post|roast|comment|...",
  "resource_id": "uuid",
  "data": {}
}
```

Current event types: `POST_CREATED`, `POST_UPDATED`, `POST_REMOVED`, `USER_FOLLOWED`,
`COMMENT_CREATED`, `REACTION_CREATED`, `SHARE_CREATED`, `CONTENT_VIEWED` (signals),
`SUBSCRIPTION_ACTIVATED`, `PAYMENT_VERIFIED`, `MODERATION_ACTION`, `RATE_LIMIT_TRIGGERED`.

**Rules:**
- Event IDs make handlers idempotent (`shares` has a unique idempotency key; signals
  dedupe per day; queue RPC is exactly-once per claim).
- Never bump a version without a compatibility plan; never put sensitive data in events.
- Events are **asynchronous by default** — nothing user-facing waits on derived work.

## 9. Content deletion propagation

Deleting/removing content must invalidate every derived copy:

1. Primary storage — delete/flag row (RLS hides removed content).
2. Caches — `cacheDeletePrefix` for affected keys (feed fragments, trending).
3. Search — removal event → index delete (Stage B pipeline).
4. CDN — versioned URLs + purge on share-preview regeneration.
5. Recommendations — hidden-content set (`state.hiddenContent`) already filters
   personalized feeds; moderation state changes are picked up on next candidate fetch.

A single DB delete is never assumed to clean up derived systems — that's the documented
propagation contract above.