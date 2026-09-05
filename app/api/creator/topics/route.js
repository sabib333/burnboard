import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { MAX_CREATOR_TOPICS } from '@/lib/creator/config';

/**
 * GET /api/creator/topics
 *   Authenticated owner → { topics: all[], selected: [topic ids] }
 *
 * PUT /api/creator/topics  body: { topic_ids: string[] }
 *   Replaces the creator's Topic identity tags (max MAX_CREATOR_TOPICS).
 *   Only real topics from the shared `topics` table are accepted.
 */

export async function GET(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [topicsRes, ownRes] = await Promise.all([
      client.from('topics').select('id, name, slug').order('name', { ascending: true }),
      client.from('creator_topics').select('topic_id').eq('user_id', userId),
    ]);

    return NextResponse.json({
      topics: topicsRes.data || [],
      selected: (ownRes.data || []).map((r) => r.topic_id),
      max: MAX_CREATOR_TOPICS,
    });
  } catch (err) {
    console.error('[Creator Topics] GET Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    let topicIds = Array.isArray(body?.topic_ids) ? body.topic_ids : [];
    topicIds = [...new Set(topicIds.filter((id) => typeof id === 'string'))];

    if (topicIds.length > MAX_CREATOR_TOPICS) {
      return NextResponse.json(
        { error: `You can pick up to ${MAX_CREATOR_TOPICS} creator topics` },
        { status: 400 }
      );
    }

    // Only accept topics that genuinely exist (no freeform tagging).
    let validIds = new Set();
    if (topicIds.length > 0) {
      const { data: existing } = await client
        .from('topics')
        .select('id')
        .in('id', topicIds);
      validIds = new Set((existing || []).map((t) => t.id));
    }
    const finalIds = topicIds.filter((id) => validIds.has(id));

    // Replace the owner's selection (delete-all + insert is safe here because
    // both policies are owner-scoped and this is one explicit user action).
    await client.from('creator_topics').delete().eq('user_id', userId);

    if (finalIds.length > 0) {
      const { error } = await client.from('creator_topics').insert(
        finalIds.map((topic_id) => ({ user_id: userId, topic_id }))
      );
      if (error) {
        console.error('[Creator Topics] Insert error:', error);
        return NextResponse.json({ error: 'Failed to save creator topics' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, selected: finalIds, max: MAX_CREATOR_TOPICS });
  } catch (err) {
    console.error('[Creator Topics] PUT Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
