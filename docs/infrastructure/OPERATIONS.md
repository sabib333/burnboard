# BurnBoard Operations: Capacity, Cost, Abuse, Deployment & Environments

---

## 1. Capacity planning

Growth signals to monitor (dashboard from `/api/metrics` + Supabase stats + Vercel):

- Daily / monthly active users (auth events, `profiles` growth)
- Concurrent users (Vercel function invocations, realtime connections)
- Requests per second per API path
- Database size + growth rate per table (`pg_stat_user_tables`)
- Queue throughput (notification_queue processed/day) and depth
- Media/upload growth (when object storage lands)
- Search volume, share-link traffic, payment webhook volume

Decision rules (scale on **trends**, not panic):

| Signal | Action |
| --- | --- |
| p95 feed latency > 300 ms sustained OR instance count maxing | Promote cache to shared Redis; then read replicas |
| Rate-limit bypass observed across instances | Shared Redis rate limiter (same `lib/serverRateLimit` API) |
| `notification_queue` backlog > 10k consistently | Scale worker cadence (more frequent cron / dedicated worker) |
| Roasts/comments table > 50M rows | Time-partition strategy review |
| Search latency > 300 ms or DB ILIKE scans dominate | Adopt pg_search → dedicated search engine |

## 2. Cost monitoring & unit economics

Track (Supabase usage page, Vercel usage, provider dashboards): DB storage + compute,
function invocations, CDN/bandwidth, queue/search/analytics spend, email/push provider
usage.

Unit metrics to understand: cost per active user, cost per 1,000 feed loads, cost per
notification, cost per search, cost per GB delivered.

Avoid: always-on unused clusters, overprovisioning, unbounded logging (logger levels +
retention), duplicate data, expensive synchronous computation in request paths.

## 3. Viral event playbook

**Triggers:** creator viral moment, external share spike, challenge explosion, news-driven
traffic, celebrity mention, DDoS-like legitimate traffic.

**10x spike response (execute in order):**
1. Confirm CDN absorption — public endpoints already `Cache-Control` cached; verify hit rate.
2. Watch DB load; public read paths are cached (trending/leaderboard) or index-backed.
3. Watch queue depth; notification worker batches, so spikes become backlog not errors.
4. Do nothing else. The architecture is designed for read-heavy spikes.

**100x spike response:**
1. Increase cache TTLs for public keys (config, no deploy needed for values read from env).
2. Apply emergency rate limits on mutations (comment/reaction/follow/share) — existing
   per-IP + per-user layers, raise strictness via env.
3. Disable non-critical features via feature flags (`lib/featureFlags.js`) — analytics
   refresh, AI features, weekly recap, recommendations freshness.
4. Preserve core experience: auth, feed (fallback ranking if needed), safety, votes,
   payments (isolated capacity).
5. If writes bottleneck: batch/serialize heavy writes (battle tally RPC already
   transactional); consider turning off realtime broadcasts for non-critical tables.

**Never:** run ad-hoc schema changes, disable RLS, or bypass rate limits to "let traffic
in" — that's how outages happen.

## 4. Abuse traffic management

Layered defense already in place:

1. **Client shields** (`lib/rateLimit.js`) — 30s cooldown, duplicate detection.
2. **Server rate limits** (`lib/serverRateLimit.js`) — sliding window per IP + per user:
   roasts, reactions, battles, communities, challenges, invites, reports, AI, and (this
   release) comments, comment reactions, follows, shares.
3. **DB-backed checks** — blocked IPs (hashed), 5-roasts/10-min window, 1-hour duplicate
   detection, deterministic policy + profanity.
4. **Safety event log** — rate-limit triggers recorded via `recordSafetyEvent`.

Upgrades when abuse outgrows per-instance limits: shared Redis rate limiter, then
platform WAF (Cloudflare) for bot/scraping/flood defense. Never rely on IP alone — keys
combine IP + user identity where available.

## 5. Deployment, CI/CD & rollback

- **CI (this release):** `.github/workflows/ci.yml` runs install + build on every PR and
  push to `main` — untested code can't reach production silently.
- **Deployments:** Vercel Git integration; production deploys from `main`. High-risk
  changes use feature flags + gradual rollout (canary via Vercel previews → prod).
- **Rollback:** previous production deployment is one click; migrations are always
  backward-compatible so old code runs on new schema.
- **Environments:** `LOCAL` (`.env.local`), Vercel **Preview** (per-PR, isolated env
  vars), **Production**. Staging = a second Supabase project + Vercel project wired to
  `main`-branch previews. Never test dangerous infra changes directly in production.

## 6. Feature flags

`lib/featureFlags.js` — env-driven flags (`NEXT_PUBLIC_FEATURE_*`). Supports dev, beta,
percentage rollout and emergency disable without a deploy. Lifecycle: flags are removed
once fully rolled out; the file documents defaults per environment.

## 7. Security at scale

- Secrets: env vars only, never in code (`.env.local` is gitignored).
- Least privilege: anon key for client, service role server-side, per-job roles later.
- Webhooks: signature verification (`lib/monetization/webhook.js`) — never trust the
  caller.
- Cron endpoints: `CRON_SECRET` bearer check on every scheduled route.
- Rate limiting + input validation on every mutation; RLS as the ultimate boundary.
- Audit logging for admin/moderation actions; retention enforced by daily cleanup cron.

## 8. Environments & config isolation

`.env.local` is for local dev; Vercel Preview/Production have their own env var sets.
Supabase project per environment. Any credentials shown in this repo's docs are examples
only — real values live in the platform secret stores.