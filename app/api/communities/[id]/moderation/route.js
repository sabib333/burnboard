import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { getCommunityById, getViewerMembership, canModerate } from '@/lib/communities';

/**
 * POST /api/communities/[id]/moderation
 *
 * Community-scoped moderation. A community moderator can act within their own
 * community only — they never gain control over platform content.
 * Platform-level moderation (reports, moderation_actions) stays authoritative.
 *
 * Body: { action: 'remove_post', post_id: string }
 *
 *   - remove_post: detaches a post from this community (community_id → NULL).
 *     The content record, author ownership, reactions, and comments are
 *     preserved — it simply leaves this community's feed.
 */

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
      return NextResponse.json({ error: 'Only owners and moderators can moderate this community' }, { status: 403 });
    }

    const body = await req.json();
    const { action, post_id: postId } = body;

    if (action !== 'remove_post' || !postId) {
      return NextResponse.json(
        { error: 'action must be remove_post with a post_id' },
        { status: 400 }
      );
    }

    // DB-validated detach: validates actor role + community ownership server-side
    const { data: detached, error: rpcError } = await client.rpc('community_detach_post', {
      community: id,
      post_id: postId,
    });

    if (rpcError || !detached) {
      console.error('[Communities] Remove post error:', rpcError || 'detach rejected');
      return NextResponse.json(
        { error: 'Post not found in this community or you lack permission' },
        { status: 404 }
      );
    }

    // Audit log — real state persisted with accountability
    await client.from('moderation_actions').insert({
      action_type: 'community_remove_post',
      target_type: 'social_post',
      target_id: postId,
      previous_state: id,
      new_state: null,
      moderator_id: userId,
      moderator_note: `Post removed from community ${community.slug}`,
    }).catch(() => {});

    return NextResponse.json({ success: true, action: 'remove_post', postId });
  } catch (err) {
    console.error('[Communities] Moderation Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}