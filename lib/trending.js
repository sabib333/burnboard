/**
 * BURN BOARD — Trending Service
 * 
 * Isolated trending scoring engine for Hot Seats, Roasts, and Battles.
 * Uses recency + velocity + engagement for ranking.
 * 
 * Time Windows:
 *   - now:     last 24 hours
 *   - today:   last 7 days
 *   - week:    last 30 days
 *   - alltime: no time restriction
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ── Time Windows ────────────────────────────────────────────
const TIME_WINDOWS = {
  now:     { hours: 24,   label: 'Now' },
  today:   { hours: 168,  label: 'Today' },     // 7 days
  week:    { hours: 720,  label: 'This Week' },  // 30 days
  alltime: { hours: null, label: 'All Time' },
};

// ── Engagement Weights ──────────────────────────────────────
const REACTION_WEIGHTS = {
  funny:   3,
  savage:  2,
  fatal:   4,
  haha:    3,
  brutal:  4,
  cry:     2,
};

// ── Decay Function ──────────────────────────────────────────
// Exponential decay: score *= decayFactor^(hoursAgo / halfLife)
// halfLife determines how quickly content loses trending priority
const HALF_LIFE_HOURS = {
  now:   6,    // Content halves every 6 hours in "now" window
  today: 24,   // Content halves every 24 hours in "today" window
  week:  72,   // Content halves every 3 days in "week" window
  alltime: null,
};

function computeDecayFactor(hoursAgo, window) {
  const halfLife = HALF_LIFE_HOURS[window];
  if (!halfLife) return 1; // alltime — no decay
  return Math.pow(0.5, hoursAgo / halfLife);
}

// ── Score Weight Components ─────────────────────────────────
// Each component is normalized to roughly 0-1 range before weighting
const WEIGHTS = {
  hotSeat: {
    recency:    0.30,
    roastCount: 0.25,
    reactionVelocity: 0.25,
    engagementDepth:  0.20,
  },
  roast: {
    recency:          0.35,
    reactionVelocity: 0.35,
    engagementDepth:  0.30,
  },
  battle: {
    recency:      0.30,
    voteVelocity: 0.30,
    activeBonus:  0.20,
    engagementDepth: 0.20,
  },
};

// ── Hours Since ─────────────────────────────────────────────
function hoursSince(dateString) {
  if (!dateString) return 9999;
  const now = Date.now();
  const then = new Date(dateString).getTime();
  return Math.max(0, (now - then) / (1000 * 60 * 60));
}

// ── Clamp ───────────────────────────────────────────────────
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// ── Compute Engagement Score from Reaction Counts ───────────
function engagementScore(counts) {
  if (!counts) return 0;
  let score = 0;
  for (const [type, count] of Object.entries(counts)) {
    if (type === 'total') continue;
    score += (count || 0) * (REACTION_WEIGHTS[type] || 1);
  }
  return score;
}

// ── Main Scoring Functions ──────────────────────────────────

function scoreHotSeat(seat, reactionTotals, window) {
  const hours = hoursSince(seat.created_at);
  const decay = computeDecayFactor(hours, window);
  
  const w = WEIGHTS.hotSeat;
  
  // Recency: inversely proportional to age, boosted by decay
  const recencyScore = window === 'alltime' 
    ? 1 / (1 + hours * 0.001)  // very slow decay for alltime
    : decay;
  
  // Roast count velocity: roasts per hour (recent activity)
  const roastVelocity = hours > 0 ? (seat.roast_count || 0) / Math.max(hours, 1) : 0;
  const roastVelocityNorm = clamp(roastVelocity * 10, 0, 1); // normalize: 0.1 roasts/hr = 1.0
  
  // Reaction velocity: recent reactions per hour
  const totalReactions = (reactionTotals?.funny || 0) + (reactionTotals?.savage || 0) + (reactionTotals?.fatal || 0);
  const reactionVelocity = hours > 0 ? totalReactions / Math.max(hours, 1) : 0;
  const reactionVelocityNorm = clamp(reactionVelocity * 5, 0, 1); // normalize: 0.2 reactions/hr = 1.0
  
  // Engagement depth: weighted reaction total
  const engDepth = engagementScore(reactionTotals);
  const engDepthNorm = clamp(engDepth / 50, 0, 1); // 50 weighted reactions = max
  
  const score = (
    w.recency * recencyScore +
    w.roastCount * roastVelocityNorm +
    w.reactionVelocity * reactionVelocityNorm +
    w.engagementDepth * engDepthNorm
  );
  
  return {
    score,
    recency: recencyScore,
    roastVelocity: roastVelocityNorm,
    reactionVelocity: reactionVelocityNorm,
    engagementDepth: engDepthNorm,
    totalReactions,
    hoursAgo: hours,
  };
}

function scoreRoast(roast, reactionTotals, window) {
  const hours = hoursSince(roast.created_at);
  const decay = computeDecayFactor(hours, window);
  
  const w = WEIGHTS.roast;
  
  // Recency
  const recencyScore = window === 'alltime'
    ? 1 / (1 + hours * 0.001)
    : decay;
  
  // Reaction velocity
  const totalReactions = (reactionTotals?.funny || 0) + (reactionTotals?.savage || 0) + (reactionTotals?.fatal || 0);
  const reactionVelocity = hours > 0 ? totalReactions / Math.max(hours, 1) : 0;
  const reactionVelocityNorm = clamp(reactionVelocity * 5, 0, 1);
  
  // Engagement depth
  const engDepth = engagementScore(reactionTotals);
  const engDepthNorm = clamp(engDepth / 30, 0, 1); // 30 weighted reactions = max
  
  const score = (
    w.recency * recencyScore +
    w.reactionVelocity * reactionVelocityNorm +
    w.engagementDepth * engDepthNorm
  );
  
  return {
    score,
    recency: recencyScore,
    reactionVelocity: reactionVelocityNorm,
    engagementDepth: engDepthNorm,
    totalReactions,
    hoursAgo: hours,
  };
}

function scoreBattle(battle, window) {
  const hours = hoursSince(battle.created_at);
  const decay = computeDecayFactor(hours, window);
  
  const w = WEIGHTS.battle;
  
  // Recency
  const recencyScore = window === 'alltime'
    ? 1 / (1 + hours * 0.001)
    : decay;
  
  // Vote velocity
  const totalVotes = (battle.votes1 || 0) + (battle.votes2 || 0);
  const voteVelocity = hours > 0 ? totalVotes / Math.max(hours, 1) : 0;
  const voteVelocityNorm = clamp(voteVelocity * 5, 0, 1);
  
  // Active bonus
  const activeBonus = battle.is_active ? 1.0 : 0.2;
  
  // Engagement depth (vote diversity / closeness makes it more interesting)
  const closer = totalVotes > 0 
    ? 1 - Math.abs((battle.votes1 || 0) - (battle.votes2 || 0)) / totalVotes
    : 0;
  const engagementDepth = clamp(closer * 0.7 + clamp(totalVotes / 20, 0, 0.3), 0, 1);
  
  const score = (
    w.recency * recencyScore +
    w.voteVelocity * voteVelocityNorm +
    w.activeBonus * activeBonus +
    w.engagementDepth * engagementDepth
  );
  
  return {
    score,
    recency: recencyScore,
    voteVelocity: voteVelocityNorm,
    activeBonus,
    engagementDepth,
    totalVotes,
    hoursAgo: hours,
  };
}

// ── Trending Labels ─────────────────────────────────────────
function getTrendingLabel(scoreData, contentType) {
  const { score, hoursAgo, totalReactions, totalVotes } = scoreData;
  
  if (score >= 0.7) return { text: 'TRENDING', emoji: '🔥', color: 'text-[#ff4d00] bg-[#ff4d00]/10 border-[#ff4d00]/30' };
  if (score >= 0.4) return { text: 'RISING', emoji: '📈', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
  if (hoursAgo < 2 && (totalReactions > 0 || totalVotes > 0)) return { text: 'ACTIVE NOW', emoji: '⚡', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
  if (score >= 0.2) return { text: 'WARMING UP', emoji: '🌡️', color: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/30' };
  return null;
}

// ── Content Eligibility Check ───────────────────────────────
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
  if (roast.is_clean === false) return false; // moderated content
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

// ── Fetch Trending Data ─────────────────────────────────────

async function fetchTrendingHotSeats(window = 'now', limit = 20) {
  if (!isSupabaseConfigured || !supabase) return [];

  const timeConfig = TIME_WINDOWS[window] || TIME_WINDOWS.now;
  const cutoff = timeConfig.hours
    ? new Date(Date.now() - timeConfig.hours * 60 * 60 * 1000).toISOString()
    : null;

  // Fetch hot seats (safety-aware: exclude removed/limited content)
  let query = supabase
    .from('hot_seats')
    .select('*')
    .neq('status', 'deleted')
    .eq('moderation_state', 'visible')
    .order('created_at', { ascending: false })
    .limit(100); // fetch enough to rank

  if (cutoff) {
    query = query.gte('created_at', cutoff);
  }

  const { data: seats, error } = await query;
  if (error || !seats || seats.length === 0) return [];

  // Fetch reaction counts for all hot seat roasts
  const seatIds = seats.map(s => s.id);
  
  // Get roast IDs for these seats
  const { data: seatRoasts } = await supabase
    .from('hot_seat_roasts')
    .select('id, hot_seat_id')
    .in('hot_seat_id', seatIds)
    .eq('is_hidden', false);

  // Get reaction counts per roast
  let reactionCountsByRoast = {};
  if (seatRoasts && seatRoasts.length > 0) {
    const roastIds = seatRoasts.map(r => r.id);
    const { data: reactions } = await supabase
      .from('hot_seat_roast_reactions')
      .select('roast_id, reaction_type')
      .in('roast_id', roastIds)
      .eq('is_active', true);

    if (reactions) {
      for (const r of reactions) {
        if (!reactionCountsByRoast[r.roast_id]) {
          reactionCountsByRoast[r.roast_id] = {};
        }
        reactionCountsByRoast[r.roast_id][r.reaction_type] = 
          (reactionCountsByRoast[r.roast_id][r.reaction_type] || 0) + 1;
      }
    }
  }

  // Aggregate reactions per hot seat
  const reactionsBySeat = {};
  if (seatRoasts) {
    for (const sr of seatRoasts) {
      if (reactionCountsByRoast[sr.id]) {
        if (!reactionsBySeat[sr.hot_seat_id]) {
          reactionsBySeat[sr.hot_seat_id] = {};
        }
        for (const [type, count] of Object.entries(reactionCountsByRoast[sr.id])) {
          reactionsBySeat[sr.hot_seat_id][type] = 
            (reactionsBySeat[sr.hot_seat_id][type] || 0) + count;
        }
      }
    }
  }

  // Score and rank
  const scored = seats
    .filter(isHotSeatEligible)
    .map(seat => {
      const reactionTotals = reactionsBySeat[seat.id] || {};
      const scoreData = scoreHotSeat(seat, reactionTotals, window);
      const label = getTrendingLabel(scoreData, 'hotSeat');
      return {
        ...seat,
        trendingScore: scoreData.score,
        trendingMeta: scoreData,
        trendingLabel: label,
        totalReactions: scoreData.totalReactions || 0,
      };
    })
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);

  return scored;
}

async function fetchTrendingRoasts(window = 'now', limit = 20) {
  if (!isSupabaseConfigured || !supabase) return [];

  const timeConfig = TIME_WINDOWS[window] || TIME_WINDOWS.now;
  const cutoff = timeConfig.hours
    ? new Date(Date.now() - timeConfig.hours * 60 * 60 * 1000).toISOString()
    : null;

  // Fetch hot seat roasts (primary trending content)
  let hsQuery = supabase
    .from('hot_seat_roasts')
    .select('*')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(100);

  if (cutoff) {
    hsQuery = hsQuery.gte('created_at', cutoff);
  }

  const { data: hsRoasts } = await hsQuery;

  // Also fetch classic roasts
  let classicQuery = supabase
    .from('roasts')
    .select('*')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(100);

  if (cutoff) {
    classicQuery = classicQuery.gte('created_at', cutoff);
  }

  const { data: classicRoasts } = await classicQuery;

  // Get reaction counts for hot seat roasts
  let reactionCountsByRoast = {};
  if (hsRoasts && hsRoasts.length > 0) {
    const roastIds = hsRoasts.map(r => r.id);
    const { data: reactions } = await supabase
      .from('hot_seat_roast_reactions')
      .select('roast_id, reaction_type')
      .in('roast_id', roastIds)
      .eq('is_active', true);

    if (reactions) {
      for (const r of reactions) {
        if (!reactionCountsByRoast[r.roast_id]) {
          reactionCountsByRoast[r.roast_id] = {};
        }
        reactionCountsByRoast[r.roast_id][r.reaction_type] = 
          (reactionCountsByRoast[r.roast_id][r.reaction_type] || 0) + 1;
      }
    }
  }

  // Combine and score
  const allRoasts = [];

  if (hsRoasts) {
    for (const roast of hsRoasts) {
      if (!isRoastEligible(roast)) continue;
      const counts = reactionCountsByRoast[roast.id] || {};
      const scoreData = scoreRoast(roast, counts, window);
      allRoasts.push({
        ...roast,
        source: 'hot_seat',
        reactionCounts: counts,
        trendingScore: scoreData.score,
        trendingMeta: scoreData,
        trendingLabel: getTrendingLabel(scoreData, 'roast'),
      });
    }
  }

  if (classicRoasts) {
    for (const roast of classicRoasts) {
      if (!isRoastEligible(roast)) continue;
      const counts = {
        haha: roast.reaction_haha || 0,
        brutal: roast.reaction_brutal || 0,
        cry: roast.reaction_cry || 0,
      };
      const scoreData = scoreRoast(roast, counts, window);
      allRoasts.push({
        ...roast,
        source: 'classic',
        reactionCounts: counts,
        trendingScore: scoreData.score,
        trendingMeta: scoreData,
        trendingLabel: getTrendingLabel(scoreData, 'roast'),
      });
    }
  }

  return allRoasts
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);
}

async function fetchTrendingBattles(window = 'now', limit = 20) {
  if (!isSupabaseConfigured || !supabase) return [];

  const timeConfig = TIME_WINDOWS[window] || TIME_WINDOWS.now;
  const cutoff = timeConfig.hours
    ? new Date(Date.now() - timeConfig.hours * 60 * 60 * 1000).toISOString()
    : null;

  let query = supabase
    .from('battles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (cutoff) {
    query = query.gte('created_at', cutoff);
  }

  const { data: battles } = await query;
  if (!battles || battles.length === 0) return [];

  // Fetch profile data for participants
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
      for (const p of profiles) {
        profilesMap[p.id] = p;
      }
    }
  }

  // Score and rank
  const scored = battles
    .filter(isBattleEligible)
    .map(battle => {
      const scoreData = scoreBattle(battle, window);
      const label = getTrendingLabel(scoreData, 'battle');
      return {
        ...battle,
        profile1: profilesMap[battle.profile1_id] || null,
        profile2: profilesMap[battle.profile2_id] || null,
        trendingScore: scoreData.score,
        trendingMeta: scoreData,
        trendingLabel: label,
        totalVotes: scoreData.totalVotes || 0,
      };
    })
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);

  return scored;
}

// ── Public API ──────────────────────────────────────────────

export {
  TIME_WINDOWS,
  fetchTrendingHotSeats,
  fetchTrendingRoasts,
  fetchTrendingBattles,
  getTrendingLabel,
  engagementScore,
};
