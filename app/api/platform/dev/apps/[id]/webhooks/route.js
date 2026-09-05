import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';

/**
 * POST /api/platform/dev/apps/[id]/webhooks
 *
 * Register a signed webhook endpoint for the developer's own app. The
 * signing secret is returned exactly once (only its hash is stored) and is
 * used to verify outbound payloads (X-BurnBoard-Signature).
 *
 * Body: { url: string (https only), event_types: string[] }
 *   Allowed event types: content.published, app.access_granted,
 *   app.access_revoked.
 */
export async function POST(req, { params }) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const appId = params?.id;
    if (!appId) return NextResponse.json({ error: 'missing_app' }, { status: 400 });

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    const { data, error } = await client.rpc('register_webhook', {
      p_app_id: appId,
      p_url: String(body?.url || ''),
      p_event_types: Array.isArray(body?.event_types) ? body.event_types : [],
    });

    if (error || !data?.length || data[0].error) {
      const errCode = data?.[0]?.error || error?.message;
      return NextResponse.json({ error: errCode || 'webhook_failed' }, { status: 400 });
    }

    return NextResponse.json({
      webhookId: data[0].webhook_id,
      signingSecret: data[0].signing_secret, // shown exactly once
    });
  } catch (err) {
    console.error('[Dev Portal] Register webhook error:', err?.message || err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}