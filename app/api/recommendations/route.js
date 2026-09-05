/**
 * BURN BOARD — Recommendations API
 * 
 * Contextual next-best-action recommendations.
 * Privacy-conscious: uses only current session context.
 * 
 * POST /api/recommendations - Get recommendations
 * POST /api/recommendations/track - Track recommendation event
 * 
 * Body (POST /):
 *   pathname: string (current page path)
 * 
 * Body (POST /track):
 *   event: 'shown' | 'selected' | 'completed' | 'dismissed'
 *   type: string (recommendation type)
 */

import { NextResponse } from 'next/server';

// ── GET: No data exposed via GET ─────────────────────────────
export async function GET() {
  return NextResponse.json(
    { error: 'Use POST to get recommendations' },
    { status: 405 }
  );
}

// ── POST: Get recommendations ────────────────────────────────
export async function POST(request) {
  try {
    const body = await request.json();
    const { pathname } = body;

    // Import recommendation engine (client-side logic, but we can compute server-side)
    const { getNextBestActions, detectPageContext } = await import('@/lib/recommendations');
    
    const context = detectPageContext(pathname || '/');
    const recommendations = getNextBestActions({ pathname: pathname || '/' });

    return NextResponse.json({
      success: true,
      context,
      recommendations,
    });

  } catch (error) {
    console.error('[Recommendations] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}
