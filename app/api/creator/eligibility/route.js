import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { getCreatorEligibility, eligibilityLabel } from '@/lib/monetization/eligibility';

/**
 * GET /api/creator/eligibility
 *
 * Private creator monetization eligibility status. Returns only the
 * authenticated owner's high-level status + reason codes — never internal
 * thresholds or fraud/moderation signals. 401 outside the owner's session;
 * `available: false` when the monetization migration isn't applied.
 */
export async function GET(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const elig = await getCreatorEligibility(client, userId);
    return NextResponse.json({
      ...elig,
      label: elig.available ? eligibilityLabel(elig.status) : undefined,
    });
  } catch (err) {
    console.error('[Creator Eligibility] Error:', err?.message || err);
    return NextResponse.json({ available: false });
  }
}