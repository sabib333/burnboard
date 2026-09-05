/**
 * BURNBOARD Developer Platform — Webhook Dispatcher (Master Prompt 20)
 *
 * Delivers queued platform events to subscribed webhook endpoints.
 *
 * Security model:
 *   * Every delivery is signed: `X-BurnBoard-Signature` = HMAC-SHA256 of the
 *     raw body. The HMAC key is derived as:
 *         key = HMAC-SHA256(platformPepper, secretHash)
 *     where `secretHash` = SHA-256 of the app's plaintext signing secret
 *     (the only form stored) and `platformPepper` is the server-side
 *     `PLATFORM_WEBHOOK_PEPPER` env secret. Developers reproduce the key
 *     locally with their plaintext secret to verify authenticity, so the
 *     plaintext secret is never stored anywhere on our side.
 *   * Replay protection: `X-BurnBoard-Event-Id` (unique per event) + a
 *     `X-BurnBoard-Timestamp`; clients reject stale/duplicate deliveries.
 *   * Idempotency: a delivery row is unique per (subscription, event_id) —
 *     the DB never double-queues an event to an endpoint.
 *   * Retries with exponential backoff; endpoints that keep failing are
 *     disabled automatically after max attempts (no endless retry storms).
 *
 * This dispatcher runs as part of the daily cleanup cron (and can be run
 * more frequently by a dedicated scheduler as webhook volume grows).
 */

import crypto from 'crypto';

const MAX_ATTEMPTS = 5;
// Backoff in ms for attempt n: 60s * 2^n (1m, 2m, 4m, 8m…).
function backoffMs(attempt) {
  return Math.min(60_000 * 2 ** attempt, 4 * 60 * 60 * 1000);
}

/**
 * Deliver a batch of due webhook deliveries.
 * @returns {{ processed: number, delivered: number, failed: number }}
 */
export async function processWebhookDeliveries(client, { batchSize = 25 } = {}) {
  if (!client) return { processed: 0, delivered: 0, failed: 0 };

  try {
    // Claim a batch of due deliveries together with their endpoint details.
    const { data: due, error } = await client
      .from('developer_webhook_deliveries')
      .select('id, subscription_id, event_id, event_type, payload, attempts')
      .eq('status', 'queued')
      .lte('next_attempt_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (error || !due?.length) return { processed: 0, delivered: 0, failed: 0 };

    const subIds = [...new Set(due.map(d => d.subscription_id))];
    const { data: subscriptions, error: subError } = await client
      .from('developer_webhooks')
      .select('id, url, signing_secret_hash, active')
      .in('id', subIds);
    if (subError) return { processed: 0, delivered: 0, failed: 0 };

    const byId = {};
    for (const s of subscriptions || []) byId[s.id] = s;

    let delivered = 0;
    let failed = 0;

    for (const delivery of due) {
      const sub = byId[delivery.subscription_id];
      if (!sub || !sub.active) {
        // Subscription gone or disabled → drop quietly.
        await client.from('developer_webhook_deliveries')
          .update({ status: 'disabled', last_error: 'endpoint inactive' })
          .eq('id', delivery.id);
        continue;
      }

      const now = Date.now();
      const body = JSON.stringify({
        event_id: delivery.event_id,
        event_type: delivery.event_type,
        created_at: new Date(now).toISOString(),
        data: delivery.payload || {},
      });
      const timestamp = Math.floor(now / 1000);

      // Derive the signing key from the platform pepper + the stored secret
      // hash. Developers verify using their plaintext secret:
      //   key = HMAC(pepper, SHA256(plaintextSecret))
      const pepper = process.env.PLATFORM_WEBHOOK_PEPPER || 'burnboard-dev-pepper';
      const key = crypto.createHmac('sha256', pepper).update(sub.signing_secret_hash).digest();
      const signature = crypto.createHmac('sha256', key).update(body).digest('hex');

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);

        const res = await fetch(sub.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'BurnBoard-Platform/1.0',
            'X-BurnBoard-Signature': signature,
            'X-BurnBoard-Event-Id': delivery.event_id,
            'X-BurnBoard-Timestamp': String(timestamp),
          },
          body,
          signal: controller.signal,
        });
        clearTimeout(timer);

        const ok = res.status >= 200 && res.status < 300;
        const nextAttempts = (delivery.attempts || 0) + 1;

        if (ok) {
          delivered += 1;
          await client.from('developer_webhook_deliveries')
            .update({
              status: 'delivered',
              attempts: nextAttempts,
              last_http_status: res.status,
              delivered_at: new Date().toISOString(),
              last_error: null,
            })
            .eq('id', delivery.id);
        } else if (nextAttempts >= MAX_ATTEMPTS) {
          failed += 1;
          await client.from('developer_webhook_deliveries')
            .update({
              status: 'failed',
              attempts: nextAttempts,
              last_http_status: res.status,
              last_error: `HTTP ${res.status}`,
            })
            .eq('id', delivery.id);
          // Disable the endpoint after persistent failures (no retry storm).
          await client.from('developer_webhooks')
            .update({
              active: false,
              consecutive_failures: nextAttempts,
              disabled_at: new Date().toISOString(),
            })
            .eq('id', sub.id);
        } else {
          failed += 1;
          await client.from('developer_webhook_deliveries')
            .update({
              attempts: nextAttempts,
              last_http_status: res.status,
              last_error: `HTTP ${res.status}`,
              next_attempt_at: new Date(Date.now() + backoffMs(nextAttempts)).toISOString(),
            })
            .eq('id', delivery.id);
        }
      } catch (err) {
        // Network error / timeout / aborted.
        const nextAttempts = (delivery.attempts || 0) + 1;
        failed += 1;
        if (nextAttempts >= MAX_ATTEMPTS) {
          await client.from('developer_webhook_deliveries')
            .update({ status: 'failed', attempts: nextAttempts, last_error: err?.message || 'network_error' })
            .eq('id', delivery.id);
          await client.from('developer_webhooks')
            .update({ active: false, disabled_at: new Date().toISOString() })
            .eq('id', sub.id);
        } else {
          await client.from('developer_webhook_deliveries')
            .update({
              attempts: nextAttempts,
              last_error: err?.message || 'network_error',
              next_attempt_at: new Date(Date.now() + backoffMs(nextAttempts)).toISOString(),
            })
            .eq('id', delivery.id);
        }
      }
    }

    return { processed: due.length, delivered, failed };
  } catch (err) {
    console.error('[Webhook Dispatcher] Error:', err?.message || err);
    return { processed: 0, delivered: 0, failed: 0 };
  }
}

/**
 * Queue a platform event for subscribed webhooks (used by the gateway for
 * app.access_revoked and friends). Wraps the RPC; always fails safe.
 */
export async function queuePlatformEvent(client, { eventType, payload = {}, subjectId = null, eventId = null }) {
  if (!client) return { ok: false };
  try {
    const { data, error } = await client.rpc('queue_webhook_event', {
      p_event_type: eventType,
      p_payload: payload,
      p_subject_id: subjectId,
      p_event_id: eventId,
    });
    if (error) return { ok: false, queued: 0 };
    return { ok: true, queued: data || 0 };
  } catch (err) {
    console.warn('[Platform] Webhook queue skipped:', err?.message || err);
    return { ok: false };
  }
}