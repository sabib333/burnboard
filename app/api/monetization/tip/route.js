import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { getTipOptions } from '@/lib/monetization/billing';

/**
 * POST /api/monetization/tip { creator_id }
 *
 * Provisions (idempotently) and returns the creator's standardized one-time
 * tip tiers for the "Support this creator" flow. Auth required — the
 * supporter must be a real signed-in user. Self-tips are rejected here and
 * again at checkout (defense in depth). Returns { available: false } with a
 * friendly reason when monetization isn't configured or the creator can't
 * receive tips yet.
 */
export async function POST(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ available: false, error: 'Sign in to support creators.' }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ available: false, error: 'invalid_body' }, { status: 400 });
    }

    if (!body?.creator_id) {
      return NextResponse.json({ available: false, error: 'missing_creator' }, { status: 400 });
    }

    const options = await getTipOptions({ client, userId, creatorId: body.creator_id });

    if (options.self) {
      return NextResponse.json({ available: false, error: 'You cannot tip yourself.' }, { status: 400 });
    }
    if (!options.available) {
      return NextResponse.json({ available: false, error: 'Tips are not available for this creator yet.' });
    }

    return NextResponse.json(options);
  } catch (err) {
    console.error('[Monetization] Tip error:', err?.message || err);
    return NextResponse.json({ available: false, error: 'internal_error' });
  }
}