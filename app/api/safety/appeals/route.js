/**
 * BURN BOARD — Appeals API
 *
 * Users can appeal moderation decisions (submission stays open to any user,
 * including anonymous identity when no account exists).
 *
 * POST  /api/safety/appeals - Submit an appeal (real record)
 * GET   /api/safety/appeals - Appeals review queue (platform moderator)
 * PATCH /api/safety/appeals - Decide an appeal (platform moderator)
 *
 * Decisions run through the moderator-gated definer RPC, which reverses
 * enforcement by restoring content through the authoritative state path.
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { isPlatformModeratorClient } from '@/lib/safety';
import { submitAppeal } from '@/lib/moderationService';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      enforcementType,
      enforcementTargetType,
      enforcementTargetId,
      explanation,
    } = body;

    if (!enforcementType || !enforcementTargetType || !enforcementTargetId) {
      return NextResponse.json(
        { error: 'enforcementType, enforcementTargetType, and enforcementTargetId are required' },
        { status: 400 }
      );
    }

    const validEnforcementTypes = [
      'content_removal', 'content_restriction', 'profile_restriction', 'profile_ban',
      'account_restriction', 'account_ban',
    ];
    if (!validEnforcementTypes.includes(enforcementType)) {
      return NextResponse.json(
        { error: `Invalid enforcementType. Must be one of: ${validEnforcementTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Resolve authenticated identity when a session exists
    const auth = await getRequestContext(request);
    const appellantId = auth?.userId || null;
    const appellantAnonId = appellantId ? null : 'anon_' + Math.random().toString(36).substring(2, 10);

    const result = await submitAppeal({
      enforcementType,
      enforcementTargetType,
      enforcementTargetId,
      appellantId,
      appellantAnonId,
      explanation,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Appeal submitted' });
  } catch (error) {
    console.error('[Appeals] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const auth = await getRequestContext(request);
    if (!auth.client || !auth.userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (!(await isPlatformModeratorClient(auth.client))) {
      return NextResponse.json({ error: 'Unauthorized — moderator account required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'open';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const { data, error } = await auth.client.rpc('safety_admin_appeals', {
      p_status: status,
      p_limit: limit,
      p_offset: offset,
    });
    const result = Array.isArray(data) ? data[0] : data;
    if (error || !result || result.success === false) {
      return NextResponse.json({ error: result?.error || 'Failed to load appeals' }, { status: 500 });
    }

    return NextResponse.json({
      appeals: result.appeals || [],
      total: result.total || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Appeals] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const auth = await getRequestContext(request);
    if (!auth.client || !auth.userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (!(await isPlatformModeratorClient(auth.client))) {
      return NextResponse.json({ error: 'Unauthorized — moderator account required' }, { status: 403 });
    }

    const body = await request.json();
    const { appealId, decision, reviewerNote } = body;

    if (!appealId || !decision) {
      return NextResponse.json({ error: 'appealId and decision are required' }, { status: 400 });
    }

    const validDecisions = ['upheld', 'reversed'];
    if (!validDecisions.includes(decision)) {
      return NextResponse.json(
        { error: `Invalid decision. Must be one of: ${validDecisions.join(', ')}` },
        { status: 400 }
      );
    }

    const { data, error } = await auth.client.rpc('safety_review_appeal', {
      p_appeal_id: appealId,
      p_decision: decision,
      p_note: reviewerNote || null,
    });
    const result = Array.isArray(data) ? data[0] : data;
    if (error || !result || result.success === false) {
      return NextResponse.json({ error: result?.error || 'Failed to review appeal' }, { status: 400 });
    }

    return NextResponse.json({ success: true, decision, restored: result.restored_state === 'visible' });
  } catch (error) {
    console.error('[Appeals] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
