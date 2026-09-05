# BurnBoard Observability, SLOs & Alerting

Metrics, logs, traces, alerting, error management, SLOs/SLIs and performance budgets —
the measurement layer that decides when to pull each scale lever.

---

## 1. The three layers

| Layer | Current | Gap / next step |
| --- | --- | --- |
| **Metrics** | `lib/metrics.js` (in-memory counters/timings) → `/api/metrics` (cron-protected), `/api/health?detail=true`, `@vercel/analytics` (frontend) | Stage B: push to external metrics store (e.g. Axiom, Grafana Cloud) — keep the same emit API |
| **Logs** | `lib/logger.js` structured JSON (sanitized, level-filtered) | Stage B: ship to log ingestion; keep redaction rules |
| **Traces** | Request ID header (`x-request-id` set in middleware) correlated into logs | Stage B: distributed tracing only if/when services split (never before) |

## 2. What to measure

Per request path (API routes): count, error rate, p50/p95 latency, status distribution.
Per system: queue depth (`notification_queue` unprocessed count), cache hit/miss,
rate-limit triggers, DB latency (health check), worker/job success + failure, FCM/Resend
send failures, payment webhook failures, cron success/failure.

Concretely instrumented today:

- `lib/metrics.js` — counters `{name, value, labels}` and durations; emitted by wrapped
  handlers (feed, roasts, comments) and the metrics endpoint aggregates them.
- `/api/health?detail=true` — DB connectivity + latency, cache stats, rate limiter stats.
- `lib/logger.js` — structured logs with `component`, `durationMs`, `statusCode`;
  `withTiming` wrapper for request timing; sensitive fields auto-redacted.

## 3. Alerting

Alert on **actionable** conditions only (avoid fatigue — no alerts for single 4xx):

1. Error rate > 5% on any core API path over 5 min (feed, auth, comments, battles).
2. DB connectivity failure or p95 query latency > 1s sustained.
3. `notification_queue` unprocessed backlog > 10k for > 15 min (worker stalled).
4. Payment webhook verification failures (any, since each is financial).
5. Cron job failures (`/api/cron/cleanup`, `/api/process-notifications`) — job must
   return `success: true`.
6. Cache failure → elevated DB load (replicas/cache degradation).
7. Auth outage (login/session refresh error rate spike).

Each alert must have an owner, a runbook link (see [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md)),
and a severity.

## 4. Error management

- Centralize unhandled errors: API handlers catch → structured log with
  `component`, `requestId`, `error.message` (stack only in dev).
- Never expose internal stack traces to users — all error responses are generic
  (`{ error: 'Internal server error' }` pattern already used).
- Frontend: window error handlers + `@vercel/analytics` for crash/event telemetry;
  group by version + feature.
- Job failures: caught + logged + surfaced via metrics (`jobs.{name}.failure`).

## 5. SLOs / SLIs / error budgets

Targets for the current single-region stage (raise, don't lower, as infra grows):

| SLI | SLO (monthly) | Notes |
| --- | --- | --- |
| Feed API availability (200/5xx on `/api/feed`) | 99.9% | Personalized pipeline failure must fall back, not error |
| Auth success (session refresh / login) | 99.95% | Never degraded |
| API p95 latency (core read paths) | < 300 ms | Excluding AI routes |
| Notification delivery (queue → inbox) | 99% within 5 min | Batch worker |
| Payment webhook processing success | 99.99% | Strong consistency; retries + idempotency |
| Roast/comment creation success | 99.9% | Rate-limited, RLS-protected |

Error budget policy: when a budget is exhausted, freeze feature work on that surface until
reliability work restores it.

## 6. Performance budgets

| Surface | Budget |
| --- | --- |
| Page load (LCP, Vercel edge) | < 2.5s p75 on 4G |
| `/api/feed` response | < 300 ms p95 |
| Search response | < 300 ms p95 |
| Notification delivery latency | < 5 min p99 (batch worker) |
| Roast submission round-trip | < 1 s p95 (excluding AI) |
| Background job duration | < 2 min per cron run |

Measure real-user experience (Vercel analytics RUM + `logger.timing`), not synthetic
benchmarks.