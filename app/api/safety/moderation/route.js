/**
 * BURN BOARD — Moderation Queue API (platform moderators only)
 *
 * GET  /api/safety/moderation - Get reports queue (moderator session)
 * PATCH /api/safety/moderation - Moderate: resolve/dismiss/escalate reports
 *   or hide/restrict content.
 *
 * Authorization: the caller must be signed in as a platform moderator
 * (user_profiles.is_moderator / is_admin, flagged by operators in SQL).
 * All mutations run through moderator-gated definer RPCs so every action
 * is authorized at the DB, persisted for real, and audited. The old
 * password-header path was removed because its anon-key writes were
 * silently blocked by RLS (fake audit rows) — moderation must be real.
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { isPlatformModeratorClient } from '@/lib/safety';

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

    const { data, error } = await auth.client.rpc('safety_admin_reports', {
      p_status: status,
      p_limit: limit,
      p_offset: offset,
    });
    const result = Array.isArray(data) ? data[0] : data;
    if (error || !result || result.success === false) {
      return NextResponse.json({ error: result?.error || 'Failed to load queue' }, { status: 500 });
    }

    return NextResponse.json({
      reports: result.reports || [],
      total: result.total || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Moderation Queue] GET error:', error);
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
    const { reportId, action, moderatorNote, targetType, targetId } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    // Report status transitions (moderator-gated definer RPC + audit)
    const statusMap = {
      resolve: 'resolved',
      dismiss: 'dismissed',
      escalate: 'escalated',
      in_review: 'in_review',
    };

    if (statusMap[action]) {
      if (!reportId) {
        return NextResponse.json({ error: 'reportId is required' }, { status: 400 });
      }
      const { data, error } = await auth.client.rpc('safety_update_report_status', {
        p_report_id: reportId,
        p_status: statusMap[action],
        p_note: moderatorNote || null,
      });
      const result = Array.isArray(data) ? data[0] : data;
      if (error || !result || result.success === false) {
        return NextResponse.json({ error: result?.error || 'Failed to update report' }, { status: 400 });
      }
      return NextResponse.json({ success: true, action });
    }

    // Content-level actions via the authoritative content-state RPC.
    // The DB function resolves the report target itself when no explicit
    // target is supplied; explicit targetType/targetId also supported for
    // direct content actions (social_post | comment | hot_seat).
    const contentActions = ['hide_content', 'restrict_content', 'restore_content'];
    if (contentActions.includes(action)) {
      let resolvedTargetType = targetType;
      let resolvedTargetId = targetId;

      if ((!resolvedTargetType || !resolvedTargetId) && reportId) {
        const { data, error } = await auth.client.rpc('safety_admin_reports', {
          p_status: 'all',
          p_limit: 200,
          p_offset: 0,
        });
        const result = Array.isArray(data) ? data[0] : data;
        const row = (result?.reports || []).find((r) => r.id === reportId);
        if (!row) {
          return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }
        resolvedTargetType = row.target_type;
        resolvedTargetId = row.target_id;
      }

      const state = action === 'hide_content' ? 'removed'
        : action === 'restrict_content' ? 'limited'
        : 'visible';

      const { data, error } = await auth.client.rpc('safety_set_content_state', {
        p_target_type: resolvedTargetType,
        p_target_id: resolvedTargetId,
        p_state: state,
        p_note: moderatorNote || (action === 'restore_content' ? 'Content restored by moderator' : 'Moderator action'),
      });
      const result = Array.isArray(data) ? data[0] : data;
      if (error || !result || result.success === false) {
        return NextResponse.json({ error: result?.error || 'Failed to moderate content' }, { status: 400 });
      }

      // Mark the originating report resolved when it came from one
      if (reportId) {
        await auth.client.rpc('safety_update_report_status', {
          p_report_id: reportId,
          p_status: 'resolved',
          p_note: moderatorNote || null,
        });
      }
      return NextResponse.json({ success: true, action, state });
    }

    return NextResponse.json(
      { error: `Invalid action. Must be one of: resolve, dismiss, escalate, in_review, hide_content, restrict_content, restore_content` },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Moderation Queue] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
