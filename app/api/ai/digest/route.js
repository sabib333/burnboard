import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { isAiFeatureEnabled } from '@/lib/ai/flags';
import { computeDailyDigest } from '@/lib/ai/os';

/**
 * GET /api/ai/digest
 *
 * Personal AI — "what happened while you were away". Read-only, computed at
 * request time, ONLY from the signed-in user's own graph (creators they
 * follow, communities they joined). No model inference → nothing can be
 * fabricated; items carry their real source ids so the UI links through.
 *
 * Signed-in users only (a digest of "your network" is meaningless to an
 * anonymous visitor). Flagged `ai_personal_digest`, rate-limited per user.
 */
export async function GET(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    if (!isAiFeatureEnabled('ai_personal_digest', userId)) {
      return NextResponse.json({ ok: false, error: 'feature_disabled' }, { status: 404 });
    }

    const result = await computeDailyDigest(client, userId);
    if (!result.ok) {
      const status = result.error === 'rate_limited' ? 429 : 502;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json({
      ...result,
      generatedAt: new Date().toISOString(),
      scope: 'following_and_communities',
      // Transparency: always disclose what this is (and is not).
      transparency: 'An AI-free summary of real activity from people and communities you follow. It cannot show you anything outside your own network.',
    });
  } catch (err) {
    console.error('[AI Digest] Error:', err?.message || err);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}