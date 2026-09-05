# Developer Platform Architecture

## Layers

```
BURNBOARD CORE (product + domain services)
    ↓
PLATFORM API LAYER   (/api/platform/v1 — stable, versioned capabilities)
    ↓
AUTHORIZATION LAYER  (bearer grants → scopes → subject; rate limits)
    ↓
DEVELOPER APPLICATIONS (registered, reviewed, governable)
```

Internal `/api/*` routes are for the BurnBoard product. Third parties only
ever see `/api/platform/*`. Nothing proxies database tables; the public API
represents stable product capabilities (profile, content) — each of which
maps to the same domain logic the product itself uses.

## Application model & lifecycle

Every app has an owner, metadata, redirect URIs, status, trust level,
platform-approved scopes, and a kill-switch.

```
development → review → approved → (active use)
                ↘          ↘ limited (rate-capped)
                             ↘ suspended / revoked (abuse, policy)
```

- New apps start in `development` with **no approved scopes**.
- Platform review grants scopes and production status (`admin_update_app_status`).
- `kill_switch` immediately stops ALL tokens + webhooks for an app
  (checked on every gateway validation).
- `suspended` / `revoked` apps fail validation instantly.

## Credentials

`issue_app_credential` generates `bb_secret_…` (random 24 bytes), stores
only `SHA-256(secret)` + an 8-char prefix for identification, and returns
the plaintext **exactly once**. The Developer Portal shows it in a single
copy-now dialog. Credentials are environment-scoped (development /
sandbox / production).

## Grants & tokens (the consent model)

A token is a **grant**: one user explicitly allowed one app scoped access
to their own data.

```
User visits consent flow
  → app name + website shown (informed consent)
  → user sees each requested scope in plain language
  → user approves
  → grant_app_access() intersects requested scopes with the app's
    platform-approved scopes (unknown scopes silently dropped)
  → bearer token issued (hash at rest, 365-day expiry, one-time plaintext)
```

- Revocation is immediate and user-owned: `/settings/apps` lists every
  grant with its exact scopes; revoking deletes the grant server-side.
- A revoked token fails `validate_access_token` on the next request, even
  if the app cached it.
- The gateway caches validation briefly (15s) for latency; revocation
  propagates within that window by design.

## Public API v1

All endpoints: `Authorization: Bearer <token>`, per-app rate limits
(sliding window; development apps get 30 req/min, approved 120 req/min),
scope enforcement server-side.

| Endpoint | Scope | What it returns/does |
| --- | --- | --- |
| `GET /api/platform/v1/me` | `profile.read` | Public profile of the granting user (never private data) |
| `GET /api/platform/v1/posts` | `content.read` | The granting user's public posts, cursor-paginated |
| `POST /api/platform/v1/posts` | `content.publish` | Publish text content AS the granting user |

`POST /posts` runs the deterministic safety policy and the subject's
restriction/ban check before writing — identical protections to first-party
publishing. Apps can never publish content that bypasses moderation, and
never on behalf of a user who revoked access.

## Scopes

The catalog (`lib/platform/scopes.js`) is the only source of truth — no
scope can be invented at runtime, and `grant_app_access` intersects any
request with the app's approved list. Adding a scope is a deliberate
change: catalog entry → platform approval per app → grant flow picks it up.

## Isolation & abuse posture

- Platform traffic is rate limited per app (never one global bucket).
- Webhook delivery is a bounded queue with retries — an abusive endpoint
  disables itself, it can never starve the core.
- Audit (`developer_platform_audit`) records registrations, credential
  issuance, grants, revocations, webhook registration, and admin status
  changes. No secrets ever enter the audit log.
- Emergency kill switch: flip `kill_switch` (or status → `suspended`) and
  every token + webhook for that app stops on the next request — no deploy
  needed.