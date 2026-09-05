import { NextResponse } from 'next/server';
import { getTopics } from '@/lib/communities';

/**
 * GET /api/communities/topics
 *
 * List curated interest topics for community creation pickers.
 * Topics are shared metadata (normalized table), not fake activity.
 */

export async function GET() {
  try {
    const topics = await getTopics();
    return NextResponse.json({ topics });
  } catch (err) {
    console.error('[Communities] Topics Error:', err);
    return NextResponse.json({ topics: [] });
  }
}