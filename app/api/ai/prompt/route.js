/**
 * BURN BOARD — AI Prompt Assistance API
 * 
 * User-initiated Hot Seat prompt assistance.
 * OPTIONAL - core product works without this.
 * 
 * POST /api/ai/prompt - Get prompt suggestions
 * 
 * Body:
 *   idea: string (user's prompt idea)
 *   category: string (hot seat category)
 * 
 * Response:
 *   success: boolean
 *   suggestions: string[] (prompt variations)
 *   provider: string (which AI provider was used)
 */

import { NextResponse } from 'next/server';
import { generateHotSeatPrompt } from '@/lib/aiService';
import { rateLimitMiddleware, getClientIp, ipKey, RATE_LIMITS } from '@/lib/serverRateLimit';

export async function POST(request) {
  try {
    // Rate limit AI requests
    const clientIp = getClientIp(request);
    const rlResult = rateLimitMiddleware(
      ipKey(clientIp, 'ai'),
      { windowMs: 60 * 60 * 1000, maxRequests: 20 } // 20 AI requests per hour
    );

    if (rlResult.blocked) {
      return NextResponse.json(rlResult.response, { status: 429 });
    }

    const body = await request.json();
    const { idea, category } = body;

    if (!idea) {
      return NextResponse.json(
        { error: 'idea is required' },
        { status: 400 }
      );
    }

    const result = await generateHotSeatPrompt(idea, category, clientIp);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, provider: result.provider },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      suggestions: result.suggestions,
      provider: result.provider,
    });

  } catch (error) {
    console.error('[AI Prompt] Error:', error);
    return NextResponse.json(
      { error: 'AI assistance unavailable. You can still create your Hot Seat manually.' },
      { status: 500 }
    );
  }
}
