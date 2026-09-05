/**
 * BURN BOARD — Onboarding & Activation Service
 * 
 * Tracks first-time user state using localStorage (anonymous) 
 * or Supabase user_profiles (authenticated).
 * 
 * Activation Model:
 *   NEW → EXPLORED → PARTICIPATED → ACTIVATED → VIRAL READY
 * 
 * Privacy: No invasive tracking. Minimal state. User-controlled.
 */

// ── Onboarding State Keys ────────────────────────────────────
const STORAGE_KEY = 'burnboard_onboarding';

const DEFAULT_STATE = {
  // First-visit tracking
  hero_seen: false,
  first_visit_at: null,
  
  // Creator activation
  first_hot_seat_created: false,
  first_hot_seat_id: null,
  first_roast_received: false,
  
  // Participant activation
  first_roast_submitted: false,
  first_roast_submitted_at: null,
  
  // Social activation
  first_share_opened: false,
  first_challenge_created: false,
  
  // Burn Report
  first_burn_report_viewed: false,
  
  // Activation completion
  activation_completed: false,
  viral_ready: false,
  
  // Dismissed hints (array of hint IDs)
  dismissed_hints: [],
};

// ── State Persistence ────────────────────────────────────────

function getState() {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE };
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_STATE, ...parsed };
    }
  } catch {
    // Corrupted state, reset
  }
  
  return { ...DEFAULT_STATE };
}

function setState(partial) {
  if (typeof window === 'undefined') return;
  
  try {
    const current = getState();
    const updated = { ...current, ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silent fail
  }
}

function resetState() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silent fail
  }
}

// ── First Visit Detection ────────────────────────────────────

export function isFirstVisit() {
  const state = getState();
  return !state.first_visit_at;
}

export function markFirstVisit() {
  const state = getState();
  if (!state.first_visit_at) {
    setState({ first_visit_at: new Date().toISOString() });
  }
}

// ── Hero Banner ──────────────────────────────────────────────

export function hasSeenHero() {
  return getState().hero_seen;
}

export function markHeroSeen() {
  setState({ hero_seen: true });
}

// ── Creator Activation ───────────────────────────────────────

export function hasCreatedFirstHotSeat() {
  return getState().first_hot_seat_created;
}

export function markFirstHotSeatCreated(hotSeatId) {
  setState({
    first_hot_seat_created: true,
    first_hot_seat_id: hotSeatId,
  });
  checkActivation();
}

export function hasReceivedFirstRoast() {
  return getState().first_roast_received;
}

export function markFirstRoastReceived() {
  setState({ first_roast_received: true });
  checkActivation();
}

// ── Participant Activation ───────────────────────────────────

export function hasSubmittedFirstRoast() {
  return getState().first_roast_submitted;
}

export function markFirstRoastSubmitted() {
  setState({
    first_roast_submitted: true,
    first_roast_submitted_at: new Date().toISOString(),
  });
  checkActivation();
}

// ── Social Activation ────────────────────────────────────────

export function hasOpenedFirstShare() {
  return getState().first_share_opened;
}

export function markFirstShareOpened() {
  setState({ first_share_opened: true });
  checkViralReady();
}

export function hasCreatedFirstChallenge() {
  return getState().first_challenge_created;
}

export function markFirstChallengeCreated() {
  setState({ first_challenge_created: true });
  checkViralReady();
}

// ── Burn Report ──────────────────────────────────────────────

export function hasViewedFirstBurnReport() {
  return getState().first_burn_report_viewed;
}

export function markFirstBurnReportViewed() {
  setState({ first_burn_report_viewed: true });
}

// ── Activation Logic ─────────────────────────────────────────

export function getActivationState() {
  const state = getState();
  
  if (state.activation_completed) return 'activated';
  if (state.viral_ready) return 'viral_ready';
  
  // ACTIVATED: Created or participated meaningfully
  if (state.first_hot_seat_created && state.first_roast_received) return 'activated';
  if (state.first_roast_submitted) return 'activated';
  
  // PARTICIPATED: Took some action
  if (state.first_hot_seat_created || state.first_roast_submitted) return 'participated';
  
  // EXPLORED: Has seen the hero
  if (state.hero_seen) return 'explored';
  
  return 'new';
}

function checkActivation() {
  const state = getState();
  const current = getActivationState();
  
  if (current === 'activated' && !state.activation_completed) {
    setState({ activation_completed: true });
  }
}

function checkViralReady() {
  const state = getState();
  
  if (state.first_share_opened || state.first_challenge_created) {
    setState({ viral_ready: true });
    checkActivation();
  }
}

// ── Hint Management ──────────────────────────────────────────

export function isHintDismissed(hintId) {
  const state = getState();
  return (state.dismissed_hints || []).includes(hintId);
}

export function dismissHint(hintId) {
  const state = getState();
  const dismissed = state.dismissed_hints || [];
  if (!dismissed.includes(hintId)) {
    setState({ dismissed_hints: [...dismissed, hintId] });
  }
}

// ── Analytics Events ─────────────────────────────────────────

export function trackActivationEvent(eventName, data = {}) {
  try {
    // Reuse existing analytics
    if (typeof window !== 'undefined') {
      const event = {
        event: `onboarding_${eventName}`,
        data: {
          ...data,
          activation_state: getActivationState(),
          timestamp: new Date().toISOString(),
        },
      };
      
      // Log for debugging
      console.log(`[BURNBOARD Activation] 🔥 ${eventName}`, data);
      
      // Store in localStorage for consistency with existing analytics
      const STORAGE_KEY = 'burnboard_analytics_events';
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      existing.unshift({ ...event, timestamp: new Date().toISOString() });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, 200)));
    }
  } catch {
    // Silent fail
  }
}

// ── Reset (for testing) ──────────────────────────────────────

export { resetState };

// ── Get Full State (for debugging) ───────────────────────────

export function getFullState() {
  return getState();
}
