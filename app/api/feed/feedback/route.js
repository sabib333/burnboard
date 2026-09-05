import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { applyFeedbackLearning } from '@/lib/reco/signals';

/**
 * POST /api/feed/feedback
 *
 * Real, database-backed negative feedback — never browser state only.
 *
 * Body:
 *   - content_type: 'social_post' | 'roast' (required)
 *   - content_id:   uuid (required)
 *   - action:       'not_interested' | 'hide' (required)
 *
 * Effects (all server-side, proportional — one click never erases a whole
 * category):
 *   - 'hide'          suppresses THIS item for the user permanently and
 *                     records a weak negative signal.
 *   - 'not_interested' suppresses this item AND applies negative learning
 *                     to the item's captured scopes (author, community,
 *                     content type, and the community's topics).
 *
 * Requires a signed-in session. Scope snapshots are validated server-side
 * from the real content row — the client can never forge who authored it.
 */

const VALID_ACTIONS = new Set(['not_interested', 'hide']);

async function resolveScope(client, contentType, contentId) {
  let row = null;
  if (contentType === 'social_post') {
    const { data } = await client
      .from('social_posts')
      .select('user_id, community_id, content_type')
      .eq('id', contentId)
      .maybeSingle();
    row = data;
  } else if (contentType === 'roast') {
    const { data } = await client
      .from('roasts')
      .select('user_id')
      .eq('id', contentId)
      .maybeSingle();
    if (data) row = { user_id: data.user_id, community_id: null, content_type: 'roast' };
  }

  if (!row) return null;

  const scope = {
    author_id: row.user_id || null,
    community_id: row.community_id || null,
    content_type: row.content_type || contentType,
    topic_ids: [],
    topic_labels: {},
    community_label: null,
  };

  if (row.community_id) {
    // Community's topics are part of what made this item relevant to the
    // user — captured as the negative scope (real, proportional learning).
    const { data: topics } = await client
      .from('community_topics')
      .select('topic_id, topics(name)')
      .eq('community_id', row.community_id)
      .limit(10);
    for (const t of topics || []) {
      if (!t?.topic_id) continue;
      scope.topic_ids.push(t.topic_id);
      if (t.topics?.name) scope.topic_labels[String(t.topic_id)] = t.topics.name;
    }
    const { data: community } = await client
      .from('communities')
      .select('name')
      .eq('id', row.community_id)
      .maybeSingle();
    if (community) scope.community_label = community.name;
  }

  return scope;
}

export async function POST(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client) {
      return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'Sign in to personalize your feed' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { content_type: contentType, content_id: contentId, action } = body;

    if (!contentType || !contentId || !action) {
      return NextResponse.json(
        { error: 'content_type, content_id and action are required' },
        { status: 400 }
      );
    }
    if (!VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${[...VALID_ACTIONS].join(', ')}` },
        { status: 400 }
      );
    }
    if (typeof contentId !== 'string') {
      return NextResponse.json({ error: 'Invalid content_id' }, { status: 400 });
    }

    const scope = await resolveScope(client, contentType, contentId);
    if (!scope) {
      // Content is gone or no longer visible — hiding it is already a no-op.
      return NextResponse.json({ success: true, action, skipped: true });
    }

    // Upsert the real user↔content relationship (never browser-only).
    const { error } = await client
      .from('rec_feedback')
      .upsert({
        user_id: userId,
        target_type: contentType,
        target_id: contentId,
        action,
        scope,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,target_type,target_id',
      });

    if (error) {
      console.error('[Feed feedback] Upsert error:', error);
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    // Negative learning (fire-and-forget, fails soft).
    const eventType = action === 'not_interested' ? 'not_interested' : 'content_hidden';
    applyFeedbackLearning({
      client, userId, eventType,
      targetType: contentType, targetId: contentId,
      scope,
    }).catch(() => {});

    return NextResponse.json({ success: true, action });
  } catch (err) {
    console.error('[Feed feedback] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
