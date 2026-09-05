/**
 * BURN BOARD — AI Roast Style Assistance API
 * 
 * User-initiated roast style assistance.
 * OPTIONAL - core product works without this.
 * 
 * POST /api/ai/roast - Get roast style variations
 * 
 * Body:
 *   text: string (roast text)
 *   style: 'playful' | 'savage' | 'clean'
 * 
 * Response:
 *   success: boolean
 *   variations: string[] (style variations)
 *   provider: string (which AI provider was used)
 */

import { NextResponse } from 'next/server';
import { generateRoastStyle } from '@/lib/aiService';
import { rateLimitMiddleware, getClientIp, ipKey } from '@/lib/serverRateLimit';

export async function POST(request) {
  try {
    // Rate limit AI requests
    const clientIp = getClientIp(request);
    const rlResult = rateLimitMiddleware(
      ipKey(clientIp, 'ai'),
      { windowMs: 60 * 60 * 1000, maxRequests: 20 }
    );

    if (rlResult.blocked) {
      return NextResponse.json(rlResult.response, { status: 429 });
    }

    const body = await request.json();
    const { text, style } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'text is required' },
        { status: 400 }
      );
    }

    const validStyles = ['playful', 'savage', 'clean'];
    const roastStyle = validStyles.includes(style) ? style : 'playful';

    const result = await generateRoastStyle(text, roastStyle, clientIp);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, provider: result.provider },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      variations: result.variations,
      provider: result.provider,
    });

  } catch (error) {
    console.error('[AI Roast] Error:', error);
    return NextResponse.json(
      { error: 'AI assistance unavailable. You can still write your roast manually.' },
      { status: 500 }
    );
  }
}
