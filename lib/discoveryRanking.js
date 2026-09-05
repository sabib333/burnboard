/**
 * BURN BOARD — Smart Discovery Ranking
 * 
 * Enhanced discovery ranking using multiple signals:
 * - Freshness (recency)
 * - Engagement depth (reactions, votes)
 * - Completion (hot seats with roasts vs empty)
 * - Diversity (category, language)
 * - Safety eligibility (moderation state)
 * 
 * Privacy:
 * - No user profiling
 * - No behavioral tracking
 * - Aggregate signals only
 * - No sensitive trait inference
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ── Ranking Weights ──────────────────────────────────────────
const RANKING_WEIGHTS = {
  freshness: 0.30,
  engagement: 0.35,
  completion: 0.20,
  diversity: 0.15,
};

// ── Freshness Score ──────────────────────────────────────────

/**
 * Calculate freshness score (0-1).
 * More recent = higher score.
 */
function freshnessScore(createdAt) {
  if (!createdAt) return 0;
  
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const hoursSince = (now - created) / (1000 * 60 * 60);
  
  // Exponential decay: score halves every 24 hours
  return Math.pow(0.5, hoursSince / 24);
}

// ── Engagement Score ─────────────────────────────────────────

/**
 * Calculate engagement score (0-1).
 * Based on reactions, votes, and interaction depth.
 */
function engagementScore(data) {
  const { reactionCount = 0, voteCount = 0, roastCount = 0 } = data;
  
  // Weighted engagement
  const weightedEngagement = 
    (reactionCount * 3) +  // Reactions are strong signals
    (voteCount * 2) +       // Votes are moderate signals
    (roastCount * 1);       // Roasts are basic signals
  
  // Normalize: 50 weighted engagements = score of 1.0
  return Math.min(1, weightedEngagement / 50);
}

// ── Completion Score ─────────────────────────────────────────

/**
 * Calculate completion score (0-1).
 * Hot seats with more roasts are more "complete".
 */
function completionScore(roastCount, targetRoasts = 5) {
  return Math.min(1, roastCount / targetRoasts);
}

// ── Diversity Score ──────────────────────────────────────────

/**
 * Calculate diversity bonus.
 * Rewards content from underrepresented categories.
 */
function diversityScore(category, categoryCounts = {}) {
  const count = categoryCounts[category] || 0;
  const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0) || 1;
  
  // Inverse frequency: less common categories get higher diversity score
  const frequency = count / total;
  return 1 - frequency;
}

// ── Main Scoring Function ────────────────────────────────────

/**
 * Calculate smart ranking score for a piece of content.
 * 
 * @param {object} content - Content to score
 * @param {object} context - Ranking context { categoryCounts, window }
 * @returns {object} { score, breakdown }
 */
export function calculateSmartRank(content, context = {}) {
  const { categoryCounts = {} } = context;
  
  const fresh = freshnessScore(content.created_at);
  const engage = engagementScore({
    reactionCount: content.reactionCount || content.totalReactions || 0,
    voteCount: (content.votes1 || 0) + (content.votes2 || 0),
    roastCount: content.roast_count || 0,
  });
  const complete = completionScore(content.roast_count || 0);
  const diverse = diversityScore(content.category, categoryCounts);
  
  const score = (
    RANKING_WEIGHTS.freshness * fresh +
    RANKING_WEIGHTS.engagement * engage +
    RANKING_WEIGHTS.completion * complete +
    RANKING_WEIGHTS.diversity * diverse
  );
  
  return {
    score,
    breakdown: {
      freshness: fresh,
      engagement: engage,
      completion: complete,
      diversity: diverse,
    },
  };
}

// ── Enhanced Discovery Query ─────────────────────────────────

/**
 * Fetch trending content with smart ranking.
 * Safety-aware: excludes moderated content.
 * 
 * @param {string} type - 'hotseats' | 'roasts' | 'battles'
 * @param {string} window - 'now' | 'today' | 'week' | 'alltime'
 * @param {number} limit - Max results
 * @returns {Array} Ranked content
 */
export async function fetchSmartDiscovery(type = 'hotseats', window = 'now', limit = 20) {
  if (!isSupabaseConfigured || !supabase) return [];
  
  // Time window config
  const windows = {
    now: 24,
    today: 168,
    week: 720,
    alltime: null,
  };
  
  const hours = windows[window];
  const cutoff = hours
    ? new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    : null;
  
  let items = [];
  
  if (type === 'hotseats') {
    // Fetch hot seats (safety-aware)
    let query = supabase
      .from('hot_seats')
      .select('*')
      .eq('moderation_state', 'visible')
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (cutoff) {
      query = query.gte('created_at', cutoff);
    }
    
    const { data } = await query;
    items = data || [];
    
    // Calculate category counts for diversity
    const categoryCounts = {};
    for (const item of items) {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    }
    
    // Score and rank
    items = items
      .map(item => ({
        ...item,
        ...calculateSmartRank(item, { categoryCounts }),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  return items;
}

// ── Recommendation Quality Metrics ───────────────────────────

const METRICS_KEY = 'burnboard_discovery_metrics';

/**
 * Track discovery metrics (shown, clicked).
 */
export function trackDiscoveryMetric(event, data = {}) {
  if (typeof window === 'undefined') return;
  
  try {
    const metrics = JSON.parse(localStorage.getItem(METRICS_KEY) || '[]');
    metrics.unshift({
      event,
      data,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(METRICS_KEY, JSON.stringify(metrics.slice(0, 200)));
  } catch {
    // Silent fail
  }
}

/**
 * Get discovery quality metrics.
 */
export function getDiscoveryMetrics() {
  if (typeof window === 'undefined') return { shown: 0, clicked: 0 };
  
  try {
    const metrics = JSON.parse(localStorage.getItem(METRICS_KEY) || '[]');
    const counts = { shown: 0, clicked: 0 };
    
    for (const m of metrics) {
      if (counts[m.event] !== undefined) {
        counts[m.event]++;
      }
    }
    
    return counts;
  } catch {
    return { shown: 0, clicked: 0 };
  }
}
