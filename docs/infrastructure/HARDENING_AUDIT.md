# BurnBoard Hardening Audit & Reliability Maturity (MP21)

An **evidence-based** register of what is real, what is measured, what is a
known gap, and what is intentionally deferred. This document exists so the
team never confuses "documented plan" with "verified capability" — and so
nothing claims billion-user readiness without load evidence.

Status labels: ✅ **verified working** · 🟡 **works with a documented
limitation** · 🔴 **gap / not built** · ⏸️ **deferred by design** (with the
trigger condition for building it).

---

## 1. Service criticality, SLIs, SLOs, error budgets

| System | Tier | SLI (measured today) | SLO | Error budget (per 30d) |
| --- | --- | --- | --- | --- |
| Auth (Supabase SSR sessions) | 0 | login/session-refresh error rate + availability (`/api/health`) | 99.9% availability, <1% auth errors | 43 min downtime / 0.43% errors |
| Content write paths (posts/roasts/comments) | 0 | error rate per route (metrics) | <1% 5xx on mutations | 0.43% |
| Feed read (following/foryou) | 1 | latency p95 + error rate (metrics: feed route) | p95 < 300 ms, <1% errors | — |
| Notifications delivery | 1 | worker success/failure + queue depth | <2% failed batches | — |
| Payments/entitlements | 0 | webhook verification failures (audit) | 0 unverified events accepted | none — financial |
| Moderation/blocking enforcement | 0 | RLS policy coverage (code audit) | 100% of read paths RLS-enforced | none — safety |
| Developer platform / public API | 2 | per-app error rate + rate-limit triggers | <2% errors | — |
| Analytics/snapshots | 2 | cron success (`/api/cron/*`) | daily snapshot succeeds | tolerated |

Measured-vs-target honesty: feed p95 and route error rates are **emitted by
`lib/metrics.js`** but only inspected via `/api/metrics` (cron-gated, no
dashboards yet). Until external ingestion + dashboards + alert routing exist
(OBSERVABILITY.md Stage B), SLOs above are targets with partial enforcement
— error-budget **enforcement** (pausing risky releases) is a process step
that starts when dashboards land.

## 2. Reliability & resilience register

| Capability | Status | Evidence / note |
| --- | --- | --- |
| Stateless horizontal scaling | ✅ | Serverless functions; no instance-local state except caches/rate-limiters |
| Sessions survive instance loss | ✅ | Stateless JWT sessions via Supabase; cookies not instance-bound |
| Cache failure behavior | ✅ | `lib/cache.js` TTL+SWR, never source of truth; degrades to DB |
| Rate limiting | 🟡 | Per-IP + per-user in-memory (per-instance). Must become shared (Redis/Upstash) before multi-instance abuse risk — OPERATIONS.md decision rule exists |
| Queue retries / backoff | ✅ | notification/AI/webhook workers: `FOR UPDATE SKIP LOCKED`, idempotent claims, bounded retries |
| Dead-letter handling | 🟡 | Failed deliveries surface in tables + metrics; no explicit DLQ table — bounded retries + auto-disable (webhooks) make DLQ optional at this stage |
| Circuit breakers | 🔴 | Not implemented. External calls (Gemini, FCM, Resend, payment webhooks) fail safe per-call but have no open-circuit state. **Build when** an external dependency shows repeated failure under real load |
| Load shedding | 🟡 | Graceful degradation order is documented (SCALE_ARCHITECTURE); no automated shedding. **Build when** a measured 10× spike scenario demands it |
| Viral traffic protection | 🟡 | Rate limits + caches + bounded queues exist; CDN absorption at edge is host-level |
| Cron jobs fail closed | ✅ | **Hardened this release**: metrics + all cron/queue endpoints 401 when `CRON_SECRET` unset |
| Security headers | ✅ | **Added this release**: X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy in middleware |

## 3. Database & data register

| Capability | Status | Evidence |
| --- | --- | --- |
| Workload classification | ✅ | DATA_SCALING.md table (per-entity access patterns) |
| Indexes justified | ✅ | 37 additive migrations; each index tied to an access path |
| Migrations safe | ✅ | All additive (`IF NOT EXISTS`); CI destructive-guard blocks DROP/TRUNCATE |
| Backups + PITR | ✅ | Supabase managed; RPO/RTO table in DISASTER_RECOVERY.md |
| Restore **testing** | 🔴 | Documented as quarterly requirement; no automated drill exists. **First drill is a tracked action item** |
| Partitioning | ⏸️ | notifications/analytics identified as candidates at >50M rows (Stage C) |
| Sharding | ⏸️ | Explicitly deferred; single-writer is fine until replicas + partitioning are genuinely insufficient |
| Hot-user / viral-post isolation | 🟡 | Caching + rate limits; celebrity fan-out strategy documented in SCALE_ARCHITECTURE |

## 4. Security & privacy register

| Capability | Status | Evidence / note |
| --- | --- | --- |
| Secrets out of git | ✅ | `.env.local` ignored; CI secret-scan guard; code scan clean (MP21 audit) |
| Secrets centralized | ✅ | Vercel env + Supabase stores; `PLATFORM_WEBHOOK_PEPPER` documented |
| Encryption in transit / at rest | ✅ | TLS everywhere; provider-managed storage encryption; no custom crypto |
| RLS everywhere | ✅ | Every data table has RLS; destructive/privileged writes are SECURITY DEFINER |
| **Admin gate** | ✅ | **Hardened (MP26)**: fail-closed (`lib/adminGate.js` — no default secret; 503 when `ADMIN_PASSWORD` unset), timing-safe compare, server-side verify (`/api/admin/verify`, rate-limited), shared client gate with secret kept in memory only. All `/admin*` dashboards + admin/growth APIs converted; `/api/experiments/manage` and `/api/growth/events` GET are now admin-gated (were unprotected) |
| CSP | 🔴 | Deliberately not set (origins not locked down). Tracked in SECURITY.md; **correct CSP is a Stage B hardening task**, not a claim |
| WAF / DDoS | 🟡 | Host-level (Vercel) managed edge; must be explicitly enabled + rules reviewed — ops action, not assumed |
| Formal user-deletion flow | 🔴 | Propagation exists (cascades, caches, Postgres search); a user-facing "delete my data" flow with completion report is not built |
| Formal data export | 🔴 | Architecture defined (auth + short-lived URL + audit); not built |
| Retention enforcement | ✅ | security_logs 30d, notifications 90d, AI logs 90d, revenue snapshots 400d — cron-run |
| Privacy auditability | ✅ | monetization + developer-platform + moderation audit tables |
| Residency compliance | ⏸️ | No claim; regional storage requires legal + ops verification (Stage C/D) |
| Security monitoring | 🟡 | **In-app Security Operations dashboard added (MP26)**: `security_logs` now has live writers (admin verify success/failure + admin actions, hashed IPs only) surfaced at `/admin/security` via `/api/admin/security`. No SIEM/external ingestion yet (Stage B) |

## 5. Operability register

| Capability | Status | Evidence |
| --- | --- | --- |
| Metrics | ✅ | `lib/metrics.js` → `/api/metrics` (now fail-closed) |
| Logs | ✅ | structured, sanitized, request-ID correlated |
| Tracing | ⏸️ | Request-ID correlation only; distributed tracing **when services split** (never before) |
| Alerts | 🟡 | 7 actionable conditions documented; alert routing/delivery not wired (Stage B) |
| Runbooks | ✅ | 8 runbooks in DISASTER_RECOVERY.md; on-call + escalation in OPERATIONS.md |
| Incident severity | ✅ | SEV-1..4 defined |
| Postmortem process | ✅ | Blameless process documented |
| Environments | 🟡 | local/production via env; preview via Vercel. A full staging tier with prod-like data is a tracked item |
| CI/CD | ✅ | Build gate + destructive-migration guard + secret scan in `.github/workflows/ci.yml` |
| IaC | ⏸️ | Vercel + Supabase are managed; Terraform/Infra-as-Code is a Stage B decision |
| Feature-flag fallback | ✅ | Env-based flags default to safe values; no remote flag dependency |
| Config vs code separation | 🟡 | Env-driven policy (monetization splits, eligibility thresholds); some knobs remain in-code (documented) |

## 6. Cost / capacity register

| Capability | Status | Evidence |
| --- | --- | --- |
| Cost visibility | 🟡 | Provider dashboards + OPERATIONS.md unit metrics; no automated budgets |
| Capacity planning | 🟡 | Growth signals + decision rules documented; no forecasting automation |
| Load tests | 🟡 | 7 realistic scenarios in `scripts/load-test/` (MP16); not run against a live staging baseline yet — **first baseline is a tracked action item** |
| Chaos / failure tests | 🔴 | Not run. **Controlled chaos (kill an instance, delay a queue, fail a provider) is a Stage B action item**, gated on staging existing |

---

## 7. Maturity stage mapping

| Stage | Focus | Status today | Exit to next stage when… |
| --- | --- | --- | --- |
| **1 — Product stability** (10K–100K) | Monitoring, backups, basic scaling | ✅ Most fundamentals in place | Load-test baseline exists; staging exists |
| **2 — Growth** (100K–1M) | Shared cache/rate-limit, queues, CDN, external observability | 🔴 next | First 100K MAU signal OR p95 feed > 300 ms sustained |
| **3 — Service isolation** (1M–10M) | Read replicas, event architecture, extract feed/notifications | ⏸️ | Measured single-Postgres saturation OR queue > 10k backlog sustained |
| **4 — Regional** (10M–100M) | Multi-region, partitioning, large media | ⏸️ | Regional user demand + residency requirements |
| **5 — Extreme scale** (100M–1B) | Global traffic engineering, massive isolation | ⏸️ | Real traffic + operational learning; never speculative |

**Billion-user claim status: none.** The register above is the evidence for
where BurnBoard actually is (solid Stage-1/2-ready foundation) and exactly
what must be measured before each next stage.

## 8. Priority action items (next 90 days)

1. ~~Rotate `ADMIN_PASSWORD`~~ **Done (MP26)**: the admin gate now fails closed,
   verifies server-side, and has no default — set `ADMIN_PASSWORD` + `CRON_SECRET`
   in every environment (documented in `.env.example`).
2. Run the first quarterly **restore drill** (documented procedure exists)
   and the first **load-test baseline** against a staging deployment.
3. Wire alert routing for the 7 documented conditions (external ingestion).
4. Enable + rule-review the host-level WAF; lock CSP origins.
5. Build the formal user **deletion + export** flows (privacy).
6. Establish staging with realistic (non-PII) data for chaos tests.

Each item has a doc owner and a definition of done in the referenced
documents; none are claims — they are tracked work.