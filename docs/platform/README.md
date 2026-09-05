# BurnBoard Developer Platform — Master Prompt 20

The controlled, secure, extensible ecosystem: a developer platform with
scoped user consent, a versioned public API, signed webhooks, and platform
governance — without ever exposing internal services.

## Core principle

**Extensible but secure. Open but governed. Powerful but user-controlled.**

Third parties extend the ecosystem; they never control the foundation.
Every platform capability answers: who can use it, what data can they
access, why, how is consent obtained and revoked, how is abuse detected,
how are rate limits enforced, and how does it affect BurnBoard users?

## Documents

| Doc | Covers |
| --- | --- |
| [DEVELOPER_PLATFORM.md](DEVELOPER_PLATFORM.md) | Architecture, app model & lifecycle, tokens & grants, API v1 surface, scopes |
| [PLATFORM_GOVERNANCE.md](PLATFORM_GOVERNANCE.md) | Trust levels, app review, suspension & kill switches, audit, incident response, change management |
| [WEBHOOKS.md](WEBHOOKS.md) | Signing, verification, replay protection, retries, event catalog |
| [PLATFORM_ROADMAP.md](PLATFORM_ROADMAP.md) | Network effects, mini-apps, marketplace, API monetization, SDK strategy |

## What exists today

- **Governed app registry** — register apps (start in `development`), issue
  client credentials whose secrets are hashed at rest and returned exactly
  once, list your apps with credential prefixes.
- **Scoped user grants** — a user consents to granular scopes
  (`profile.read`, `content.publish`, `content.read`); tokens expire after
  365 days and are individually revocable from `/settings/apps`.
- **Public API v1** (`/api/platform/v1`) — bearer-token authenticated,
  per-app rate limited, scope-enforced: `GET /me`, `GET/POST /posts`.
  Third-party content publishing runs the same safety + restriction checks
  as first-party publishing — no moderation/blocking bypass.
- **Signed webhooks** — subscribe endpoints (HTTPS only), HMAC-signed
  deliveries with event ids + timestamps, idempotent queue, exponential
  backoff retries, auto-disable after persistent failures. Dispatcher wired
  into the daily cleanup cron.
- **Audit trail** — every app/credential/grant/webhook action appended.
- **Developer Portal** (`/developer`) and **Connected Apps** (`/settings/apps`).

## API surface (all additive)

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET/POST /api/platform/dev/apps` | session (owner) | List / register apps |
| `POST /api/platform/dev/apps/[id]/credential` | session (owner) | Issue secret (once) |
| `POST /api/platform/dev/apps/[id]/webhooks` | session (owner) | Register webhook (once) |
| `GET /api/platform/connect` | session (me) | List my grants |
| `DELETE /api/platform/connect` | session (me) | Revoke a grant |
| `POST /api/platform/connect/grant` | session (me) | Explicit scoped consent |
| `GET /api/platform/v1/me` | bearer + `profile.read` | Granting user's public profile |
| `GET /api/platform/v1/posts` | bearer + `content.read` | Granting user's public posts |
| `POST /api/platform/v1/posts` | bearer + `content.publish` | Publish as granting user |

## Boundaries that are never crossed

- No database access is exposed; no internal `/api/*` route is reachable by
  third parties.
- No moderation/fraud tables or RPCs are exposed.
- No `FULL_ACCESS` scope exists; scopes are per-app approved.
- Apps act as the consenting user — they cannot impersonate, bypass
  blocking, or read others' private data.
- Secrets are never stored in plaintext and never shown twice.