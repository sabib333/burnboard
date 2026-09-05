import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { isAiFeatureEnabled } from '@/lib/ai/flags';
import { askPersonalGuide } from '@/lib/ai/os';

/**
 * POST /api/ai/guide  { question }
 *
 * Personal AI — grounded product Q&A. Answers come from the curated help
 * corpus (with cited sources); the capability is flagged (`ai_personal_guide`)
 * and rate-limited per user. The assistant never has write access — it
 * cannot publish, message, or change settings.
 *
 * Optional while signed out (lower rate limits apply server-side); returns
 * 401-friendly but still functions for guests with a generic id.
 */
export async function POST(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !isAiFeatureEnabled('ai_personal_guide', userId)) {
      return NextResponse.json({ ok: false, error: 'feature_disabled' }, { status: 404 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
    }
    if (!body?.question || !String(body.question).trim()) {
      return NextResponse.json({ ok: false, error: 'missing_question' }, { status: 400 });
    }

    const result = await askPersonalGuide(client, {
      userId: userId || `anon:${req.headers.get('x-forwarded-for') || 'guest'}`,
      question: String(body.question),
    });
    if (!result.ok) {
      const status = result.error === 'rate_limited' ? 429 : 502;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('[AI Guide] Error:', err?.message || err);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}