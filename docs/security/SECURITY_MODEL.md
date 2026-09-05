# BurnBoard Security Model (Master Prompt 26)

Security, privacy, account protection, abuse defense, and cyber resilience —
stated honestly: what is enforced, what is monitored, what is deferred, and
who owns the residual risk. Companion to the MP21 hardening register
(`docs/infrastructure/HARDENING_AUDIT.md`) and the MP16 operations docs.

## 1. Security posture (what is actually enforced today)

| Layer | Control | Status |
| --- | --- | --- |
| Edge / network | TLS everywhere; host-level WAF + DDoS absorption (Vercel managed — **ops action to enable/rule-review**, not assumed) | 🟡 ops action |
| Browser | Security headers in middleware (frame/mime/referrer/permissions). **CSP deliberately omitted** until origins are locked down (Stage B) | 🟡 tracked |
| Identity | Supabase Auth (email/password, JWT sessions, refresh, optional email confirm). MFA/password-reset live in the auth provider config — enabled per instance, not client code | 🟡 provider-config |
| Authorization | RLS is the data authority on every table; owner-scoped writes; moderator/safety actions are definer-RPC + session gated; **admin dashboards now gate server-side (MP26)** | ✅ |
| Secrets | Env-only; `.env.local` ignored; CI secret-scan guard; no secret in client bundles; logger redacts | ✅ |
| Financial | Append-only ledger, idempotent webhooks, refund/cancel RPCs, monetization audit | ✅ |
| Content | Deterministic rules + AI-advisory moderation; DB-enforced moderation state; block/mute/restriction system | ✅ |
| Rate limiting | Per-IP + per-user on mutations (per-instance memory; shared cache is the Stage-2 upgrade) | 🟡 Stage 2 |

## 2. What Master Prompt 26 added

### 2.1 Admin gate hardened (fail closed, server-verified)

Before: every `/admin*` page embedded `const ADMIN_PASSWORD = 'burn2024'`,
compared it client-side, and admin APIs fell back to `process.env.ADMIN_PASSWORD || 'burn2024'`.
Setting a real env var actually **broke** the dashboards, and an unset env left
every admin surface protected only by the public default. This was the #1
tracked hardening item.

Now:

- **`lib/adminGate.js`** — single server-side authority. `checkAdminAccess(req)`
  accepts either the cron bearer (`CRON_SECRET`) or the `x-admin-password`
  header; secrets are compared in constant time (SHA-256 both sides +
  `timingSafeEqual`). **There is no default**: if `ADMIN_PASSWORD` is unset,
  every admin endpoint returns `503 admin_not_configured` (fail closed).
- **`POST /api/admin/verify`** — the only way a dashboard unlocks. Per-IP rate
  limited (10 / 5 min), records success/failure as security events. The
  client never sees or stores the expected value.
- **`components/admin/useAdminAuth` + `AdminAccessLock`** — shared client
  gate used by `/admin`, `/admin/growth`, `/admin/financials`,
  `/admin/infrastructure`, `/admin/security`. The verified secret lives in
  React state only (never localStorage/sessionStorage); the old
  `burnboard_admin_unlocked` auto-unlock flag is gone.
- **Every admin API converted** to the gate: `/api/admin/financials`,
  `/api/admin/infrastructure`, `/api/growth/analytics`, `/api/growth/alerts`,
  `/api/growth/events` (GET funnel — POST stays open for server-side event
  recording), and `/api/experiments/manage` (previously **unauthenticated**:
  anyone could activate/pause experiments that gate live features).
- **`ADMIN_PASSWORD` + `CRON_SECRET` documented** in `.env.example`.

### 2.2 Security event logging is now real

The `security_logs` table existed (with 30-day cron retention) but had **no
live writers**. Now `lib/securityEvents.js` records coarse, safe events:
admin unlock success/failure (hashed IP only) and admin actions (e.g.
experiment lifecycle changes). Never passwords, tokens, or content.

### 2.3 Security operations dashboard

- `GET /api/admin/security` (admin-gated) — 24h failure/success aggregates,
  per-hashed-IP velocity, a simple anomaly flag (≥5 failed unlocks from one
  IP in 24h), and the recent event feed. Failure-soft: absent table →
  `available: false`, never a fabricated all-clear.
- `/admin/security` — read-only dashboard over that API, linked from the
  admin console.

## 3. Security event taxonomy

| Action | Meaning | Written by |
| --- | --- | --- |
| `admin_verify_success` | Admin gate unlocked correctly | `/api/admin/verify` |
| `admin_verify_failed` | Wrong admin secret presented | `/api/admin/verify` |
| `admin_action` | Admin surface state change (e.g. experiment lifecycle) | experiments manage route |
| `account_export` | User downloaded their own data | (reserved — export flow) |
| `rate_limit_exceeded` | Admin-facing endpoint throttled | (reserved) |

Retention: 30 days, purged by the daily cleanup cron. IPs stored as SHA-256
hashes; displayed truncated.

## 4. Trust boundaries (summary)

```
BROWSER ──(TLS, SameSite cookies)──> EDGE ──> NEXT.js ROUTE ──> SUPABASE
  │                                     │       │  │   │          │
  │ anonymous visitors                  │       │  │   └── service role (server-only)
  │ (RLS public reads only)             │       │  └──── cron bearer (CRON_SECRET)
  │                                     │       └─────── admin secret (ADMIN_PASSWORD)
```

- Client code holds only the anon key → RLS decides every data read.
- Service-role key: server-only routes (cron, webhooks, admin aggregates).
- Admin secret: dashboards + management APIs, verified server-side.
- Moderators: authenticated Supabase sessions checked against the moderator
  flag via definer RPCs — separate from the shared admin gate.

## 5. Known gaps & residual risk (with owners)

| Gap | Why it remains | Owner / trigger |
| --- | --- | --- |
| CSP not set | Origins (auth, images, fonts) not yet enumerated; a wrong policy breaks the product. Lockdown is a Stage-B hardening task | Engineering — Stage B |
| MFA not enabled per instance | Supported by Supabase Auth; enabling (and TOTP enrollment UI) is an instance config + product decision | Ops + Product |
| User-facing data export / deletion flow | Architecture defined in the audit; a safe cross-table purge needs the full schema applied + restore drill before shipping destructive code | Privacy + Engineering |
| Wildcard CORS on `/api/*` | Present since the static-app era; same-site cookie auth prevents credentialed cross-origin reads, but origins should be locked once preview deployments allow it | Engineering |
| WAF enabled / rules reviewed | Host-level managed edge; must be explicitly enabled | Ops |
| Security alerts routed externally | In-app dashboard exists; SIEM/alert routing is Stage B (OBSERVABILITY.md) | Stage B |
| Restore drills / load baseline | Documented quarterly requirement; not yet executed against staging | Ops |

No compliance certification (SOC 2 / GDPR / HIPAA) is claimed. The account
recovery / MFA / privacy-request specifics are jurisdiction-dependent and
require qualified legal review before claims are made.

## 6. Related documents

- `docs/infrastructure/SECURITY.md` (MP21 layered posture)
- `docs/infrastructure/HARDENING_AUDIT.md` (evidence register)
- `docs/infrastructure/DISASTER_RECOVERY.md` (SEV-1..4, runbooks)
- `docs/infrastructure/PRIVACY.md` (data retention & privacy posture)
- `docs/platform/PLATFORM_GOVERNANCE.md` (developer platform authorization)
