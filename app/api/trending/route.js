import { NextResponse } from 'next/server';
import { 
  fetchTrendingHotSeats, 
  fetchTrendingRoasts, 
  fetchTrendingBattles,
  TIME_WINDOWS 
} from '@/lib/trending';
import { cacheAside, CACHE_TTL } from '@/lib/cache';
import { createLogger } from '@/lib/logger';
import { instrumentHandler } from '@/lib/metrics';

const log = createLogger('trending');

/**
 * GET /api/trending
 * 
 * Query params:
 *   - type:    'hotseats' | 'roasts' | 'battles' | 'all' (default: 'all')
 *   - window:  'now' | 'today' | 'week' | 'alltime' (default: 'now')
 *   - limit:   number (default: 20, max: 50)
 */
async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'all';
    const window = searchParams.get('window') || 'now';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    // Validate window
    if (!TIME_WINDOWS[window]) {
      return NextResponse.json(
        { error: `Invalid window. Must be one of: ${Object.keys(TIME_WINDOWS).join(', ')}` },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['hotseats', 'roasts', 'battles', 'all'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const start = Date.now();
    
    // Cache trending data per type+window combination
    const cacheKey = `trending:${type}:${window}:${limit}`;
    
    const result = await cacheAside(
      cacheKey,
      async () => {
        const data = {};

        if (type === 'all' || type === 'hotseats') {
          data.hotSeats = await fetchTrendingHotSeats(window, limit);
        }

        if (type === 'all' || type === 'roasts') {
          data.roasts = await fetchTrendingRoasts(window, limit);
        }

        if (type === 'all' || type === 'battles') {
          data.battles = await fetchTrendingBattles(window, limit);
        }

        data.window = window;
        data.windowLabel = TIME_WINDOWS[window].label;
        
        return data;
      },
      CACHE_TTL.TRENDING
    );

    log.info('Trending fetched', {
      type,
      window,
      durationMs: Date.now() - start,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('[Trending] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = instrumentHandler('trending', getHandler);
