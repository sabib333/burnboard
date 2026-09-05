import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';
import { COLD_START } from '@/lib/reco/config';
import { recordSignal } from '@/lib/reco/signals';

/**
 * GET /api/personalization/interests
 *   Signed-in viewer's explicit interests + available topics (reuses the
 *   Master Prompt 8 `topics` table — no duplicate topic system).
 *   Topic activity is real (posts in topic-linked communities, last 7d).
 *
 * POST /api/personalization/interests
 *   Body: { topic_ids?: string[], enabled?: boolean, reset?: boolean }
 *   - topic_ids: replace the viewer's explicit topic selection.
 *   - enabled:   turn personalization on/off (controls survive, no data is
 *                deleted; disabled viewers simply get the generic feed).
 *   - reset:     clear the interest graph: events, affinities, feedback and
 *                interests. Real reset, not a fake button.
 */

async function ensureSettings(client, userId, patch = {}) {
  const row = {
    user_id: userId,
    enabled: true,
    interests_selected: false,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const { error } = await client.from('user_personalization').upsert(row, {
    onConflict: 'user_id',
  });
  if (error) throw error;
}

async function topicActivity(client) {
  const counts = new Map(); // topic_id -> post count (recent, real)
  try {
    const { data: recent } = await client
      .from('social_posts')
      .select('community_id')
      .not('community_id', 'is', null)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(600);
    const perCommunity = new Map();
    for (const r of recent || []) {
      perCommunity.set(r.community_id, (perCommunity.get(r.community_id) || 0) + 1);
    }
    const communityIds = [...perCommunity.keys()];
    for (let i = 0; i < communityIds.length; i += 100) {
      const { data: links } = await client
        .from('community_topics')
        .select('community_id, topic_id')
        .in('community_id', communityIds.slice(i, i + 100));
      for (const link of links || []) {
        counts.set(String(link.topic_id), (counts.get(String(link.topic_id)) || 0) + (perCommunity.get(link.community_id) || 0));
      }
    }
  } catch (err) {
    console.error('[Interests] activity error:', err?.message || err);
  }
  return counts;
}

export async function GET(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client) {
      return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
    }

    const [{ data: topics }, { data: selectedRows }, { data: settings }] = await Promise.all([
      client.from('topics').select('id, name, slug').order('name'),
      client.from('user_interests').select('topic_id').eq('user_id', userId).limit(60),
      client.from('user_personalization').select('enabled, interests_selected').eq('user_id', userId).maybeSingle(),
    ]);

    const selected = new Set((selectedRows || []).map(r => r.topic_id));
    const activity = await topicActivity(client);

    const suggested = [...activity.entries()]
      .filter(([id]) => !selected.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, COLD_START.interestsToSuggest)
      .map(([id]) => id);

    const enriched = (topics || []).map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      selected: selected.has(t.id),
      active: (activity.get(String(t.id)) || 0) > 0,
    }));

    return NextResponse.json({
      topics: enriched,
      suggestedTopicIds: suggested,
      interestsSelected: !!settings?.interests_selected,
      enabled: settings ? settings.enabled !== false : true,
      selectedCount: selected.size,
    });
  } catch (err) {
    console.error('[Interests] GET Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client) {
      return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { topic_ids: topicIds, enabled, reset } = body;

    // ── Reset personalization (real, meaningful) ─────────────
    if (reset === true) {
      await Promise.all([
        client.from('rec_events').delete().eq('user_id', userId),
        client.from('user_affinities').delete().eq('user_id', userId),
        client.from('rec_feedback').delete().eq('user_id', userId),
        client.from('user_interests').delete().eq('user_id', userId),
      ]);
      await ensureSettings(client, userId, { interests_selected: false, reset_at: new Date().toISOString() });
      return NextResponse.json({ success: true, reset: true });
    }

    // ── Toggle personalization on/off ────────────────────────
    if (typeof enabled === 'boolean') {
      await ensureSettings(client, userId, { enabled });
      return NextResponse.json({ success: true, enabled });
    }

    // ── Replace explicit topic selection ─────────────────────
    if (Array.isArray(topicIds)) {
      const clean = [...new Set(topicIds.filter(id => typeof id === 'string' && id.length === 36))];
      let validIds = new Set();
      if (clean.length) {
        const { data } = await client.from('topics').select('id').in('id', clean);
        validIds = new Set((data || []).map(t => t.id));
      }

      const { error: delError } = await client
        .from('user_interests')
        .delete()
        .eq('user_id', userId);
      if (delError) throw delError;

      const rows = [...validIds].map(topicId => ({
        user_id: userId,
        topic_id: topicId,
        source: 'onboarding',
      }));
      if (rows.length) {
        const { error: insError } = await client.from('user_interests').insert(rows);
        if (insError) throw insError;
        // Explicit choices are the strongest legitimate topic signal.
        for (const row of rows) {
          recordSignal({
            client,
            userId,
            eventType: 'topic_viewed',
            targetType: 'topic',
            targetId: row.topic_id,
            context: { source: 'explicit_selection' },
            weight: 2.5,
            idempotencyKey: `interest-${row.topic_id}`,
          }).catch(() => {});
        }
      }

      await ensureSettings(client, userId, {
        interests_selected: rows.length > 0,
        interests_updated_at: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, selectedCount: rows.length });
    }

    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  } catch (err) {
    console.error('[Interests] POST Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
