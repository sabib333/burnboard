# BurnBoard Infrastructure & Scale Documentation

Master Prompts 16 & 21 — Global Scale, Reliability, Security, Privacy & Enterprise
Infrastructure Architecture.

Master Prompt 16 documents how BurnBoard can evolve from a single-region Vercel +
Supabase deployment to a global platform **without repeated rewrites**. Master Prompt 21
adds the enterprise layer: service-criticality SLOs, security & privacy engineering, and
an **evidence-based hardening audit** that separates verified capability from documented
plan. The guiding principle stays: *simple → stable → measured → optimized → modular →
distributed when necessary → global when justified.*

## Documents

| Document | Covers |
| --- | --- |
| [SCALE_ARCHITECTURE.md](./SCALE_ARCHITECTURE.md) | Current-state audit, module map, staged scale plan (Stage A–E), future service-extraction boundaries, feed / notifications / search / social graph / real-time scaling strategy, high-fanout (celebrity) accounts, single points of failure, high availability, graceful degradation |
| [DATA_SCALING.md](./DATA_SCALING.md) | Entity access patterns, index justification, migration safety rules, partitioning & sharding preparation, cache boundaries (keys / TTL / invalidation), CDN boundaries, event contracts & idempotency, content-deletion propagation, read/write scaling |
| [OBSERVABILITY.md](./OBSERVABILITY.md) | Metrics, structured logs, request tracing, alerting, error management, SLOs / SLIs / error budgets, performance budgets |
| [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) | Backup strategy, RPO / RTO targets, restore testing, single point of failure mitigation, incident response, operational runbooks |
| [OPERATIONS.md](./OPERATIONS.md) | Capacity planning, cost monitoring, viral-event playbook, abuse traffic management, deployment / CI-CD / rollback, feature flags, environments, security at scale |
| [LOAD_TESTING.md](./LOAD_TESTING.md) | Load-testing foundation, realistic scenarios, how to run the scripts in `scripts/load-test/` |
| [SCALE_ROADMAP.md](./SCALE_ROADMAP.md) | The end-to-end roadmap with stage gates and "what not to build yet" |
| [SECURITY.md](./SECURITY.md) | Enterprise security architecture (MP21): zero-trust application, secrets management, encryption, API/app security, security monitoring & incident response — including what is intentionally not claimed |
| [PRIVACY.md](./PRIVACY.md) | Privacy engineering (MP21): data classification, minimization, retention, deletion propagation, export, residency readiness — honest about what is architected vs. what needs legal/operational verification |
| [HARDENING_AUDIT.md](./HARDENING_AUDIT.md) | Evidence-based hardening register (MP21): verified ✅ / limited 🟡 / gap 🔴 / deferred ⏸️ across reliability, database, security, privacy, operability and cost — plus maturity-stage mapping and 90-day action items |

### MP25 changes shipped with this release

- **Executive infrastructure dashboard** — `/admin/infrastructure` (admin-gated,
  aggregate-only) with `GET /api/admin/infrastructure`: traffic, live DB probe,
  cache, rate limiter, notification queue depth, payment-event pipeline,
  DAU/WAU context, and computed threshold alerts. Roadmap next-step #1
  ("wire `/api/metrics` into a dashboard") is done; Stage B promotion to
  Axiom/Grafana keeps the same APIs.
- **Instrumentation extended** — `trending`, `leaderboard`, `notifications`
  (GET/POST) now emit request metrics alongside feed/roast/comments + AI.

### MP21 hardening changes shipped with this release

- **Cron + internal endpoints fail closed:** `/api/metrics`, `/api/cron/cleanup`,
  `/api/cron/ai`, `/api/process-notifications`, `/api/cleanup`, `/api/growth/snapshot`
  now return 401 when `CRON_SECRET` is unset (previously several ran with only an
  optional check).
- **Security headers in middleware:** `X-Frame-Options: DENY`, `X-Content-Type-Options:
  nosniff`, `Referrer-Policy`, `Permissions-Policy` on all responses. CSP is deliberately
  deferred (tracked in SECURITY.md) until origins are locked down.

## Quick orientation

- **Stack today:** Next.js 14 (App Router) on Vercel, Supabase (Postgres + RLS + RPC),
  in-memory per-instance cache, in-memory per-instance rate limiting, Vercel cron jobs,
  Resend (email), Firebase Cloud Messaging (native push), `@vercel/analytics`.
- **Scale stage:** **Stage A (Early Product)** with several Stage B foundations already in
  place (notification queue, cursor pagination, layered rate limiting, structured logging,
  health checks, cache-aside with TTL, batch RPCs).
- **Deployment:** Vercel (Hobby/Pro) with `vercel.json` cron schedules; `middleware.ts`
  refreshes Supabase sessions; CDN caching via `Cache-Control` headers on public endpoints.
- **Code conventions:** JavaScript (no TS in `app/`/`lib/`), `@/` alias, `lib/` service
  modules per domain, Supabase RLS as the security boundary, RPC functions for anything
  transactional.

## Golden rules (non-negotiable)

1. Never run a destructive migration against production.
2. Never add infrastructure (queues, Kafka, microservices, replicas, multi-region) until
   measured traffic justifies it.
3. Never put financial state, auth, or moderation decisions behind eventual consistency.
4. Never fan out a single post synchronously to millions of inboxes.
5. Never log or cache private data without authorization context.
6. A backup that has never been restored is not a backup.