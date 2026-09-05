# Platform Webhooks

## Event catalog (v1)

| Event | Payload (key fields) | Emitted when |
| --- | --- | --- |
| `content.published` | post_id, author_id, content_type, visibility, published_at, via_app | Content published through the platform API |
| `app.access_revoked` | (delivery scoped to that app + user) | A user revokes their grant to the app |

Events are only delivered to webhook subscriptions whose app has an ACTIVE
grant for the affected user — revoked apps receive nothing further.

## Delivery envelope

Every POST carries JSON:

```json
{
  "event_id": "evt_…",            // unique; same event to the same
                                  // subscription always has the same id
  "event_type": "content.published",
  "created_at": "2026-09-09T00:00:00.000Z",
  "data": { }
}
```

plus headers:

- `X-BurnBoard-Signature` — HMAC-SHA256 hex of the raw body.
- `X-BurnBoard-Event-Id` — echo of `event_id` (replay detection).
- `X-BurnBoard-Timestamp` — unix seconds (reject if older than ~5 min).
- `Content-Type: application/json`, `User-Agent: BurnBoard-Platform/1.0`.

## Signature verification (for developers)

The HMAC key is derived, never stored in plaintext on our side:

```js
// 1. server-side: stored secret hash = SHA256(your plaintext secret)
// 2. server-side: signing key = HMAC(platformPepper, secretHash)
//    platformPepper = BurnBoard's PLATFORM_WEBHOOK_PEPPER env secret
const crypto = require('crypto');
const key = crypto.createHmac('sha256', PLATFORM_PEPPER)
                  .update(crypto.createHash('sha256').update(YOUR_SECRET).digest('hex'))
                  .digest();
const expected = crypto.createHmac('sha256', key).update(rawBody).digest('hex');
// compare expected === X-BurnBoard-Signature (timing-safe)
```

BurnBoard publishes the current pepper in the developer portal and API
docs so developers can reproduce the key. **Verify every delivery**: reject
bad signatures, reject events older than 5 minutes, and deduplicate on
`event_id`.

## Retries, backoff, failure handling

- Deliveries are idempotent per (subscription, event_id) — duplicates are
  impossible at the queue level.
- Retries use exponential backoff: ~1m, 2m, 4m, 8m… capped at 4h.
- A delivery fails permanently after 5 attempts.
- An endpoint that persistently fails is **automatically disabled**
  (`active = false`) — no endless retry storms. Re-enable after fixing.
- Timeouts: each attempt aborts after 10 seconds. Non-2xx responses and
  network errors count as failures and are retried.

## Dispatcher

`lib/platform/webhooks.js → processWebhookDeliveries()` runs inside the
daily cleanup cron (`/api/cron/cleanup`) and can be scheduled
independently as webhook volume grows. Queue depth, delivered/failed
counts, and last HTTP statuses live in `developer_webhook_deliveries`.

## Rules for webhook endpoints

- HTTPS only (enforced at registration).
- Endpoint must tolerate duplicate, delayed, and out-of-order delivery.
- The endpoint must not echo sensitive data back; treat payloads as
  public-event metadata (author ids and post ids — never private content).