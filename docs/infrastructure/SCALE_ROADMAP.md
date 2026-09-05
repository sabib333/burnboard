# BurnBoard Scale Roadmap

The end-to-end plan: from today's Stage A deployment to global scale, with explicit stage
gates, "what not to build yet," and what was delivered in this release (Master Prompt 16).

## 0. Master Prompt 25 — what this release added

- **Executive infrastructure dashboard** (`/admin/infrastructure` + `GET
  /api/admin/infrastructure`, admin-gated, aggregate-only) — the roadmap's
  explicit "next step #1" (wire `/api/metrics` into a dashboard) is done:
  traffic (requests / errors / error rate / avg + worst latency), live
  database probe, cache, rate limiter, notification queue depth, payment
  event pipeline, and DAU/WAU context — plus computed, threshold-based
  alerts (error rate > 5%, avg latency > 3s, queue backlog > 1k, stuck
  webhook events, DB degraded). Every subsystem degrades to "unavailable"
  rather than hiding a failure.
- **Instrumentation extended** — `trending`, `leaderboard`, and
  `notifications` (GET + POST) now emit request metrics via
  `instrumentHandler`, joining feed/roast/comments + AI observability.
- **Docs** — this roadmap update (checking off next step #1; steps 2–3 —
  load baselines against staging, quarterly restore test — are operational
  and remain).

---

## 1. The evolution path

```
SIMPLE → STABLE → MEASURED → OPTIMIZED → MODULAR → DISTRIBUTED WHEN NECESSARY → GLOBAL WHEN JUSTIFIED
```

| Stage | Users | Trigger to advance | Work to do at that stage |
| --- | --- | --- | --- |
| **A. Early Product** (now) | 1K–100K | — | Modular app ✅, single Postgres ✅, per-instance cache ✅, cron jobs ✅, health/metrics ✅, runbooks ✅, DR ✅ |
| **B. Product Growth** | 100K–1M | p95 feed > 300ms sustained; rate-limit bypass; search latency; queue backlog | Shared Redis cache + rate limiter (same APIs), read replicas, pg_search → dedicated engine, analytics separation, object storage + async media derivatives, worker retries/backoff with dead-letter visibility |
| **C. Large Scale** | 1M–10M | Feed QPS outgrows single DB reads; notifications volume | Extract feed + notifications services behind existing API contracts, time-partition notifications/analytics, ranking workers, regional edge delivery |
| **D. Global Platform** | 10M–100M | Regional user concentration; latency requirements | Multi-region deploy + routing, regional CDN, failover, explicit consistency per [SCALE_ARCHITECTURE.md](./SCALE_ARCHITECTURE.md) §8 |
| **E. Extreme Scale** | 100M+ | Proven traffic + ops maturity | Read replicas → regional topology → sharding of user-scoped tables → event streaming. Only when justified |

Each stage gate is **measured** via [OBSERVABILITY.md](./OBSERVABILITY.md) §2 metrics —
never jumped on vibes, never late on trends.

## 2. What NOT to build yet (explicitly deferred)

- ❌ Dozens of microservices — modular monolith with extraction boundaries is the design.
- ❌ Kafka / complex event streaming — Postgres queue + cron + idempotent RPCs cover Stage A/B.
- ❌ Multi-region active-active writes — single-writer until Stage D, then careful topology.
- ❌ Sharding the primary DB — replicas + partitioning first.
- ❌ Kubernetes / dedicated hardware — Vercel serverless is the platform until economics say otherwise.
- ❌ Multiple search clusters / full ML infrastructure — pg_search → one engine → scale it.
- ❌ Service meshes / zero-trust internal mTLS — only when services actually split.

## 3. What this release (Master Prompt 16) added

**Documentation** (`docs/infrastructure/`):

- `SCALE_ARCHITECTURE.md` — full audit, module map, staged plan, feed/notif/search/realtime
  strategies, high-fanout policy, SPOF audit, graceful degradation order.
- `DATA_SCALING.md` — entity access patterns, index policy, migration safety, partitioning
  prep, cache/CDN boundaries, event contracts, deletion propagation.
- `OBSERVABILITY.md` — metrics/logs/traces, alerting, error management, SLOs/SLIs/error
  budgets, performance budgets.
- `DISASTER_RECOVERY.md` — backups, RPO/RTO, restore testing, incident response, runbooks.
- `OPERATIONS.md` — capacity planning, cost monitoring, viral playbook, abuse defense,
  deployment/CI/CD/rollback, feature flags, environments.
- `LOAD_TESTING.md` + `scripts/load-test/` — scenario-based load testing foundation.
- `SCALE_ROADMAP.md` — this document.

**Code & infrastructure:**

- `supabase/migrations/2026_09_08_scale_reliability.sql` —
  - `refresh_profile_roast_counts()` RPC: single-statement batch refresh (kills the
    per-profile N+1 loop in the cleanup cron — was O(profiles) queries per run).
  - `process_notification_queue` rewritten to claim batches atomically with
    `FOR UPDATE SKIP LOCKED` + idempotent insert — exactly-once under concurrent workers.
  - Guarded `fcm_tokens(user_id)` index for the push worker's batch token fetch.
- `app/api/cron/cleanup/route.js` — replaced the profile loop with the batch RPC.
- `app/api/process-notifications/route.js` — batch FCM token fetch (one query per run
  instead of one per user), grouped multicast per user, invalid-token cleanup preserved.
- `lib/serverRateLimit.js` — new limits: `COMMENT_CREATE`, `COMMENT_REACT`, `FOLLOW`,
  `SHARE`; applied to the four previously-uncovered mutation endpoints.
- `lib/metrics.js` + `app/api/metrics/route.js` — in-memory request metrics (counts,
  errors, durations) exposed at a cron-protected endpoint; wired into feed/roast/comments.
- `middleware.ts` — `x-request-id` header on every request for log correlation.
- `.github/workflows/ci.yml` — install + build on PR and `main` (untested code blocked).
- `package.json` — `loadtest` script entry.

## 4. What was preserved (quality gate)

All existing systems remain untouched in behavior: auth/sessions, profiles, For You feed,
Following feed, trending, roasts, reactions, comments, follows, communities, challenges,
battles, search, explore, notifications, creator dashboard & analytics, growth/referrals,
sharing, monetization & payment verification, Trust & Safety/moderation/blocking/privacy.

- No destructive migrations; the new migration is additive + idempotent.
- No new external services, no new dependencies, no paid infrastructure added.
- All API contracts unchanged; only new 429 responses on abuse (per-endpoint, generous
  limits) and new optional endpoints (`/api/metrics`).
- Cache and rate-limit boundaries documented; nothing personalized is cached publicly.
- Backups: Supabase managed + PITR; restore testing scheduled (quarterly).
- Deployment: CI gate added; rollback is one click in Vercel; migrations are
  backward-compatible by policy.

## 5. Next steps (ordered by value)

1. ✅ **`/api/metrics` surfaced in a dashboard** (MP25 `/admin/infrastructure`,
   with computed alerts). Next: push the same metrics + alerts to Axiom/Grafana
   for cross-instance aggregation and persistent alert history.
2. Run the load scenarios against staging; record baseline numbers.
3. Run the first quarterly restore test.
4. When feed p95 or rate-limit incoherence appears at real scale: promote
   `lib/cache.js`/`lib/serverRateLimit.js` to Redis behind the same APIs (call sites
   unchanged) — the only Stage B item with a code footprint.