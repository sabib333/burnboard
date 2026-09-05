# BurnBoard Disaster Recovery, Incident Response & Runbooks

---

## 1. Backup strategy

| Asset | How | Frequency | Verification |
| --- | --- | --- | --- |
| Postgres (Supabase) | Managed backups + Point-in-Time Recovery | Continuous PITR + daily backups | Quarterly restore test (see §3) |
| Environment configuration | `.env.local`, `.env.example`, Vercel env vars documented in `DEPLOYMENT.md` | On change | Manual diff checklist |
| Secrets | Stored in Vercel/Supabase secret stores, never in git (`.gitignore` excludes `.env.local`) | On rotation | Rotation log |
| Code | Git history (Vercel Git integration) | Every commit | Deploys are immutable + instant rollback |
| Object storage / media | Supabase Storage (when adopted at Stage B) | Lifecycle policies + cross-region copy at Stage D | Recovery test |

**Principle:** a backup that has never been restored is not trusted. Restore tests are
scheduled, not optional.

## 2. RPO / RTO targets

| System | RPO | RTO | Rationale |
| --- | --- | --- | --- |
| Auth + user data | 5 min (PITR) | 1 h | Losing sessions/data is unacceptable |
| Payments / entitlements | 5 min (PITR) | 1 h | Financial correctness; ledger is source of truth + webhook replay |
| Content (posts, roasts, comments) | 15 min | 4 h | Recoverable from DB; user-generated content valued |
| Moderation records | 15 min | 4 h | Safety decisions must survive |
| Analytics aggregates | 24 h | 24 h | Rebuildable from events; tolerate loss of aggregates |
| Cache (all) | n/a | n/a | Rebuildable from source; never a source of truth |

Documented assumption: RPO/RTO are **targets for the current stage**; they tighten as
multi-region and replicas arrive, and any change to them is a deliberate, reviewed decision.

## 3. Restore testing

Quarterly (or after any schema/migration change):

1. Spin up a throwaway Supabase project (or restore from backup into a staging project).
2. Restore the latest backup; run `supabase/migrations` on top; verify `schema.sql` sanity.
3. Smoke-test critical paths against the restored DB: login, feed read, post/roast create,
   battle vote, payment entitlement lookup, notification worker run.
4. Record results + time-to-restore in the runbook log. Any failure is a P1 incident for
   the DR owner.

## 4. Incident response

Severity levels:

| Sev | Definition | Response |
| --- | --- | --- |
| SEV-1 | Total outage (auth, feeds, or payments down) | Immediate: on-call + owner; status page; mitigation first, root cause second |
| SEV-2 | Major feature degraded or data at risk | < 30 min response; workaround or rollback |
| SEV-3 | Minor degradation, no user impact visible | Next business day |
| SEV-4 | Cosmetic / internal | Normal backlog |

Escalation: individual → owner of affected module → CTO/architect. Communication:
status update to stakeholders at 5 min / 30 min / 1 h for SEV-1/2.

Post-incident review (blameless): timeline, impact, root cause, what worked, action items
with owners. Focus on system improvement, never individuals.

## 5. Operational runbooks

### Database incident (connection errors, saturation, slow queries)
1. Check `/api/health?detail=true` DB latency + error rate (metrics).
2. Identify slow queries from logs (p95 spikes, `durationMs`); check for missing indexes
   against [DATA_SCALING.md](./DATA_SCALING.md) §1.
3. Mitigation: tighten caching (raise TTLs for public keys), throttle via rate limits,
   add `CREATE INDEX CONCURRENTLY` for the offending query if justified.
4. If primary is degraded: reads fall back to cache/SWR; do **not** promote writes to a
   replica without the staged plan.

### Cache incident (misses spike → DB load)
1. Metrics: cache size/hit rate in `/api/metrics`; DB latency correlation.
2. Cache is never authoritative — worst case is slower requests, not wrong data.
3. Restart of instances naturally rebuilds cache (per-instance design is self-healing).
4. If a shared Redis is adopted later, add its own runbook here.

### Queue / notification worker incident (backlog, failed runs)
1. Check `/api/process-notifications` cron result + `notification_queue` backlog metric.
2. RPC `process_notification_queue` is atomic + idempotent (`FOR UPDATE SKIP LOCKED`) —
   re-running is safe; no manual row surgery needed.
3. If the queue is stuck on poison rows, mark them processed via a bounded admin query
   (never delete user data blindly).

### Payment incident (webhook failures, verification errors)
1. Every webhook failure is SEV-2 minimum (financial). Check `lib/monetization/webhook.js`
   verification logs.
2. Idempotency keys + event replay make retries safe; retry with backoff from the queue.
3. Never "fix" a failed payment by manual DB edits — replay through the pipeline.

### Auth incident (login/session failures)
1. Check middleware refresh errors + auth route logs; verify Supabase project status.
2. If Supabase is down: app should degrade to anonymous browsing (public content still
   readable); auth-dependent features return auth-required states.
3. Rollback path: previous deployment is one click in Vercel (env unchanged).

### Deployment rollback
1. Vercel: redeploy previous successful production deployment (one click) — env unchanged.
2. If a migration is involved, the migration must be backward-compatible (all migrations
   are), so the old code keeps working against the new schema.
3. Feature flags allow disabling a risky feature without a deploy.

### Traffic spike / viral event
Follow the [Viral Event Playbook](./OPERATIONS.md#viral-event-playbook).

### Content delivery outage (CDN / edge)
1. Public cache headers mean most reads never hit origin; if the edge is down, origin is
   still reachable (Vercel routes around regions automatically).
2. Verify `/api/health` + a public page fetch; check Vercel status page.
3. No action needed for origin-only degradation beyond monitoring.