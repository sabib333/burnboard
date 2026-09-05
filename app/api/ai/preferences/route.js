import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';

/**
 * GET    /api/ai/preferences — the user's explicit AI preferences (visible,
 *                                editable, deletable — no hidden memory).
 * POST   /api/ai/preferences — update favorite topics / disabled
 *                               capabilities (e.g. { disabledCapabilities: ['ai_personal_digest'] }).
 * DELETE /api/ai/preferences — clear ALL AI preference state for this user.
 *
 * Owner-only (RLS + RPC guard). The personal digest/guide read these toggles
 * server-side so a user's opt-out is honored at the API, not just the UI.
 */
export async function GET(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await client
      .from('personal_ai_preferences')
      .select('favorite_topics, disabled_capabilities, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });
    return NextResponse.json({
      favoriteTopics: data?.favorite_topics || [],
      disabledCapabilities: data?.disabled_capabilities || [],
      updatedAt: data?.updated_at || null,
    });
  } catch (err) {
    console.error('[AI Preferences] GET error:', err?.message || err);
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

    // Whitelist capability names server-side (never trust the client).
    const VALID = ['ai_personal_guide', 'ai_personal_digest', 'ai_content_polish'];
    const topics = Array.isArray(body?.favoriteTopics)
      ? [...new Set(body.favoriteTopics.map(t => String(t).trim().slice(0, 60)).filter(Boolean))].slice(0, 20)
      : null;
    const disabled = Array.isArray(body?.disabledCapabilities)
      ? [...new Set(body.disabledCapabilities.filter(c => VALID.includes(c)))].slice(0, VALID.length)
      : null;

    const { data, error } = await client.rpc('upsert_ai_preferences', {
      p_favorite_topics: topics,
      p_disabled_capabilities: disabled,
    });
    if (error || !data) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[AI Preferences] POST error:', err?.message || err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await client.rpc('clear_ai_preferences');
    if (error || !data) return NextResponse.json({ error: 'clear_failed' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[AI Preferences] DELETE error:', err?.message || err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}