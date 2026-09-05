import { NextResponse } from 'next/server';
import { getWeeklyRecap } from '@/lib/leaderboard';

/**
 * GET /api/weekly-recap
 * 
 * Query params:
 *   - period: 'this_week' | 'last_week' (default: 'this_week')
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'this_week';

    const validPeriods = ['this_week', 'last_week'];
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        { error: `Invalid period. Must be one of: ${validPeriods.join(', ')}` },
        { status: 400 }
      );
    }

    const recap = await getWeeklyRecap(period);

    if (!recap) {
      return NextResponse.json({
        success: true,
        recap: null,
        message: 'No data available for this period',
      });
    }

    return NextResponse.json({ success: true, recap });
  } catch (err) {
    console.error('[WeeklyRecap] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
