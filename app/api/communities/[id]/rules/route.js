import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { getCommunityById, getViewerMembership, canModerate, getCommunityRules } from '@/lib/communities';

/**
 * GET /api/communities/[id]/rules
 *   Community-defined rules (what belongs, what doesn't, expectations).
 *
 * POST /api/communities/[id]/rules
 *   Owner/moderator only. Body: { rules: string[] } — replaces the full list.
 *   Max 12 rules, each 3-300 characters.
 *
 * Rules are real, stored content. They are NOT silently enforced — platform
 * moderation remains authoritative and separate (community moderators only
 * act within their own community).
 */

export async function GET(req, { params }) {
  try {
    const { id } = params;
    const community = await getCommunityById(id);
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }
    const rules = await getCommunityRules(id);
    return NextResponse.json({ rules });
  } catch (err) {
    console.error('[Communities] Rules GET Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { id } = params;
    const { client, userId } = await getRequestContext(req);

    if (!client) {
      return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const community = await getCommunityById(id);
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const membership = await getViewerMembership(id, userId);
    if (!canModerate(membership?.role)) {
      return NextResponse.json({ error: 'Only owners and moderators can edit rules' }, { status: 403 });
    }

    const body = await req.json();
    const rawRules = Array.isArray(body.rules) ? body.rules : null;
    if (!rawRules) {
      return NextResponse.json({ error: 'rules must be an array of strings' }, { status: 400 });
    }

    const rules = rawRules
      .map(r => (typeof r === 'string' ? r.trim() : ''))
      .filter(Boolean)
      .slice(0, 12);

    for (const rule of rules) {
      if (rule.length < 3 || rule.length > 300) {
        return NextResponse.json(
          { error: 'Each rule must be 3-300 characters' },
          { status: 400 }
        );
      }
    }

    // Replace rules atomically-ish (delete + insert)
    const { error: deleteError } = await client
      .from('community_rules')
      .delete()
      .eq('community_id', id);

    if (deleteError) {
      console.error('[Communities] Rules delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to update rules' }, { status: 500 });
    }

    if (rules.length > 0) {
      const { error: insertError } = await client
        .from('community_rules')
        .insert(rules.map((text, index) => ({
          community_id: id,
          text,
          position: index,
        })));

      if (insertError) {
        console.error('[Communities] Rules insert error:', insertError);
        return NextResponse.json({ error: 'Failed to update rules' }, { status: 500 });
      }
    }

    const updated = await getCommunityRules(id);
    return NextResponse.json({ success: true, rules: updated });
  } catch (err) {
    console.error('[Communities] Rules POST Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}