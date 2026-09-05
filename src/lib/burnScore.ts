/**
 * BURN BOARD — Burn Score System
 *
 * A gamified score based on participation and community reactions.
 * Formula: roasts*2 + upvotes*3 + reactions*1 + streak_bonus + battles*5 + challenges*10
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { BurnScoreData, BurnScoreBreakdown, KarmaLevel } from '../types';

export function calculateBurnScoreBreakdown(data: {
  total_roasts: number;
  total_upvotes: number;
  total_reactions: number;
  streak: number;
  battles_won: number;
  challenges_completed: number;
}): BurnScoreBreakdown {
  const roasts_score = data.total_roasts * 2;
  const upvotes_score = data.total_upvotes * 3;
  const reactions_score = data.total_reactions * 1;
  const streak_bonus = Math.min(data.streak * 5, 100); // cap at 100
  const battles_bonus = data.battles_won * 5;
  const challenges_bonus = data.challenges_completed * 10;
  const total = roasts_score + upvotes_score + reactions_score + streak_bonus + battles_bonus + challenges_bonus;

  return {
    roasts_score,
    upvotes_score,
    reactions_score,
    streak_bonus,
    battles_bonus,
    challenges_bonus,
    total,
  };
}

export function getLevelFromScore(score: number): { level: KarmaLevel; badge: string; color: string; nextLevelAt: number | null; progress: number } {
  if (score >= 500) return { level: 'Savage', badge: '🔥🔥🔥', color: '#ff4500', nextLevelAt: null, progress: 100 };
  if (score >= 150) return { level: 'Brutal', badge: '💀', color: '#ff0000', nextLevelAt: 500, progress: Math.min(100, Math.round(((score - 150) / 350) * 100)) };
  if (score >= 30) return { level: 'Roaster', badge: '😈', color: '#ffa500', nextLevelAt: 150, progress: Math.min(100, Math.round(((score - 30) / 120) * 100)) };
  return { level: 'Newbie', badge: '🐣', color: '#888', nextLevelAt: 30, progress: Math.min(100, Math.round((score / 30) * 100)) };
}

export async function fetchBurnScore(userId: string): Promise<BurnScoreData | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data } = await supabase
      .from('user_karma')
      .select('user_id, total_roasts_given, total_upvotes_received, total_reactions_received, total_battles_won, total_challenges_completed, burn_score, level, streak')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) return null;

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle();

    const breakdown = calculateBurnScoreBreakdown({
      total_roasts: data.total_roasts_given || 0,
      total_upvotes: data.total_upvotes_received || 0,
      total_reactions: data.total_reactions_received || 0,
      streak: data.streak || 0,
      battles_won: data.total_battles_won || 0,
      challenges_completed: data.total_challenges_completed || 0,
    });

    return {
      user_id: userId,
      username: userProfile?.username || 'Unknown',
      burn_score: breakdown.total,
      level: (data.level as KarmaLevel) || 'Newbie',
      total_roasts: data.total_roasts_given || 0,
      total_upvotes: data.total_upvotes_received || 0,
      total_reactions: data.total_reactions_received || 0,
      streak: data.streak || 0,
    };
  } catch {
    return null;
  }
}

export async function recalculateAndStoreBurnScore(userId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    const score = await fetchBurnScore(userId);
    if (!score) return;

    const { level } = getLevelFromScore(score.burn_score);

    await supabase
      .from('user_karma')
      .update({ burn_score: score.burn_score, level })
      .eq('user_id', userId);
  } catch (err) {
    console.warn('[BurnScore] Recalculation failed:', err);
  }
}
