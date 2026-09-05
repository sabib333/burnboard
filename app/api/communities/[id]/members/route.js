import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import {
  getCommunityById, getViewerMembership, listCommunityMembers, canModerate,
  getMemberCounts,
} from '@/lib/communities';
import { notifyCommunityJoined } from '@/lib/notifications';
import { recordSignal } from '@/lib/reco/signals';

/**
 * POST /api/communities/[id]/members
 *   Body: { action: 'join' | 'leave' | 'remove', user_id? }
 *
 *   - join:   authenticated user becomes a member (duplicate-safe)
 *   - leave:  user leaves; owners cannot orphan their community
 *   - remove: community moderators may remove members (never owners)
 *
 * GET /api/communities/[id]/members?limit=&offset=
 *   Real, paginated member list with role info.
 */

export async function GET(req, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '24', 10), 50);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const community = await getCommunityById(id);
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const { userId } = await getRequestContext(req);
    const result = await listCommunityMembers(id, { limit, offset, viewerId: userId });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[Communities] Members GET Error:', err);
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
      return NextResponse.json({ error: 'Sign in to join a community' }, { status: 401 });
    }

    const community = await getCommunityById(id);
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action } = body;

    if (!['join', 'leave', 'remove'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be join, leave, or remove' },
        { status: 400 }
      );
    }

    // ── JOIN ────────────────────────────────────────────────
    if (action === 'join') {
      if (community.visibility !== 'public') {
        return NextResponse.json({ error: 'This community is not open for joining' }, { status: 403 });
      }

      const { error } = await client
        .from('community_members')
        .insert({
          community_id: id,
          user_id: userId,
          role: 'member',
          membership_status: 'active',
        });

      if (error) {
        // Duplicate membership is prevented (unique constraint)
        if (error.code === '23505') {
          return NextResponse.json({ success: true, action: 'already_member', isMember: true });
        }
        console.error('[Communities] Join error:', error);
        return NextResponse.json({ error: 'Failed to join community' }, { status: 500 });
      }

      // Notification hook for community owners
      await notifyCommunityJoined(id, userId);

      // Non-critical rep + analytics hooks
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/reputation/award`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            event_type: 'community_joined',
            source_type: 'community',
            source_id: id,
          }),
        });
      } catch (e) {}
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/growth/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'community_joined',
            subjectId: userId,
            metadata: { communityId: id },
          }),
        });
      } catch (e) {}

      // Real behavior signal: joining is an explicit, strong community signal.
      recordSignal({
        client,
        userId,
        eventType: 'community_joined',
        targetType: 'community',
        targetId: id,
        context: { community_label: community.name || community.slug || null },
        idempotencyKey: `join-${id}`,
      }).catch(() => {});

      const counts = await getMemberCounts([id]);
      return NextResponse.json({
        success: true,
        action: 'joined',
        isMember: true,
        memberCount: counts[id] || 1,
      });
    }

    // ── LEAVE ───────────────────────────────────────────────
    if (action === 'leave') {
      const membership = await getViewerMembership(id, userId);
      if (!membership || membership.membership_status !== 'active') {
        return NextResponse.json({ success: true, action: 'not_member', isMember: false });
      }

      // Owner safety: an owner cannot orphan their community by leaving.
      if (membership.role === 'owner') {
        return NextResponse.json(
          { error: 'Owners cannot leave. Delete the community or transfer ownership instead.' },
          { status: 400 }
        );
      }

      const { error } = await client
        .from('community_members')
        .delete()
        .eq('community_id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('[Communities] Leave error:', error);
        return NextResponse.json({ error: 'Failed to leave community' }, { status: 500 });
      }

      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/growth/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'community_left',
            subjectId: userId,
            metadata: { communityId: id },
          }),
        });
      } catch (e) {}

      // Real behavior signal: leaving reduces community relevance.
      recordSignal({
        client,
        userId,
        eventType: 'community_left',
        targetType: 'community',
        targetId: id,
        context: { community_label: community.name || community.slug || null },
        idempotencyKey: `leave-${id}`,
      }).catch(() => {});

      const counts = await getMemberCounts([id]);
      return NextResponse.json({
        success: true,
        action: 'left',
        isMember: false,
        memberCount: counts[id] || 0,
      });
    }

    // ── REMOVE (moderator action, community-scoped only) ────
    const { user_id: targetUserId } = body;
    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing user_id to remove' }, { status: 400 });
    }

    const actorMembership = await getViewerMembership(id, userId);
    if (!canModerate(actorMembership?.role)) {
      return NextResponse.json({ error: 'You do not have permission to remove members' }, { status: 403 });
    }

    const targetMembership = await getViewerMembership(id, targetUserId);
    if (!targetMembership) {
      return NextResponse.json({ error: 'User is not a member' }, { status: 404 });
    }

    // Never remove owners (owner safety)
    if (targetMembership.role === 'owner') {
      return NextResponse.json({ error: 'Community owners cannot be removed' }, { status: 400 });
    }

    // Delete the membership row (RLS allows moderators to remove others;
    // the audit log below preserves the trail)
    const { error } = await client
      .from('community_members')
      .delete()
      .eq('community_id', id)
      .eq('user_id', targetUserId);

    if (error) {
      console.error('[Communities] Remove member error:', error);
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }

    // Audit log (platform moderation compatibility)
    await client.from('moderation_actions').insert({
      action_type: 'community_remove_member',
      target_type: 'community_member',
      target_id: targetUserId,
      previous_state: targetMembership.role,
      new_state: 'removed',
      moderator_id: userId,
      moderator_note: `Removed from community ${community.slug}`,
    }).catch(() => {});

    const counts = await getMemberCounts([id]);
    return NextResponse.json({
      success: true,
      action: 'removed',
      isMember: false,
      memberCount: counts[id] || 0,
    });
  } catch (err) {
    console.error('[Communities] Members POST Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}