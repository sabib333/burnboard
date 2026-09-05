import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';

/**
 * GET /api/referral/rewards (authenticated)
 *
 * Returns the viewer's referral rewards + invite-page stats, and runs the
 * on-demand reward sync first (idempotent, activation-gated, monthly-capped).
 *
 * Privacy: only ever exposes the viewer's own data (the RPC enforces
 * auth.uid() = p_user server-side).
 */
export async function GET(request) {
  const { client, userId } = await getRequestContext(request);
  if (!client || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Idempotent grant of any rewards that became eligible since last visit.
    const { data: granted, error: syncError } = await client.rpc(
      'sync_referral_rewards',
      { p_user: userId }
    );

    const { data: summary, error: summaryError } = await client.rpc(
      'get_referral_summary',
      { p_user: userId }
    );

    if (summaryError || !summary || summary?.error === 'unauthorized') {
      return NextResponse.json({ error: 'Referral data unavailable' }, { status: 500 });
    }

    return NextResponse.json({
      summary,
      rewardsGrantedNow: syncError ? 0 : Math.max(0, granted || 0),
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Referral Rewards] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}