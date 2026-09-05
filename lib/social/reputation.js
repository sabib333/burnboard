import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Social Reputation Service
 * 
 * Event-based reputation scoring for BurnBoard users.
 * Karma is derived from community engagement (no fake metrics).
 */

// ── Scoring Weights ─────────────────────────────────────────

const SCORE_WEIGHTS = {
  // Content creation
  roast_received_upvote: 1,
  roast_written_upvote: 2,
  
  // Reactions
  reaction_received_funny: 2,
  reaction_received_savage: 3,
  reaction_received_fatal: 5,
  
  // Social
  follow_received: 3,
  
  // Battles & Challenges
  battle_voted_for: 1,
  battle_won: 10,
  challenge_completed: 5,
  
  // Engagement
  comment_received_upvote: 2,
};

/**
 * Calculate reputation score from karma value
 */
export function calculateReputationLevel(karma) {
  if (karma >= 1000) return { level: 'Legend', emoji: '👑', color: 'text-amber-400' };
  if (karma >= 500) return { level: 'Veteran', emoji: '🔥', color: 'text-[#ff4d00]' };
  if (karma >= 200) return { level: 'Rising Star', emoji: '⭐', color: 'text-yellow-400' };
  if (karma >= 50) return { level: 'Active', emoji: '💨', color: 'text-blue-400' };
  if (karma >= 10) return { level: 'Newcomer', emoji: '🌱', color: 'text-green-400' };
  return { level: 'Newbie', emoji: '🐣', color: 'text-zinc-400' };
}

/**
 * Get a user's karma score
 */
export async function getUserKarma(userId) {
  if (!isSupabaseConfigured || !supabase) return 0;

  const { data } = await supabase
    .from('user_profiles')
    .select('karma')
    .eq('id', userId)
    .single();

  return data?.karma || 0;
}

/**
 * Add karma to a user
 */
export async function addKarma(userId, points) {
  if (!isSupabaseConfigured || !supabase) return { error: 'Not configured' };
  if (!points || points <= 0) return { error: 'Invalid points' };

  // Get current karma
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('karma')
    .eq('id', userId)
    .single();

  if (!profile) return { error: 'User not found' };

  const newKarma = (profile.karma || 0) + points;

  const { data, error } = await supabase
    .from('user_profiles')
    .update({ karma: newKarma })
    .eq('id', userId)
    .select('karma')
    .single();

  if (error) return { error: error.message };
  return { karma: data.karma, level: calculateReputationLevel(data.karma) };
}

/**
 * Process a reputation event
 */
export async function processReputationEvent(userId, eventType, metadata = {}) {
  const points = SCORE_WEIGHTS[eventType] || 0;
  if (points === 0) return { points: 0 };

  return addKarma(userId, points);
}

/**
 * Get leaderboard by karma
 */
export async function getKarmaLeaderboard({ limit = 50 } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, username, display_name, avatar_url, karma')
    .order('karma', { ascending: false })
    .limit(limit);

  if (error) return [];

  return (data || []).map((user, index) => ({
    ...user,
    rank: index + 1,
    level: calculateReputationLevel(user.karma),
  }));
}
