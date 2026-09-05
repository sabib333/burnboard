import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { getCommunityById, getViewerMembership, canManage, ASSIGNABLE_ROLES } from '@/lib/communities';
import { notifyCommunityRoleChanged } from '@/lib/notifications';

/**
 * POST /api/communities/[id]/members/role
 *
 * Owner-only role management. Server-enforced — the UI can never grant roles.
 *
 * Body: { user_id: string, role: 'moderator' | 'member' }
 *
 *   - 'owner' and 'admin' are never assignable from here.
 *   - Owners cannot be demoted or have their role changed.
 *   - The last owner can never be demoted (owner safety).
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

    // Only the owner can manage roles
    const actorMembership = await getViewerMembership(id, userId);
    if (!canManage(actorMembership?.role)) {
      return NextResponse.json({ error: 'Only the community owner can change roles' }, { status: 403 });
    }

    const body = await req.json();
    const { user_id: targetUserId, role: newRole } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    // Never accept owner/admin through the API
    if (!ASSIGNABLE_ROLES.includes(newRole)) {
      return NextResponse.json(
        { error: `Invalid role. Allowed: ${ASSIGNABLE_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    const targetMembership = await getViewerMembership(id, targetUserId);
    if (!targetMembership || targetMembership.membership_status !== 'active') {
      return NextResponse.json({ error: 'User is not an active member' }, { status: 404 });
    }

    // Owners cannot have their role changed (owner safety)
    if (targetMembership.role === 'owner') {
      return NextResponse.json({ error: 'Community owner roles cannot be changed' }, { status: 400 });
    }

    if (targetMembership.role === newRole) {
      return NextResponse.json({ success: true, unchanged: true, role: newRole });
    }

    const previousRole = targetMembership.role;

    const { error } = await client
      .from('community_members')
      .update({ role: newRole })
      .eq('community_id', id)
      .eq('user_id', targetUserId);

    if (error) {
      console.error('[Communities] Role change error:', error);
      return NextResponse.json({ error: 'Failed to change role' }, { status: 500 });
    }

    // Audit log
    await client.from('moderation_actions').insert({
      action_type: 'community_role_changed',
      target_type: 'community_member',
      target_id: targetUserId,
      previous_state: previousRole,
      new_state: newRole,
      moderator_id: userId,
      moderator_note: `Role changed in community ${community.slug}`,
    }).catch(() => {});

    // Notification hook
    await notifyCommunityRoleChanged(id, targetUserId, newRole, community);

    return NextResponse.json({ success: true, role: newRole, previousRole });
  } catch (err) {
    console.error('[Communities] Role POST Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}