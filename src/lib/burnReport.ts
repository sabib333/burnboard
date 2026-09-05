/**
 * BURN BOARD — Burn Report Module
 *
 * Generates shareable summary cards of a user's roasting experience.
 * Like Spotify Wrapped but for getting roasted.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { calculateBurnScoreBreakdown, getLevelFromScore } from './burnScore';
import type { BurnReport, LeaderboardCategory } from '../types';

export async function generateBurnReport(
  userId: string,
  period: 'week' | 'month' | 'alltime' = 'alltime'
): Promise<BurnReport | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    // Get user profile
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id, username')
      .eq('id', userId)
      .maybeSingle();

    if (!userProfile) return null;

    // Time filter
    let timeFilter: string | null = null;
    if (period === 'week') {
      timeFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (period === 'month') {
      timeFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Get roasts given by user
    let roastQuery = supabase
      .from('roasts')
      .select('id, roast_text, upvotes, reaction_haha, reaction_brutal, reaction_cry, created_at')
      .eq('user_id', userId)
      .order('upvotes', { ascending: false });

    if (timeFilter) {
      roastQuery = roastQuery.gte('created_at', timeFilter);
    }

    const { data: roasts } = await roastQuery;
    const totalRoastsGiven = roasts?.length || 0;
    const totalUpvotesReceived = roasts?.reduce((sum, r) => sum + (r.upvotes || 0), 0) || 0;
    const totalReactionsReceived = roasts?.reduce((sum, r) =>
      sum + (r.reaction_haha || 0) + (r.reaction_brutal || 0) + (r.reaction_cry || 0), 0) || 0;

    // Get top roast
    const topRoast = roasts && roasts.length > 0 ? roasts[0] : null;

    // Get karma data
    const { data: karma } = await supabase
      .from('user_karma')
      .select('burn_score, level, streak')
      .eq('user_id', userId)
      .maybeSingle();

    const burnScore = karma?.burn_score || 0;
    const level = (karma?.level as any) || 'Newbie';

    // Calculate rank (simplified — just count users with higher score)
    const { count: rank } = await supabase
      .from('user_karma')
      .select('id', { count: 'exact', head: true })
      .gt('burn_score', burnScore);

    return {
      user_id: userId,
      username: userProfile.username,
      period,
      total_roasts_given: totalRoastsGiven,
      total_upvotes_received: totalUpvotesReceived,
      total_reactions_received: totalReactionsReceived,
      top_roast: topRoast ? { text: topRoast.roast_text, upvotes: topRoast.upvotes || 0 } : null,
      burn_score: burnScore,
      level,
      rank: (rank || 0) + 1,
      generated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[BurnReport] Generation failed:', err);
    return null;
  }
}

export function getPeriodLabel(period: string): string {
  switch (period) {
    case 'week': return 'This Week';
    case 'month': return 'This Month';
    case 'alltime': return 'All Time';
    default: return period;
  }
}

export function getLevelEmoji(level: string): string {
  switch (level) {
    case 'Savage': return '🔥🔥🔥';
    case 'Brutal': return '💀';
    case 'Roaster': return '😈';
    case 'Newbie': return '🐣';
    default: return '🐣';
  }
}

export function getReportShareText(report: BurnReport): string {
  const topRoast = report.top_roast
    ? `\n\n🏆 My best roast: "${report.top_roast.text}" (${report.top_roast.upvotes} upvotes)`
    : '';

  return `🔥 My BURN BOARD ${getPeriodLabel(report.period)} Report\n\n` +
    `📊 Burn Score: ${report.burn_score}\n` +
    `🎯 Level: ${report.level} ${getLevelEmoji(report.level)}\n` +
    `📝 Roasts given: ${report.total_roasts_given}\n` +
    `⬆️ Upvotes received: ${report.total_upvotes_received}\n` +
    `😂 Reactions: ${report.total_reactions_received}\n` +
    `🏆 Rank: #${report.rank}` +
    topRoast +
    `\n\n#BURNBOARD #NoAI #JustHumans`;
}
