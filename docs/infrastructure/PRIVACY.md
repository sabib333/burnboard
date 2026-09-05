# BurnBoard Privacy Engineering

Privacy is engineered into the architecture — not a frontend settings page.
This document records data classification, minimization, retention,
deletion propagation, export, and auditability, and is honest about what is
architecturally ready vs. what needs legal/operational verification.

## Data classification

| Class | Examples | Controls |
| --- | --- | --- |
| **Public** | usernames, public posts, community membership, creator profiles | Public RLS read; platform API only exposes this class |
| **Internal** | moderation queues, safety events, feature usage | Server-only; no read policies for clients |
| **Confidential** | private messages, private communities, draft content, share analytics | Owner/subject RLS read; route layer enforces relationships (blocks/mutes) |
| **Sensitive** | emails (auth), device tokens (FCM), payment records, payout details, audit logs | Owner-only + SECURITY DEFINER/service-role; hashed where storable (tokens, secrets); never in logs |

Each class has different retention and access rules — they are never given
the same treatment.

## Data minimization

- Signup collects email (auth) + username; profile fields are user-supplied
  and optional. Locale is captured as a coarse language signal (en/bn/hi),
  never precise location.
- Behavioral signals feed recommendations but are stored as aggregate
  affinity rows with idempotency keys — not raw scroll logs.
- The platform API (MP20) exposes exactly the scopes a user grants; the
  minimum dataset is enforced at the RPC/policy level, not by convention.
- AI analysis uses aggregate numbers or the minimum necessary content and
  never sends private data to providers unnecessarily (MP17).
- **No analytics or AI pipeline collects data "because it might be useful
  later"** — each event has a product purpose (see DATA_SCALING §event
  contracts and AI_ROADMAP retention rules).

## Retention

| Data | Retention | Enforcement |
| --- | --- | --- |
| Auth accounts | Until deletion | Supabase managed |
| Content (posts/roasts/comments) | Indefinite until deleted | Deletion propagates (below) |
| `security_logs` | 30 days | Daily cleanup cron (tested) |
| Notifications | 90 days, cleanup RPC | Daily cleanup cron |
| AI logs / usage | 90 days (`cleanup_ai_data`) | Daily cleanup cron |
| Revenue snapshots | 400 days (`cleanup` RPC) | Daily cleanup cron |
| Webhook deliveries | Kept for audit; failed deliveries disable endpoints | Queue bounded by design |
| Session/refresh tokens | Expire per Supabase policy | Provider-managed |

Retention is enforced by code paths that are exercised by the daily cron —
not by policy documents alone.

## User data deletion

Deletion must propagate everywhere a copy can exist:

1. **Primary DB rows** (auth, profiles, content, follows, reactions…)
   cascade via `ON DELETE CASCADE` foreign keys.
2. **Caches** — per-instance TTL caches expire within minutes; no cache is a
   source of truth, so deletion is never permanently cached.
3. **Search** — search is Postgres-backed today, so deletion is immediate at
   the source; a dedicated search engine (Stage B) must subscribe to the
   same deletion propagation events.
4. **RLS read paths** — removed content is filtered by `moderation_state`
   and visibility policies at the database layer.
5. **Third-party grants** — the Developer Platform revokes app access on
   user deletion via `ON DELETE CASCADE` on `developer_app_tokens`, and
   webhook deliveries to that user are subject-gated (MP20).
6. **AI metadata** — `ai_content_metadata`/`ai_usage_log` reference content
   and users; cleanup RPCs purge on the same cadence.
7. **Media / object storage** — Supabase Storage lifecycle policies are the
   Stage B mechanism (currently media is URL-referenced, not stored).

**Claimed status:** primary + cache + search (Postgres) propagation is real
today. A formal per-user "delete my data" flow that walks every derived
store and reports completion is a **tracked gap** (see audit) — we do not
claim deletion is complete while any copy could remain.

## Data export

- Users can already see their own content through the product (profiles,
  posts, comments) and their purchases via `/api/monetization/purchases`.
- A formal downloadable export (all user data, JSON) is **architected but
  not built**: it must be auth-required, delivered via a short-lived
  signed/expiring URL, and audited. Tracked in the audit, not claimed.

## Privacy auditability

- Sensitive financial actions append to `monetization_audit_log`
  (who/what/when, never secret material).
- Developer platform grants/revocations append to
  `developer_platform_audit`.
- Moderation actions append to safety/moderation audit tables.
- Logs redact PII (`lib/logger.js`) — privacy logs do not become privacy
  risks themselves.

## Data residency readiness

- Architecture keeps locale/region coarse and never stores precise location
  — a future regional deployment does not have to retrofit this.
- Supabase project region is the current single-residency boundary. True
  regional storage/processing is a **Stage C/D decision requiring legal +
  operational verification** — no residency compliance is claimed.

## Legal status (honest)

No GDPR/SOC-2/CCPA/other compliance is claimed. This document describes the
engineering controls that exist and the gaps that must close (formal
deletion flow, export, consent records for marketing, DPA with providers)
before any compliance claim is made.