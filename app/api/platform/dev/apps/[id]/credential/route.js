import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';

/**
 * POST /api/platform/dev/apps/[id]/credential
 *
 * Issue a new client secret for the developer's own app. The plaintext
 * secret is returned EXACTLY ONCE — only its hash is stored. Developers
 * must save it immediately (the portal shows it in a single-use dialog).
 *
 * Body: { environment?: 'development'|'sandbox'|'production' }
 */
export async function POST(req, { params }) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const appId = params?.id;
    if (!appId) return NextResponse.json({ error: 'missing_app' }, { status: 400 });

    let environment = 'development';
    try {
      const body = await req.json();
      if (body?.environment) environment = body.environment;
    } catch {
      // default to development
    }

    const { data, error } = await client.rpc('issue_app_credential', {
      p_app_id: appId,
      p_environment: environment,
    });

    if (error || !data?.length || data[0].error) {
      const errCode = data?.[0]?.error || error?.message;
      return NextResponse.json({ error: errCode || 'issue_failed' }, { status: errCode === 'not_owner' ? 403 : 400 });
    }

    return NextResponse.json({
      credentialId: data[0].credential_id,
      clientSecret: data[0].client_secret, // shown exactly once
    });
  } catch (err) {
    console.error('[Dev Portal] Issue credential error:', err?.message || err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}