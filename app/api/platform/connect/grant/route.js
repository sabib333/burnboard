import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { filterValidScopes } from '@/lib/platform';

/**
 * POST /api/platform/connect/grant
 *
 * EXPLICIT USER CONSENT. The authenticated user reviews exactly what an app
 * is asking for and grants scoped access to their OWN data. Unknown or
 * unapproved scopes are never granted (dropped server-side + in the RPC).
 * Returns the plaintext bearer token exactly once.
 *
 * Body: { app_id, scopes: string[] }
 */
export async function POST(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    if (!body?.app_id) return NextResponse.json({ error: 'missing_app_id' }, { status: 400 });

    // Server-side scope whitelist — only known scopes can ever be requested.
    const scopes = filterValidScopes(body.scopes);
    if (!scopes.length) return NextResponse.json({ error: 'no_valid_scopes' }, { status: 400 });

    // The app must exist and be visible so consent is informed. Only public
    // metadata (name/website/status) is fetched; the RPC enforces approved
    // scope intersection server-side.
    const { data: appRows, error: appError } = await client.rpc('public_app_metadata', {
      p_app_ids: [body.app_id],
    });
    if (appError || !appRows?.length) return NextResponse.json({ error: 'app_not_found' }, { status: 404 });
    const app = appRows[0];
    if (app.status === 'suspended' || app.status === 'revoked') {
      return NextResponse.json({ error: 'app_not_active' }, { status: 403 });
    }

    const { data, error } = await client.rpc('grant_app_access', {
      p_app_id: body.app_id,
      p_scopes: scopes,
    });

    if (error || !data?.length || data[0].error) {
      return NextResponse.json({ error: data?.[0]?.error || 'grant_failed' }, { status: 400 });
    }

    return NextResponse.json({
      token: data[0].token, // returned exactly once
      tokenPrefix: data[0].token_prefix,
      appName: app.app_name,
      scopes,
    });
  } catch (err) {
    console.error('[Platform Connect] Grant error:', err?.message || err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}