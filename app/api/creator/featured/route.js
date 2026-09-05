import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/routeAuth';

/**
 * GET    /api/creator/featured  → { postId }
 * PUT    /api/creator/featured  { post_id }   pin a public, visible post you own
 * DELETE /api/creator/featured                unpin
 *
 * Ownership, visibility, and moderation are validated server-side at set
 * time; the public read route re-validates at read time (removed or made
 * private later → pinned content simply stops showing).
 */

export async function GET(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { data } = await client
      .from('user_profiles')
      .select('featured_post_id')
      .eq('id', userId)
      .single();
    return NextResponse.json({ postId: data?.featured_post_id || null });
  } catch (err) {
    console.error('[Creator Featured] GET Error:', err);
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
    const postId = body?.post_id;
    if (!postId || typeof postId !== 'string') {
      return NextResponse.json({ error: 'Missing post_id' }, { status: 400 });
    }

    // Ownership + eligibility: must be your own, public, visible content.
    const { data: post } = await client
      .from('social_posts')
      .select('id, user_id, visibility, moderation_state')
      .eq('id', postId)
      .single();

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    if (post.user_id !== userId) {
      return NextResponse.json({ error: 'You can only pin your own content' }, { status: 403 });
    }
    if (post.visibility !== 'public' || post.moderation_state !== 'visible') {
      return NextResponse.json(
        { error: 'Only public, visible content can be featured' },
        { status: 400 }
      );
    }

    const { error } = await client
      .from('user_profiles')
      .update({ featured_post_id: postId })
      .eq('id', userId);

    if (error) {
      console.error('[Creator Featured] Update error:', error);
      return NextResponse.json({ error: 'Failed to feature post' }, { status: 500 });
    }

    return NextResponse.json({ success: true, postId });
  } catch (err) {
    console.error('[Creator Featured] PUT Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { client, userId } = await getRequestContext(req);
    if (!client || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await client
      .from('user_profiles')
      .update({ featured_post_id: null })
      .eq('id', userId);

    if (error) {
      console.error('[Creator Featured] DELETE Error:', error);
      return NextResponse.json({ error: 'Failed to unpin post' }, { status: 500 });
    }

    return NextResponse.json({ success: true, postId: null });
  } catch (err) {
    console.error('[Creator Featured] DELETE Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
