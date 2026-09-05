/**
 * BURN BOARD — Leaderboard Service
 * 
 * Content-based leaderboards: Hot Seats, Roasts, Battles.
 * Weekly period: Monday 00:00 UTC → Sunday 23:59:59 UTC.
 * 
 * Leaderboard Types:
 *   - most_cooked:  Hot Seats ranked by burn score + engagement
 *   - funniest:     Roasts ranked by 😂 funny reactions
 *   - savage:       Roasts ranked by 🔥 savage reactions
 *   - fatal:        Roasts ranked by 💀 fatal reactions
 *   - top_battles:  Battles ranked by votes + engagement
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ── Weekly Period Definition ─────────────────────────────────
// Monday 00:00 UTC → Sunday 23:59:59 UTC

function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  
  // Find Monday of this week
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + mondayOffset);
  monday.setUTCHours(0, 0, 0, 0);
  
  // Sunday end of this week
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  
  return { start: monday, end: sunday };
}

function getLastWeekRange() {
  const now = new Date();
  const lastWeekEnd = new Date(now);
  lastWeekEnd.setUTCDate(now.getUTCDate() - now.getUTCDay()); // Last Sunday
  lastWeekEnd.setUTCHours(23, 59, 59, 999);
  
  const lastWeekStart = new Date(lastWeekEnd);
  lastWeekStart.setUTCDate(lastWeekEnd.getUTCDate() - 6);
  lastWeekStart.setUTCHours(0, 0, 0, 0);
  
  return { start: lastWeekStart, end: lastWeekEnd };
}

function getPeriodRange(period) {
  if (period === 'last_week') return getLastWeekRange();
  if (period === 'alltime') return null; // no time restriction
  return getWeekRange(); // default: this_week
}

function formatPeriodLabel(period) {
  switch (period) {
    case 'this_week': return 'This Week';
    case 'last_week': return 'Last Week';
    case 'alltime': return 'All Time';
    default: return 'This Week';
  }
}

function formatWeekLabel(start, end) {
  if (!start || !end) return '';
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

// ── Engagement Score (shared with burn-report) ───────────────
const SCORE_WEIGHTS = { funny: 3, savage: 2, fatal: 4 };

function getEngagementScore(counts) {
  if (!counts) return 0;
  return (
    (counts.funny || 0) * SCORE_WEIGHTS.funny +
    (counts.savage || 0) * SCORE_WEIGHTS.savage +
    (counts.fatal || 0) * SCORE_WEIGHTS.fatal
  );
}

// ── Burn Score Calculation (matches burn-report API) ─────────
function calculateBurnScore(roastCount, reactionCounts) {
  if (!roastCount || roastCount === 0) return 0;
  
  let totalEngagement = 0;
  for (const counts of Object.values(reactionCounts)) {
    totalEngagement += getEngagementScore(counts);
  }
  
  const maxPossibleEngagement = roastCount * 15;
  if (maxPossibleEngagement === 0) return 0;
  
  const rawScore = (totalEngagement / maxPossibleEngagement) * 100;
  return Math.min(100, Math.round(rawScore));
}

// ── Fetch Reactions in Batch ─────────────────────────────────
async function fetchReactionCounts(roastIds) {
  if (!roastIds || roastIds.length === 0) return {};
  
  const { data: reactions } = await supabase
    .from('hot_seat_roast_reactions')
    .select('roast_id, reaction_type')
    .in('roast_id', roastIds)
    .eq('is_active', true);
  
  const counts = {};
  if (reactions) {
    for (const r of reactions) {
      if (!counts[r.roast_id]) {
        counts[r.roast_id] = { funny: 0, savage: 0, fatal: 0, total: 0 };
      }
      counts[r.roast_id][r.reaction_type] = (counts[r.roast_id][r.reaction_type] || 0) + 1;
      counts[r.roast_id].total++;
    }
  }
  return counts;
}

// ── Content Eligibility ──────────────────────────────────────
// Safety-aware: excludes content that is removed, limited, or under review
function isHotSeatEligible(seat) {
  if (!seat) return false;
  if (seat.status === 'deleted' || seat.status === 'removed') return false;
  if (seat.status === 'private') return false;
  // Safety: exclude content under moderation
  if (seat.moderation_state === 'removed') return false;
  if (seat.moderation_state === 'limited') return false;
  if (seat.moderation_state === 'under_review') return false;
  return true;
}

function isRoastEligible(roast) {
  if (!roast) return false;
  if (roast.is_hidden) return false;
  if (roast.is_clean === false) return false;
  // Safety: exclude content under moderation
  if (roast.moderation_state === 'removed') return false;
  if (roast.moderation_state === 'limited') return false;
  if (roast.moderation_state === 'under_review') return false;
  return true;
}

function isBattleEligible(battle) {
  if (!battle) return false;
  if (battle.status === 'cancelled') return false;
  return true;
}

// ── LEADERBOARD: MOST COOKED ─────────────────────────────────
async function getMostCookedLeaderboard(period = 'this_week', limit = 25) {
  if (!isSupabaseConfigured || !supabase) return [];

  const range = getPeriodRange(period);
  
  // Fetch hot seats (safety-aware: exclude removed/limited content)
  let query = supabase
    .from('hot_seats')
    .select('*')
    .neq('status', 'deleted')
    .eq('moderation_state', 'visible')
    .order('roast_count', { ascending: false })
    .limit(100);

  if (range) {
    query = query.gte('created_at', range.start.toISOString())
                  .lte('created_at', range.end.toISOString());
  }

  const { data: seats } = await query;
  if (!seats || seats.length === 0) return [];

  // Fetch roasts for these seats
  const seatIds = seats.map(s => s.id);
  const { data: seatRoasts } = await supabase
    .from('hot_seat_roasts')
    .select('id, hot_seat_id')
    .in('hot_seat_id', seatIds)
    .eq('is_hidden', false);

  // Batch fetch reactions
  const roastIds = (seatRoasts || []).map(r => r.id);
  const reactionCounts = await fetchReactionCounts(roastIds);

  // Aggregate reactions per seat
  const reactionsBySeat = {};
  if (seatRoasts) {
    for (const sr of seatRoasts) {
      if (reactionCounts[sr.id]) {
        if (!reactionsBySeat[sr.hot_seat_id]) {
          reactionsBySeat[sr.hot_seat_id] = { funny: 0, savage: 0, fatal: 0, total: 0 };
        }
        const rc = reactionCounts[sr.id];
        reactionsBySeat[sr.hot_seat_id].funny += rc.funny || 0;
        reactionsBySeat[sr.hot_seat_id].savage += rc.savage || 0;
        reactionsBySeat[sr.hot_seat_id].fatal += rc.fatal || 0;
        reactionsBySeat[sr.hot_seat_id].total += rc.total || 0;
      }
    }
  }

  // Score and rank
  const scored = seats
    .filter(isHotSeatEligible)
    .map(seat => {
      const reactions = reactionsBySeat[seat.id] || {};
      const burnScore = calculateBurnScore(seat.roast_count || 0, reactions);
      const engagement = getEngagementScore(reactions);
      
      // Qualification: at least 2 roasts to be ranked meaningfully
      const qualified = (seat.roast_count || 0) >= 2;
      
      return {
        ...seat,
        burnScore,
        engagementScore: engagement,
        reactionTotals: reactions,
        qualified,
        rank: 0,
      };
    })
    .filter(s => s.qualified)
    .sort((a, b) => {
      // Primary: burn score, Secondary: total reactions, Tertiary: roast count
      if (b.burnScore !== a.burnScore) return b.burnScore - a.burnScore;
      if (b.reactionTotals.total !== a.reactionTotals.total) return b.reactionTotals.total - a.reactionTotals.total;
      return (b.roast_count || 0) - (a.roast_count || 0);
    })
    .slice(0, limit)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  return scored;
}

// ── LEADERBOARD: ROAST BY REACTION TYPE ──────────────────────
async function getRoastsLeaderboard(reactionType = 'funny', period = 'this_week', limit = 25) {
  if (!isSupabaseConfigured || !supabase) return [];

  const range = getPeriodRange(period);
  const validTypes = ['funny', 'savage', 'fatal'];
  const type = validTypes.includes(reactionType) ? reactionType : 'funny';

  // Fetch hot seat roasts
  let hsQuery = supabase
    .from('hot_seat_roasts')
    .select('*')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(200);

  if (range) {
    hsQuery = hsQuery.gte('created_at', range.start.toISOString())
                      .lte('created_at', range.end.toISOString());
  }

  const { data: hsRoasts } = await hsQuery;

  // Fetch classic roasts
  let classicQuery = supabase
    .from('roasts')
    .select('*')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(200);

  if (range) {
    classicQuery = classicQuery.gte('created_at', range.start.toISOString())
                               .lte('created_at', range.end.toISOString());
  }

  const { data: classicRoasts } = await classicQuery;

  // Batch fetch reactions for hot seat roasts
  const hsRoastIds = (hsRoasts || []).map(r => r.id);
  const reactionCounts = await fetchReactionCounts(hsRoastIds);

  // Combine and score
  const allRoasts = [];

  if (hsRoasts) {
    for (const roast of hsRoasts) {
      if (!isRoastEligible(roast)) continue;
      const counts = reactionCounts[roast.id] || { funny: 0, savage: 0, fatal: 0 };
      const primaryCount = counts[type] || 0;
      if (primaryCount === 0) continue;
      
      const engagement = getEngagementScore(counts);
      allRoasts.push({
        ...roast,
        source: 'hot_seat',
        reactionCounts: counts,
        primaryScore: primaryCount,
        engagementScore: engagement,
        rank: 0,
      });
    }
  }

  if (classicRoasts) {
    for (const roast of classicRoasts) {
      if (!isRoastEligible(roast)) continue;
      const counts = {
        funny: roast.reaction_haha || 0,
        savage: roast.reaction_brutal || 0,
        fatal: roast.reaction_cry || 0,
      };
      const primaryCount = counts[type] || 0;
      if (primaryCount === 0) continue;
      
      const engagement = getEngagementScore(counts);
      allRoasts.push({
        ...roast,
        source: 'classic',
        reactionCounts: counts,
        primaryScore: primaryCount,
        engagementScore: engagement,
        rank: 0,
      });
    }
  }

  return allRoasts
    .sort((a, b) => {
      // Primary: reaction count of the specific type
      if (b.primaryScore !== a.primaryScore) return b.primaryScore - a.primaryScore;
      // Secondary: total engagement
      return b.engagementScore - a.engagementScore;
    })
    .slice(0, limit)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

// ── LEADERBOARD: TOP BATTLES ─────────────────────────────────
async function getTopBattlesLeaderboard(period = 'this_week', limit = 25) {
  if (!isSupabaseConfigured || !supabase) return [];

  const range = getPeriodRange(period);

  let query = supabase
    .from('battles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (range) {
    query = query.gte('created_at', range.start.toISOString())
                  .lte('created_at', range.end.toISOString());
  }

  const { data: battles } = await query;
  if (!battles || battles.length === 0) return [];

  // Fetch profile data
  const profileIds = new Set();
  for (const b of battles) {
    if (b.profile1_id) profileIds.add(b.profile1_id);
    if (b.profile2_id) profileIds.add(b.profile2_id);
  }

  let profilesMap = {};
  if (profileIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, platform, avatar_letter, avatar_color, roast_count, total_upvotes')
      .in('id', [...profileIds]);
    if (profiles) {
      for (const p of profiles) profilesMap[p.id] = p;
    }
  }

  const scored = battles
    .filter(isBattleEligible)
    .map(battle => {
      const totalVotes = (battle.votes1 || 0) + (battle.votes2 || 0);
      
      // Closeness: more close battles are more interesting
      const closer = totalVotes > 0
        ? 1 - Math.abs((battle.votes1 || 0) - (battle.votes2 || 0)) / totalVotes
        : 0;
      
      // Score: votes + closeness bonus + activity bonus
      const score = totalVotes + (closer * totalVotes * 0.3);
      
      // Qualification: at least 2 votes
      const qualified = totalVotes >= 2;

      return {
        ...battle,
        profile1: profilesMap[battle.profile1_id] || null,
        profile2: profilesMap[battle.profile2_id] || null,
        totalVotes,
        closeness: closer,
        battleScore: Math.round(score),
        qualified,
        rank: 0,
      };
    })
    .filter(b => b.qualified)
    .sort((a, b) => b.battleScore - a.battleScore)
    .slice(0, limit)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  return scored;
}

// ── WEEKLY RECAP ─────────────────────────────────────────────
async function getWeeklyRecap(period = 'this_week') {
  if (!isSupabaseConfigured || !supabase) return null;

  const range = getPeriodRange(period);
  if (!range) return null;

  const [mostCooked, funniest, savage, fatal, topBattle] = await Promise.all([
    getMostCookedLeaderboard(period, 1),
    getRoastsLeaderboard('funny', period, 1),
    getRoastsLeaderboard('savage', period, 1),
    getRoastsLeaderboard('fatal', period, 1),
    getTopBattlesLeaderboard(period, 1),
  ]);

  // Fetch hot seat details for the most cooked
  let mostCookedDetails = null;
  if (mostCooked.length > 0) {
    const seat = mostCooked[0];
    mostCookedDetails = {
      id: seat.id,
      title: seat.title,
      displayName: seat.display_name,
      category: seat.category,
      heatLevel: seat.heat_level,
      burnScore: seat.burnScore,
      roastCount: seat.roast_count || 0,
      totalReactions: seat.reactionTotals?.total || 0,
      link: `/hot-seat/${seat.id}`,
    };
  }

  // Format roast highlights
  const formatRoastHighlight = (roasts) => {
    if (!roasts || roasts.length === 0) return null;
    const r = roasts[0];
    return {
      id: r.id,
      text: r.roast_text,
      anonId: r.anon_id,
      primaryScore: r.primaryScore,
      engagementScore: r.engagementScore,
      source: r.source,
      hotSeatId: r.hot_seat_id || null,
      link: r.source === 'hot_seat' && r.hot_seat_id ? `/hot-seat/${r.hot_seat_id}` : null,
    };
  };

  // Format battle highlight
  let topBattleDetails = null;
  if (topBattle.length > 0) {
    const b = topBattle[0];
    topBattleDetails = {
      id: b.id,
      profile1: b.profile1,
      profile2: b.profile2,
      votes1: b.votes1,
      votes2: b.votes2,
      totalVotes: b.totalVotes,
      closeness: b.closeness,
      link: '/battle',
    };
  }

  // Get aggregate stats for the week
  const weekStats = await getWeekStats(range);

  return {
    period,
    periodLabel: formatPeriodLabel(period),
    weekRange: formatWeekLabel(range.start, range.end),
    weekStart: range.start.toISOString(),
    weekEnd: range.end.toISOString(),
    mostCooked: mostCookedDetails,
    funniestRoast: formatRoastHighlight(funniest),
    mostSavageRoast: formatRoastHighlight(savage),
    mostFatalRoast: formatRoastHighlight(fatal),
    topBattle: topBattleDetails,
    stats: weekStats,
  };
}

// ── Week Aggregate Stats ─────────────────────────────────────
async function getWeekStats(range) {
  if (!range || !isSupabaseConfigured || !supabase) {
    return { hotSeats: 0, roasts: 0, reactions: 0, battles: 0, votes: 0 };
  }

  const [seatsRes, roastsRes, reactionsRes, battlesRes] = await Promise.all([
    supabase.from('hot_seats').select('id', { count: 'exact', head: true })
      .gte('created_at', range.start.toISOString())
      .lte('created_at', range.end.toISOString())
      .neq('status', 'deleted'),
    supabase.from('hot_seat_roasts').select('id', { count: 'exact', head: true })
      .gte('created_at', range.start.toISOString())
      .lte('created_at', range.end.toISOString())
      .eq('is_hidden', false),
    supabase.from('hot_seat_roast_reactions').select('id', { count: 'exact', head: true })
      .gte('created_at', range.start.toISOString())
      .lte('created_at', range.end.toISOString())
      .eq('is_active', true),
    supabase.from('battles').select('id', { count: 'exact', head: true })
      .gte('created_at', range.start.toISOString())
      .lte('created_at', range.end.toISOString()),
  ]);

  // Total votes across all battles this week
  const { data: battleVotes } = await supabase
    .from('battles')
    .select('votes1, votes2')
    .gte('created_at', range.start.toISOString())
    .lte('created_at', range.end.toISOString());

  const totalVotes = (battleVotes || []).reduce(
    (sum, b) => sum + (b.votes1 || 0) + (b.votes2 || 0), 0
  );

  return {
    hotSeats: seatsRes.count || 0,
    roasts: roastsRes.count || 0,
    reactions: reactionsRes.count || 0,
    battles: battlesRes.count || 0,
    votes: totalVotes,
  };
}

// ── Public API ───────────────────────────────────────────────

export {
  getWeekRange,
  getLastWeekRange,
  getPeriodRange,
  formatPeriodLabel,
  formatWeekLabel,
  getMostCookedLeaderboard,
  getRoastsLeaderboard,
  getTopBattlesLeaderboard,
  getWeeklyRecap,
  getEngagementScore,
  calculateBurnScore,
};
