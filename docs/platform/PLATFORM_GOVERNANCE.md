# Platform Governance

## Trust levels

| Level | Baseline capability | How it is earned |
| --- | --- | --- |
| `standard` | Default; reviewed app with approved scopes | Registration + platform review |
| `verified` | Higher rate limits; read scopes on more domains | Identity verification, demonstrated compliance |
| `trusted_partner` | Highest trust (still never unbounded) | Contract + ongoing monitoring + audit |

Trust is monitored continuously — it is never granted once and forgotten.
Rate limits tighten as trust falls; abuse review can drop an app several
levels in one action.

## App review workflow

1. App registers → `development` (no scopes).
2. Developer requests review (scopes + production environment).
3. Automated checks: HTTPS-only webhooks, scope necessity, metadata quality.
4. Policy review of the scope request (least privilege).
5. Manual review for high-risk access.
6. Outcome: `approved` (with scopes), `limited` (rate-capped), or
   `suspended`/`revoked`.

Popularity is never a review criterion.

## Abuse detection & suspension

Platform-owned signals (never self-reported):
- Excessive token issuance / repeated grants (velocity)
- Scraping patterns (pagination depth, burst reads beyond the consent scope)
- Publish spam (rate + content policy flags)
- Webhook endpoint instability or misuse

Actions, in increasing severity: warning → scope reduction → rate-limit
reduction → temporary suspension → permanent revocation → kill switch.

## Emergency controls

| Control | Effect | Response time |
| --- | --- | --- |
| App `kill_switch` | All tokens + webhooks fail validation | next request |
| Status → `suspended` | Same as kill switch + blocks new grants | next request |
| Status → `revoked` | Permanent; credentials dead | next request |
| (Future) endpoint-level disable | Shut one API path for all apps | config change |

None of these require a deploy — they are row changes read by the gateway
on every authenticated request.

## Audit log

Every important action is appended (`developer_platform_audit`):
app.registered, app.credential_issued, app.access_granted,
app.access_revoked, webhook.registered, admin.app_status_updated.

- Secrets never appear in audit rows (hashes only where useful).
- Logs are append-only; no UPDATE/DELETE policies exist on the table.

## Incident response (platform)

| Incident | First response | Containment |
| --- | --- | --- |
| API outage | Check gateway errors + rate limits | Isolate to the platform layer — core `/api/*` is untouched by design |
| Credential leak | Revoke credential; audit who issued it | Reissue; tell the developer |
| Malicious app | Kill switch → suspend → review | App gone in one request; core unaffected |
| Webhook attack | Disable endpoint; review deliveries | Bounded queue; signature checks hold |
| Mass abuse | Global scope/tier limit increase; per-app kill | Never a global outage |

## Change management for APIs

Public API changes follow: announce → document → version (`v1` today,
`v2` when incompatible) → deprecate with a migration window → monitor →
retire. Breaking a live developer app silently is treated as an incident.

## Third-party content actions

Apps may only publish with the `content.publish` scope AND the user's
active consent. Every platform publish:
- runs the same deterministic safety policy as the product,
- checks the subject's ban + active restrictions,
- is attributable (`metadata.app_id`) and auditable.

There is no silent mass publishing, no impersonation (posts are attributed
to the consenting user, never a fake actor), and no bypass of blocking,
privacy, or moderation — because the platform layer reuses the exact same
enforcement the first-party product uses.