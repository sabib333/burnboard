import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';

/**
 * GET /api/monetization/entitlements
 *
 * The viewer's currently active entitlements (backend-authoritative; derived
 * from verified provider events, never from client state). Returns a simple
 * boolean map key → true so UIs can gate premium features without knowing
 * anything about payment internals. Auth required.
 */
export async function GET(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ entitlements: {}, activeKeys: [] }, { status: 401 });
    }

    try {
      const { data } = await client
        .from('monetization_entitlements')
        .select('key, status, current_period_end')
        .eq('user_id', userId);

      const now = new Date();
      const activeKeys = new Set();
      const entitlements = {};
      for (const e of data || []) {
        const expired = e.current_period_end && new Date(e.current_period_end) <= now;
        const active = e.status === 'active' && !expired;
        entitlements[e.key] = { active, status: expired ? 'expired' : e.status, currentPeriodEnd: e.current_period_end };
        if (active) activeKeys.add(e.key);
      }

      return NextResponse.json({
        entitlements,
        activeKeys: [...activeKeys],
        available: true,
      });
    } catch {
      // Migration not applied — no entitlements exist yet.
      return NextResponse.json({ entitlements: {}, activeKeys: [], available: false });
    }
  } catch (err) {
    console.error('[Monetization] Entitlements error:', err?.message || err);
    return NextResponse.json({ entitlements: {}, activeKeys: [], available: false });
  }
}