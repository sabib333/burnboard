# BurnBoard Load Testing Foundation

Test real user journeys, not synthetic requests-per-second numbers. The scenarios below
mirror the ways BurnBoard actually gets hit, and the scripts in `scripts/load-test/`
are dependency-free (Node ≥ 18, global `fetch`) so they run anywhere.

---

## 1. Scenarios

| Scenario | What it simulates | Endpoints hit | Why it matters |
| --- | --- | --- | --- |
| Mass signup | New-user burst | auth callback, profile create | Auth path + profile writes |
| Viral post | One post read by everyone | `/api/feed` (for_you + following), `/api/post/[id]` | Read-path capacity, cache behavior |
| High comment volume | Comment storm on a hot post | `/api/comments` GET/POST | Comment writes + reply-count queries |
| Celebrity post | High-fanout creator publishes | `/api/feed` (following) | Fan-out-on-read cost |
| Notification burst | Queue flood | `/api/process-notifications` (worker) | Queue throughput, batch RPC |
| Share-link traffic | External spike | `/api/share`, `/api/og`, public pages | CDN + edge absorption |
| Search spike | Discovery load | `/api/search`, `/api/explore` | ILIKE query load |
| Payment webhook burst | Checkout + webhook storm | `/api/monetization/webhook` (or handler) | Financial isolation + idempotency |

## 2. Running the scripts

```bash
# From the project root — targets local dev by default
node scripts/load-test/loadtest.js --scenario viral-post --users 100 --duration 30

# Point at a deployed environment
BASE_URL=https://burnboard.app node scripts/load-test/loadtest.js --scenario search-spike --users 50
```

See `scripts/load-test/README.md` for the full flag list and scenario catalog.

## 3. Measuring (before → after)

For every scenario, capture before/after:

1. p50/p95/p99 latency and error rate per endpoint (script prints these).
2. DB load — Supabase dashboard; watch for slow queries and cache-hit impact.
3. Queue depth during notification-burst runs.
4. Rate-limit triggers — a well-tuned system should *not* trip 429s on the configured
   user counts; tripping them means limits are too tight for legitimate traffic.

## 4. Failure testing (staged, controlled)

| Test | How (safe) | Expected behavior |
| --- | --- | --- |
| Cache failure | Restart instances / clear cache | Requests fall through to DB; no wrong data |
| Worker failure | Stop cron once | Queue backlogs; next run drains it (idempotent RPC) |
| External provider failure | Point AI/email/push at a dead endpoint | Feature degrades (fallback templates, in-app only); core unaffected |
| Replica/DB lag | (Stage B) throttle replica | Reads serve slightly stale data; writes unaffected |
| Partial deploy | Deploy a flagged feature to preview only | Flag-off traffic unaffected |

Never run destructive failure tests against production without explicit controls and a
rollback plan. The design goal: **core experience first** — auth, content access, safety
and critical transactions survive every test above.

## 5. Viral spike drill

Quarterly: run the viral-post scenario at 10x current peak, watch the metrics in
[OBSERVABILITY.md](./OBSERVABILITY.md) §2, and execute the [viral playbook](./OPERATIONS.md#viral-event-playbook)
verbatim. Record what degraded and what held.