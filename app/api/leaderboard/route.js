import { NextResponse } from 'next/server';
import {
  getMostCookedLeaderboard,
  getRoastsLeaderboard,
  getTopBattlesLeaderboard,
  formatPeriodLabel,
  formatWeekLabel,
  getWeekRange,
  getLastWeekRange,
} from '@/lib/leaderboard';
import { cacheAside, CACHE_TTL } from '@/lib/cache';
import { createLogger } from '@/lib/logger';
import { instrumentHandler } from '@/lib/metrics';

const log = createLogger('leaderboard');

/**
 * GET /api/leaderboard
 * 
 * Query params:
 *   - type:    'most_cooked' | 'funniest' | 'savage' | 'fatal' | 'top_battles' | 'all' (default: 'all')
 *   - period:  'this_week' | 'last_week' | 'alltime' (default: 'this_week')
 *   - limit:   number (default: 25, max: 50)
 */
async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'all';
    const period = searchParams.get('period') || 'this_week';
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 50);

    // Validate period
    const validPeriods = ['this_week', 'last_week', 'alltime'];
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        { error: `Invalid period. Must be one of: ${validPeriods.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['most_cooked', 'funniest', 'savage', 'fatal', 'top_battles', 'all'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Period metadata
    const thisWeek = getWeekRange();
    const lastWeek = getLastWeekRange();
    const periodMeta = {
      this_week: {
        label: formatPeriodLabel('this_week'),
        weekRange: formatWeekLabel(thisWeek.start, thisWeek.end),
      },
      last_week: {
        label: formatPeriodLabel('last_week'),
        weekRange: formatWeekLabel(lastWeek.start, lastWeek.end),
      },
      alltime: {
        label: formatPeriodLabel('alltime'),
        weekRange: null,
      },
    };

    const start = Date.now();
    
    // Cache leaderboard data per type+period+limit combination
    const cacheKey = `leaderboard:${type}:${period}:${limit}`;
    
    const result = await cacheAside(
      cacheKey,
      async () => {
        const data = {
          period,
          periodMeta: periodMeta[period],
        };

        if (type === 'all' || type === 'most_cooked') {
          data.mostCooked = await getMostCookedLeaderboard(period, limit);
        }

        if (type === 'all' || type === 'funniest') {
          data.funniest = await getRoastsLeaderboard('funny', period, limit);
        }

        if (type === 'all' || type === 'savage') {
          data.savage = await getRoastsLeaderboard('savage', period, limit);
        }

        if (type === 'all' || type === 'fatal') {
          data.fatal = await getRoastsLeaderboard('fatal', period, limit);
        }

        if (type === 'all' || type === 'top_battles') {
          data.topBattles = await getTopBattlesLeaderboard(period, limit);
        }

        return data;
      },
      CACHE_TTL.LEADERBOARD
    );

    log.info('Leaderboard fetched', {
      type,
      period,
      durationMs: Date.now() - start,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('[Leaderboard] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = instrumentHandler('leaderboard', getHandler);
