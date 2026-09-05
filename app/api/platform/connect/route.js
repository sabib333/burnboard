import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { queuePlatformEvent } from '@/lib/platform/webhooks';

/**
 * GET /api/platform/connect — the apps the user has granted access to,
 * with the scopes granted and grant dates. Private (owner's own grants).
 *
 * DELETE /api/platform/connect  { grant_id } — revoke a grant.
 * The user revokes the grant id they see in their connected-apps list.
 * The RPC enforces that only the subject (me) can revoke my own grant.
 * Revocation is immediate.
 */
export async function GET(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Tokens granted ON this user's account (subject_id = me).
    const { data: grants, error } = await client
      .from('developer_app_tokens')
      .select('id, app_id, token_prefix, scopes, created_at, expires_at, revoked_at, last_used_at')
      .eq('subject_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

    const appIds = [...new Set((grants || []).map(g => g.app_id))];
    const appInfo = {};
    if (appIds.length) {
      // RPC returns only public metadata for apps this user holds grants to.
      const { data: apps } = await client.rpc('public_app_metadata', {
        p_app_ids: appIds,
      });
      for (const a of apps || []) appInfo[a.app_id] = a;
    }

    return NextResponse.json({
      data: (grants || []).map(g => ({
        id: g.id,
        appId: g.app_id,
        appName: appInfo[g.app_id]?.app_name || 'Unknown app',
        website: appInfo[g.app_id]?.website || null,
        appStatus: 'approved',
        tokenPrefix: g.token_prefix,
        scopes: g.scopes || [],
        grantedAt: g.created_at,
        expiresAt: g.expires_at,
        revoked: !!g.revoked_at,
        lastUsedAt: g.last_used_at,
      })),
    });
  } catch (err) {
    console.error('[Platform Connect] List error:', err?.message || err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    const grantId = parseInt(String(body?.grant_id || ''), 10);
    if (!grantId) {
      return NextResponse.json({ error: 'missing_grant_id' }, { status: 400 });
    }

    // The RPC enforces that only the subject may revoke their own grant.
    const { data, error } = await client.rpc('revoke_access_token', {
      p_token_id: grantId,
      p_subject_id: userId,
    });

    if (error) return NextResponse.json({ error: 'revoke_failed' }, { status: 500 });

    // Inform the app that this user revoked access (so it can stop acting
    // for them). Fire-and-forget; never blocks revocation.
    if (data) {
      try {
        await queuePlatformEvent(client, {
          eventType: 'app.access_revoked',
          subjectId: userId,
          eventId: `grant_${grantId}`,
        });
      } catch (e) {
        console.warn('[Platform Connect] Revoke webhook skipped:', e?.message || e);
      }
    }

    return NextResponse.json({ ok: !!data });
  } catch (err) {
    console.error('[Platform Connect] Revoke error:', err?.message || err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}