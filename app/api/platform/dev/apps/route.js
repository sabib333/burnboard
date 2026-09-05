import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';

/**
 * GET  /api/platform/dev/apps — the developer's own apps (summary).
 * POST /api/platform/dev/apps — register a new app (development status;
 * platform review grants scopes + production status later).
 *
 * These are first-party portal routes: session-authenticated, owner-scoped.
 * No plaintext secrets are ever returned by GET — only metadata + credential
 * prefixes for identification.
 */
export async function GET(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: apps, error } = await client
      .from('developer_apps')
      .select('id, name, description, website, status, trust_level, allowed_scopes, kill_switch, created_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

    // Credential prefixes (never hashes) for developer identification.
    const appIds = (apps || []).map(a => a.id);
    const credsByApp = {};
    if (appIds.length) {
      const { data: creds } = await client
        .from('developer_app_credentials')
        .select('app_id, environment, secret_prefix, created_at, revoked_at')
        .in('app_id', appIds);
      for (const c of creds || []) {
        credsByApp[c.app_id] = credsByApp[c.app_id] || [];
        credsByApp[c.app_id].push({
          environment: c.environment,
          prefix: c.secret_prefix,
          created_at: c.created_at,
          revoked: !!c.revoked_at,
        });
      }
    }

    return NextResponse.json({
      data: (apps || []).map(a => ({ ...a, credentials: credsByApp[a.id] || [] })),
    });
  } catch (err) {
    console.error('[Dev Portal] List apps error:', err?.message || err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

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

    const { data, error } = await client.rpc('register_developer_app', {
      p_name: String(body?.name || '').trim(),
      p_description: String(body?.description || '').slice(0, 500),
      p_website: body?.website ? String(body.website).trim() : null,
      p_redirect_uris: Array.isArray(body?.redirectUris) ? body.redirectUris : [],
    });

    if (error || !data?.length || data[0].error) {
      return NextResponse.json(
        { error: data?.[0]?.error || error?.message || 'registration_failed' },
        { status: 400 }
      );
    }
    return NextResponse.json({ appId: data[0].app_id }, { status: 201 });
  } catch (err) {
    console.error('[Dev Portal] Register app error:', err?.message || err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}