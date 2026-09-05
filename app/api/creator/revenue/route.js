import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { getCreatorRevenue, requestCreatorPayout } from '@/lib/monetization/billing';

/**
 * GET /api/creator/revenue
 *
 * Private creator revenue overview (Master Prompt 15): a ledger-derived
 * summary of REAL verified earnings only, plus payout history. Supporter
 * identity is never returned. 401 outside the owner's authenticated session.
 */
export async function GET(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const revenue = await getCreatorRevenue(client, userId);
    return NextResponse.json(revenue);
  } catch (err) {
    console.error('[Creator Revenue] Error:', err?.message || err);
    return NextResponse.json({ available: false });
  }
}

/**
 * POST /api/creator/revenue — request a payout (Master Prompt 24, Section 30)
 *
 * Moves the creator's AVAILABLE balance into a pending payout request.
 * Guardrails are enforced server-side in the SECURITY DEFINER function:
 * owner-scope, minimum threshold, and one open payout at a time. No real
 * money moves until a compliant payout driver processes the request — the
 * UI says exactly that, no instant-payout promises.
 */
export async function POST(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await requestCreatorPayout(client, userId);
    if (result.error) {
      const reason = result.error;
      const status = reason === 'unauthorized' ? 401 : 400;
      const message = {
        disabled: 'Creator payouts are not enabled on this deployment yet.',
        below_minimum: 'Your available balance is below the payout minimum.',
        open_payout: 'You already have a payout being processed — it must complete before you can request another.',
        no_balance: 'There is nothing to pay out yet.',
        unauthorized: 'Unauthorized',
      }[reason] || 'The payout request could not be completed right now.';
      return NextResponse.json({ ok: false, error: reason, message }, { status });
    }

    return NextResponse.json({ ok: true, payout: result.result });
  } catch (err) {
    console.error('[Creator Revenue] Payout request error:', err?.message || err);
    return NextResponse.json({ ok: false, error: 'payout_failed' }, { status: 500 });
  }
}