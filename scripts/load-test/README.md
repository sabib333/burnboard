# BurnBoard Load Testing

Dependency-free (Node ≥ 18, global `fetch`) load generator. Test real user
journeys against staging — never production without explicit approval.

## Quick start

```bash
# List available scenarios
node scripts/load-test/loadtest.js --list

# Run the viral-post scenario, 20 concurrent users, 15 seconds, local dev
node scripts/load-test/loadtest.js --scenario viral-post --users 20 --duration 15

# Against a deployed environment
BASE_URL=https://your-staging.vercel.app node scripts/load-test/loadtest.js --scenario search-spike --users 50 --duration 30
```

Or via npm: `npm run loadtest -- --scenario viral-post --users 20 --duration 15`.

## Scenarios

| Scenario | What it simulates | Endpoints |
| --- | --- | --- |
| `mass-signup` | New-user burst | signup page, auth callback, profile create |
| `viral-post` | One post read by everyone | For You / Following / Trending feed, post detail |
| `comment-storm` | High comment volume | comments GET/POST, comment reactions |
| `notification-burst` | Queue flood | notifications inbox, queue worker (`/api/process-notifications`) |
| `share-traffic` | External sharing spike | share recording, OG preview |
| `search-spike` | Discovery load | search, explore |
| `payment-webhook-burst` | Webhook storm | payment webhook (expect 4xx on invalid payloads — measures resilience, not success) |

## Flags

- `--scenario <name>` — scenario to run (default `viral-post`)
- `--users <n>` — concurrent workers (default 20)
- `--duration <s>` — run duration in seconds (default 15)
- `--rate <rps>` — optional total request cap (0 = unlimited)
- `--base-url <url>` — target base URL (default `$BASE_URL` or `http://localhost:3000`)
- `--list` — print scenarios and exit

## Output

Per-endpoint: request count, error count (5xx), p50/p95/p99 latency, requests/sec.
Watch for: p95 spikes above the [performance budgets](../docs/infrastructure/OBSERVABILITY.md#6-performance-budgets),
error rate > 5%, and unexpected 429s (a tuned system should not trip rate limits
at the documented user counts).

## Workflow

1. Baseline: run each scenario against staging, record numbers.
2. Change: deploy a change (cache TTL, index, worker batch size).
3. Re-run: same scenario, compare. Improvement must be measured, not assumed.
4. Quarterly viral drill: run `viral-post` at 10x current peak and execute the
   [viral playbook](../docs/infrastructure/OPERATIONS.md#viral-event-playbook).

## Failure testing (controlled)

See [LOAD_TESTING.md](../docs/infrastructure/LOAD_TESTING.md) §4 for staged
failure tests (cache failure, worker failure, provider outage) and expected
behavior — core experience (auth, content, safety, payments) must survive all.