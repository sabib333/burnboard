/**
 * BURN BOARD — Next-Best-Action Recommendation Engine
 * 
 * Contextual, privacy-conscious recommendations based on:
 * - Current page context
 * - User's activation state
 * - Direct product interaction
 * - Explicit user choices
 * 
 * Privacy:
 * - Uses only current session context
 * - No long-term behavioral profiling
 * - No sensitive trait inference
 * - User retains control (dismissible)
 */

import { getActivationState, isHintDismissed } from '@/lib/onboarding';

// ── Recommendation Types ─────────────────────────────────────
export const RECOMMENDATION_TYPE = {
  CREATE_HOT_SEAT: 'create_hot_seat',
  SUBMIT_ROAST: 'submit_roast',
  VIEW_BURN_REPORT: 'view_burn_report',
  START_BATTLE: 'start_battle',
  SHARE_RESULT: 'share_result',
  EXPLORE_TRENDING: 'explore_trending',
  CHALLENGE_FRIEND: 'challenge_friend',
  VIEW_LEADERBOARD: 'view_leaderboard',
  DISCOVER_MORE: 'discover_more',
};

// ── Context Detection ────────────────────────────────────────

/**
 * Detect current page context from URL/pathname.
 */
export function detectPageContext(pathname) {
  if (!pathname) return { page: 'unknown', section: 'unknown' };
  
  const path = pathname.toLowerCase();
  
  if (path === '/' || path === '') {
    return { page: 'home', section: 'feed' };
  }
  if (path.startsWith('/hot-seat/create') || path === '/hot-seat') {
    return { page: 'hot_seat_create', section: 'creation' };
  }
  if (path.match(/^\/hot-seat\/[^/]+$/)) {
    return { page: 'hot_seat_view', section: 'participation' };
  }
  if (path.match(/^\/hot-seat\/[^/]+\/share/)) {
    return { page: 'hot_seat_share', section: 'sharing' };
  }
  if (path === '/discover') {
    return { page: 'discover', section: 'discovery' };
  }
  if (path === '/battle') {
    return { page: 'battle', section: 'competition' };
  }
  if (path === '/leaderboards') {
    return { page: 'leaderboard', section: 'competition' };
  }
  if (path === '/weekly') {
    return { page: 'weekly', section: 'recap' };
  }
  if (path === '/top') {
    return { page: 'top', section: 'ranking' };
  }
  if (path.startsWith('/challenge/')) {
    return { page: 'challenge', section: 'viral' };
  }
  
  return { page: 'other', section: 'unknown' };
}

// ── Next-Best-Action Engine ──────────────────────────────────

/**
 * Get contextual next-best-action recommendations.
 * Returns prioritized list of recommendations.
 * 
 * @param {object} context - Current context { pathname, userId }
 * @returns {Array} List of recommendation objects
 */
export function getNextBestActions(context = {}) {
  const { pathname } = context;
  const activationState = getActivationState();
  const pageContext = detectPageContext(pathname);
  
  const recommendations = [];
  
  // ── NEW USER PATH ────────────────────────────────────────
  if (activationState === 'new') {
    recommendations.push({
      type: RECOMMENDATION_TYPE.CREATE_HOT_SEAT,
      priority: 1,
      label: 'PUT YOURSELF ON THE HOT SEAT',
      description: 'Let the internet roast you. It\'s fun, we promise.',
      icon: '🔥',
      contextual: true,
    });
  }
  
  // ── EXPLORED BUT NOT PARTICIPATED ────────────────────────
  if (activationState === 'explored') {
    recommendations.push({
      type: RECOMMENDATION_TYPE.CREATE_HOT_SEAT,
      priority: 1,
      label: 'CREATE YOUR FIRST HOT SEAT',
      description: 'Pick a category and let the roasting begin.',
      icon: '🎯',
      contextual: true,
    });
    recommendations.push({
      type: RECOMMENDATION_TYPE.EXPLORE_TRENDING,
      priority: 2,
      label: 'SEE WHAT\'S TRENDING',
      description: 'Check out the hottest roasts right now.',
      icon: '📈',
      contextual: false,
    });
  }
  
  // ── PARTICIPATED (CREATED OR ROASTED) ────────────────────
  if (activationState === 'participated') {
    // If they created a hot seat but haven't shared
    if (!isHintDismissed('share_prompt')) {
      recommendations.push({
        type: RECOMMENDATION_TYPE.SHARE_RESULT,
        priority: 1,
        label: 'SHARE YOUR HOT SEAT',
        description: 'Get more roasts by sharing your link.',
        icon: '📤',
        contextual: pageContext.page === 'hot_seat_view',
      });
    }
    
    // If they roasted but haven't created
    recommendations.push({
      type: RECOMMENDATION_TYPE.CREATE_HOT_SEAT,
      priority: 2,
      label: 'CREATE YOUR OWN HOT SEAT',
      description: 'Now try it from the other side.',
      icon: '🔥',
      contextual: false,
    });
  }
  
  // ── ACTIVATED USERS ──────────────────────────────────────
  if (activationState === 'activated') {
    // Context-dependent recommendations
    if (pageContext.page === 'home') {
      recommendations.push({
        type: RECOMMENDATION_TYPE.EXPLORE_TRENDING,
        priority: 1,
        label: 'DISCOVER TRENDING',
        description: 'See what the internet is roasting today.',
        icon: '📈',
        contextual: true,
      });
      recommendations.push({
        type: RECOMMENDATION_TYPE.START_BATTLE,
        priority: 2,
        label: 'ENTER THE BATTLE ARENA',
        description: 'Vote on the hardest roasts.',
        icon: '⚔️',
        contextual: false,
      });
    }
    
    if (pageContext.page === 'hot_seat_view') {
      recommendations.push({
        type: RECOMMENDATION_TYPE.VIEW_BURN_REPORT,
        priority: 1,
        label: 'VIEW BURN REPORT',
        description: 'See your roast results and burn score.',
        icon: '📊',
        contextual: true,
      });
      recommendations.push({
        type: RECOMMENDATION_TYPE.SHARE_RESULT,
        priority: 2,
        label: 'SHARE YOUR RESULT',
        description: 'Show the world how you survived.',
        icon: '📤',
        contextual: true,
      });
    }
    
    if (pageContext.page === 'discover') {
      recommendations.push({
        type: RECOMMENDATION_TYPE.CHALLENGE_FRIEND,
        priority: 1,
        label: 'CHALLENGE A FRIEND',
        description: 'Dare someone to survive the Hot Seat.',
        icon: '⚔️',
        contextual: false,
      });
    }
    
    if (pageContext.page === 'battle') {
      recommendations.push({
        type: RECOMMENDATION_TYPE.CREATE_HOT_SEAT,
        priority: 1,
        label: 'CREATE YOUR OWN BATTLE',
        description: 'Put two profiles head to head.',
        icon: '🔥',
        contextual: false,
      });
    }
  }
  
  // ── VIRAL READY ──────────────────────────────────────────
  if (activationState === 'viral_ready') {
    recommendations.push({
      type: RECOMMENDATION_TYPE.CHALLENGE_FRIEND,
      priority: 1,
      label: 'CHALLENGE A FRIEND',
      description: 'Dare someone to survive the Hot Seat.',
      icon: '⚔️',
      contextual: pageContext.section === 'sharing',
    });
  }
  
  // ── GLOBAL RECOMMENDATIONS (always available) ────────────
  if (pageContext.page !== 'discover') {
    recommendations.push({
      type: RECOMMENDATION_TYPE.DISCOVER_MORE,
      priority: 10,
      label: 'EXPLORE MORE',
      description: 'See what\'s trending on BURN BOARD.',
      icon: '🌍',
      contextual: false,
    });
  }
  
  // Sort by priority and limit
  return recommendations
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3); // Max 3 recommendations
}

// ── Recommendation Filtering ─────────────────────────────────

/**
 * Filter recommendations based on dismissal state.
 */
export function filterDismissed(recommendations) {
  return recommendations.filter(r => {
    const dismissKey = `dismiss_${r.type}`;
    return !isHintDismissed(dismissKey);
  });
}

// ── Recommendation Tracking ──────────────────────────────────

const STORAGE_KEY = 'burnboard_recommendations';

/**
 * Record a recommendation event (shown, selected, completed, dismissed).
 */
export function trackRecommendation(event, recommendationType, data = {}) {
  if (typeof window === 'undefined') return;
  
  try {
    const events = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    events.unshift({
      event,
      type: recommendationType,
      data,
      timestamp: new Date().toISOString(),
    });
    
    // Keep last 100 events
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, 100)));
  } catch {
    // Silent fail
  }
}

/**
 * Get recommendation analytics (aggregate, no user-level data).
 */
export function getRecommendationAnalytics() {
  if (typeof window === 'undefined') return { shown: 0, selected: 0, completed: 0, dismissed: 0 };
  
  try {
    const events = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    
    const counts = { shown: 0, selected: 0, completed: 0, dismissed: 0 };
    for (const evt of events) {
      if (counts[evt.event] !== undefined) {
        counts[evt.event]++;
      }
    }
    
    return counts;
  } catch {
    return { shown: 0, selected: 0, completed: 0, dismissed: 0 };
  }
}
