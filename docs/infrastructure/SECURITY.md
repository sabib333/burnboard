# BurnBoard Security Architecture (Enterprise Readiness)

Master Prompt 21 security posture: layered defenses, least privilege,
centralized secrets, and auditability — scaled together with the user base,
never weakened for performance or cost.

## Security layers (defense in depth)

```
EDGE        CDN + managed DDoS absorption (Vercel edge network)
NETWORK     TLS 1.2+ everywhere; no plaintext service traffic
APP         Next.js middleware security headers; rate limits on mutations
AUTH        Supabase Auth (JWT sessions, refresh, RLS evaluated server-side)
API         Internal routes never public; /api/platform/* governed + scoped
DATA        RLS on every table; owner/subject read policies; no client writes
SECRETS     Vercel env + Supabase secret stores; never in git
AUDIT       security_logs, monetization audit, developer-platform audit
```

**No single layer is trusted alone.** RLS is enforced in the database even
when application code has a bug; webhook signatures are verified even when
routes are internal; rate limits exist even when accounts are authenticated.

## Zero Trust principles applied

1. **No network is implicitly trusted.** RLS is the authority for every
   data read — an API route that forgets a check still cannot read what RLS
   hides (verified by the `auth.uid()`-based policies across all tables).
2. **Least privilege by default.** Service-role keys are only used in
   server-only routes (cron, webhooks, admin). The anon key + RLS is the
   client path. No client ever holds a service-role credential.
3. **Service boundaries are explicit.** The Developer Platform (MP20) is a
   separate authorization layer; monetization RPCs are SECURITY DEFINER and
   service-role gated for destructive paths (refunds).
4. **Auditability.** Financial actions, moderation actions, and developer
   platform actions all append to dedicated audit tables. No silent
   privileged change is possible.

## Secrets management

| Secret class | Storage | Rotation |
| --- | --- | --- |
| Supabase keys | Vercel env (`NEXT_PUBLIC_*` for public, others private) | On key regeneration |
| `CRON_SECRET` | Vercel env (private) | Quarterly / on suspicion |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env (server-only) | On regeneration; never client-side |
| Payment provider keys | Vercel env (MP15 provider abstraction) | Per provider policy |
| `GEMINI_API_KEY` | Vercel env / AI Studio secret | Per provider policy |
| FCM / Resend keys | Vercel env | Per provider policy |
| `PLATFORM_WEBHOOK_PEPPER` | Vercel env (server-only) | On developer credential regeneration |
| Admin gate password | Env `ADMIN_PASSWORD` (no default — fail closed; see MP26 hardening) | On key regeneration; unset env locks admin surfaces with 503 |

Rules: no secret in git (`.env.local` ignored; scan CI runs a
secret-pattern guard), no secret in client bundles, no secret in logs
(`lib/logger.js` redacts), no plaintext in the DB (app credentials and webhook
signing secrets are stored as SHA-256 hashes, MP20).

## Encryption

- **In transit:** TLS everywhere (Vercel edge terminates; Supabase, Resend,
  FCM, Stripe all TLS). HSTS is managed at the edge/host level.
- **At rest:** Supabase Postgres storage encryption (provider-managed);
  Vercel functions/static encrypted at rest. No custom cryptography is used
  anywhere — HMAC-SHA256 and SHA-256 from Node crypto only.
- **Key separation:** env secrets are per-environment (local / preview /
  production). A preview deployment can never read production secrets.

## API & application security

- Input validation on every mutation route (length, type, enum checks).
- Rate limiting: `lib/serverRateLimit.js` (per-IP + per-user) on all
  mutations; platform API has per-app limits (MP20); auth endpoints limited.
- Safety pipeline (`lib/safety.js`) runs **before** any content write and is
  authoritative — moderation state is enforced in RLS read policies too
  (removed content is invisible at the database level, not just the UI).
- CSRF posture: state-changing routes require the session cookie (Supabase
  SSR); cross-site form posts cannot carry the session.
- Content security: no raw HTML rendering from user content (text posts are
  rendered as text); media URLs validated.
- The CSP gap remains tracked in [HARDENING_AUDIT.md](./HARDENING_AUDIT.md)
  (Stage B hardening). The shared admin-password gate was **hardened in
  MP26** (fail closed, server-verified) — see
  [docs/security/SECURITY_MODEL.md](../security/SECURITY_MODEL.md).

## Abuse & bot management

- In-app: rate limits, deterministic safety rules, restriction system
  (`user_restrictions`), block lists, moderation queue.
- Edge: Vercel's managed edge network provides DDoS absorption and the WAF
  (when enabled at the host level — **documented as an ops action**, not
  assumed). The application does not rely on a WAF as its only control.
- Platform API (MP20): per-app rate limits, kill switches, audit trail.

## Security monitoring

- `security_logs` table captures security-relevant events (admin gate
  success/failure, admin actions — hashed IPs only, never secrets/content)
  with **30-day retention, cleaned by the daily cron**, surfaced in the
  Security Operations dashboard (`/admin/security`, MP26).
- Metrics (MP16) track error rates and rate-limit triggers per path.
- Structured logs carry `x-request-id` end to end for correlation.
- Alerting (OBSERVABILITY.md §3) covers auth outages and error-rate spikes.

## Security incident response

Severity and runbooks live in [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md)
(incident severity SEV-1..4) and [OPERATIONS.md](./OPERATIONS.md). Security-
specific playbooks:

| Incident | First move | Containment |
| --- | --- | --- |
| Credential leak (env) | Rotate the credential immediately | Audit access; redeploy |
| `CRON_SECRET` exposure | Rotate; all cron endpoints fail closed until then | No cleanup/queue work can run unauthenticated |
| Service-role key exposure | Rotate + revoke; audit queries | RLS still constrains reads even with the key misused |
| Malicious developer app | Kill switch → suspend (MP20) | One request, no deploy |
| Payment webhook forgery attempt | Signature verification rejects | `monetization_payment_events` uniqueness prevents double-credit |
| DB breach / data exposure | PITR restore + key rotation | Audit logs identify scope; DR runbook applies |

## What is intentionally NOT claimed

- No compliance certification (SOC 2 / GDPR / HIPAA) is claimed anywhere —
  see PRIVACY.md and HARDENING_AUDIT.md for the honest status.
- No "billion-user security" claim: the posture above is proven for the
  current single-region, single-Postgres stage; the audit document lists
  exactly what must change at each scale stage.