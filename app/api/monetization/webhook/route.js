import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { handleProviderWebhook } from '@/lib/monetization/webhook';

/**
 * POST /api/monetization/webhook?provider=cc_sandbox
 *
 * Provider-facing webhook endpoint. Signature verified over the RAW body via
 * the provider driver; events ingest idempotently (replays are no-ops) and
 * only verified events can promote purchases/entitlements/earnings.
 *
 * Heads-up: this route intentionally does not require a session — the
 * webhook is a server-to-server channel. The signature + event-existence
 * gates in the pipeline are what make forgery ineffective; real providers
 * will additionally route through a service-role client.
 */
export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider') || 'cc_sandbox';
    const signature = req.headers.get('x-burnboard-signature') || '';

    const rawBody = await req.text();
    if (!rawBody) {
      return NextResponse.json({ error: 'missing_body' }, { status: 400 });
    }

    const { client } = await getRequestContext(req);
    if (!client) {
      return NextResponse.json({ error: 'backend_unavailable' }, { status: 503 });
    }

    const result = await handleProviderWebhook({ client, provider, rawBody, signature });

    if (!result.ok) {
      // Signature failures and mismatches are 400/409 — never retried blindly.
      const status = result.reason === 'replayed' ? 200 : result.reason === 'signature_invalid' ? 401 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[Monetization] Webhook route error:', err?.message || err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}