import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ── Burn Score Weights (matches hot-seat page SCORE_WEIGHTS) ──
const SCORE_WEIGHTS = { funny: 3, savage: 2, fatal: 4 };

// ── Burn Status Thresholds ──
const STATUS_THRESHOLDS = [
  { max: 0, label: 'Untouched', emoji: '😴', color: '#71717a' },
  { max: 15, label: 'Singed', emoji: '🕯️', color: '#f59e0b' },
  { max: 35, label: 'Scorched', emoji: '🔥', color: '#f97316' },
  { max: 60, label: 'Blazing', emoji: '🔥', color: '#ef4444' },
  { max: 80, label: 'Well Done', emoji: '🍖', color: '#dc2626' },
  { max: 100, label: 'Absolutely Cooked', emoji: '💀', color: '#ff4d00' },
];

function getBurnStatus(score) {
  for (const threshold of STATUS_THRESHOLDS) {
    if (score <= threshold.max) return threshold;
  }
  return STATUS_THRESHOLDS[STATUS_THRESHOLDS.length - 1];
}

function getEngagementScore(counts) {
  if (!counts) return 0;
  return (
    (counts.funny || 0) * SCORE_WEIGHTS.funny +
    (counts.savage || 0) * SCORE_WEIGHTS.savage +
    (counts.fatal || 0) * SCORE_WEIGHTS.fatal
  );
}

function calculateBurnScore(roasts, reactionCounts) {
  if (!roasts || roasts.length === 0) return 0;

  let totalEngagement = 0;
  let maxPossibleEngagement = 0;

  for (const roast of roasts) {
    const counts = reactionCounts[roast.id] || { funny: 0, savage: 0, fatal: 0, total: 0 };
    totalEngagement += getEngagementScore(counts);
    // Each roast can theoretically get reactions from other roasters
    // We normalize per-roast to prevent roasts with more reactions from skewing
    maxPossibleEngagement += 15; // reasonable max per roast (5 funny + 5 savage + 5 fatal)
  }

  if (maxPossibleEngagement === 0) return 0;

  // Score normalized to 0-100, with diminishing returns at high counts
  const rawScore = (totalEngagement / maxPossibleEngagement) * 100;
  return Math.min(100, Math.round(rawScore));
}

function getTopRoast(roasts, reactionCounts) {
  if (!roasts || roasts.length === 0) return null;

  // Find roast with highest total reactions, then by engagement score
  let best = null;
  let bestScore = -1;

  for (const roast of roasts) {
    const counts = reactionCounts[roast.id] || { funny: 0, savage: 0, fatal: 0, total: 0 };
    const score = getEngagementScore(counts);
    if (score > bestScore) {
      bestScore = score;
      best = { ...roast, reactionCounts: counts, engagementScore: score };
    }
  }

  // Only return if the roast has at least some engagement
  if (best && best.engagementScore > 0) return best;
  return null;
}

function getCategoryRoast(roasts, reactionCounts, type) {
  if (!roasts || roasts.length === 0) return null;
  const field = type === 'funny' ? 'funny' : type === 'savage' ? 'savage' : 'fatal';
  let best = null;
  let bestCount = -1;

  for (const roast of roasts) {
    const counts = reactionCounts[roast.id] || {};
    const count = counts[field] || 0;
    if (count > bestCount) {
      bestCount = count;
      best = { ...roast, reactionCounts: counts };
    }
  }

  if (best && bestCount > 0) return best;
  return null;
}

export async function GET(req, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Missing hot seat ID' }, { status: 400 });
    }

    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // Fetch the hot seat
    const { data: hotSeat, error: seatError } = await supabase
      .from('hot_seats')
      .select('*')
      .eq('id', id)
      .neq('status', 'deleted')
      .single();

    if (seatError || !hotSeat) {
      return NextResponse.json({ error: 'Hot seat not found' }, { status: 404 });
    }

    // Privacy check: only public hot seats can have share cards
    if (hotSeat.status === 'private') {
      return NextResponse.json({ error: 'This Hot Seat is private' }, { status: 403 });
    }

    // Fetch roasts (only visible, non-hidden)
    const { data: roasts, error: roastsError } = await supabase
      .from('hot_seat_roasts')
      .select('*')
      .eq('hot_seat_id', id)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(200);

    if (roastsError) {
      console.error('[BurnReport] Roast fetch error:', roastsError);
    }

    // Fetch reaction counts
    let reactionCounts = {};
    if (roasts && roasts.length > 0) {
      const roastIds = roasts.map(r => r.id);
      const { data: reactions } = await supabase
        .from('hot_seat_roast_reactions')
        .select('roast_id, reaction_type')
        .in('roast_id', roastIds)
        .eq('is_active', true);

      if (reactions) {
        for (const r of reactions) {
          if (!reactionCounts[r.roast_id]) {
            reactionCounts[r.roast_id] = { funny: 0, savage: 0, fatal: 0, total: 0 };
          }
          reactionCounts[r.roast_id][r.reaction_type]++;
          reactionCounts[r.roast_id].total++;
        }
      }
    }

    // Calculate burn score
    const burnScore = calculateBurnScore(roasts, reactionCounts);
    const burnStatus = getBurnStatus(burnScore);
    const topRoast = getTopRoast(roasts, reactionCounts);
    const funniestRoast = getCategoryRoast(roasts, reactionCounts, 'funny');
    const mostSavageRoast = getCategoryRoast(roasts, reactionCounts, 'savage');
    const mostFatalRoast = getCategoryRoast(roasts, reactionCounts, 'fatal');

    const totalReactions = Object.values(reactionCounts).reduce(
      (sum, counts) => sum + (counts.total || 0), 0
    );

    return NextResponse.json({
      success: true,
      report: {
        hotSeatId: hotSeat.id,
        title: hotSeat.title,
        displayName: hotSeat.display_name,
        category: hotSeat.category,
        heatLevel: hotSeat.heat_level,
        burnScore,
        burnStatus: {
          label: burnStatus.label,
          emoji: burnStatus.emoji,
          color: burnStatus.color,
        },
        roastCount: roasts ? roasts.length : 0,
        totalReactions,
        topRoast: topRoast ? {
          id: topRoast.id,
          text: topRoast.roast_text,
          anonId: topRoast.anon_id,
          createdAt: topRoast.created_at,
          engagementScore: topRoast.engagementScore,
          reactionCounts: topRoast.reactionCounts,
        } : null,
        funniestRoast: funniestRoast ? {
          id: funniestRoast.id,
          text: funniestRoast.roast_text,
          anonId: funniestRoast.anon_id,
          reactionCount: funniestRoast.reactionCounts?.funny || 0,
        } : null,
        mostSavageRoast: mostSavageRoast ? {
          id: mostSavageRoast.id,
          text: mostSavageRoast.roast_text,
          anonId: mostSavageRoast.anon_id,
          reactionCount: mostSavageRoast.reactionCounts?.savage || 0,
        } : null,
        mostFatalRoast: mostFatalRoast ? {
          id: mostFatalRoast.id,
          text: mostFatalRoast.roast_text,
          anonId: mostFatalRoast.anon_id,
          reactionCount: mostFatalRoast.reactionCounts?.fatal || 0,
        } : null,
        publicUrl: `/hot-seat/${hotSeat.id}`,
        shareUrl: `/hot-seat/${hotSeat.id}/share`,
      },
    });
  } catch (err) {
    console.error('[BurnReport] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
