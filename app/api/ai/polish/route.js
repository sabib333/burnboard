import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { isAiFeatureEnabled } from '@/lib/ai/flags';
import { polishDraftText } from '@/lib/ai/os';

/**
 * POST /api/ai/polish  { text }
 *
 * Personal AI — optional suggestions on the user's own draft text. Returns
 * suggestions only; publishing is ALWAYS the user's manual action (draft
 * mode by design). The user's draft is the only data sent, it is never
 * stored, and the feature is flag + rate limited.
 */
export async function POST(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !isAiFeatureEnabled('ai_content_polish', userId)) {
      return NextResponse.json({ ok: false, error: 'feature_disabled' }, { status: 404 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
    }
    if (!body?.text || !String(body.text).trim()) {
      return NextResponse.json({ ok: false, error: 'missing_text' }, { status: 400 });
    }

    const result = await polishDraftText({
      client,
      userId: userId || `anon:${req.headers.get('x-forwarded-for') || 'guest'}`,
      text: String(body.text),
    });
    if (!result.ok) {
      const status = result.error === 'rate_limited' ? 429 : 502;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json({
      ...result,
      // Transparency: label AI assistance on any surface that applies it.
      note: 'AI-assisted suggestion — you stay in control of what gets published.',
    });
  } catch (err) {
    console.error('[AI Polish] Error:', err?.message || err);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}