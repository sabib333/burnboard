/**
 * BURN BOARD — Enhanced Leaderboards Module
 *
 * Multi-category leaderboards with time-range filtering.
 * Categories: burn_score, most_roasted, funniest, streak
 * Time ranges: alltime, weekly, daily, monthly
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { cacheGet, cacheSet } from './redisCache';
import type { LeaderboardCategory, LeaderboardType, LeaderboardEntry } from '../types';

export async function fetchLeaderboard(
  type: LeaderboardType = 'burn_score',
  category: LeaderboardCategory = 'alltime',
  limit: number = 20
): Promise<LeaderboardEntry[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const cacheKey = `leaderboard:${type}:${category}:${limit}`;
  const cached = await cacheGet<LeaderboardEntry[]>(cacheKey);
  if (cached) return cached;

  try {
    let entries: LeaderboardEntry[] = [];

    switch (type) {
      case 'burn_score': {
        const { data } = await supabase
          .from('user_karma')
          .select('user_id, burn_score, total_upvotes_received, total_roasts_given, level, streak')
          .order('burn_score', { ascending: false })
          .limit(limit);

        if (!data) break;

        const userIds = data.map(d => d.user_id).filter(Boolean);
        const { data: users } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds);

        const userMap = new Map((users || []).map((u: any) => [u.id, u]));

        entries = data.map((d, i) => ({
          rank: i + 1,
          user_id: d.user_id,
          username: userMap.get(d.user_id)?.username || 'Unknown',
          display_name: userMap.get(d.user_id)?.display_name,
          burn_score: d.burn_score || 0,
          total_upvotes: d.total_upvotes_received || 0,
          total_roasts: d.total_roasts_given || 0,
          level: d.level as any || 'Newbie',
          streak: d.streak || 0,
          avatar_url: userMap.get(d.user_id)?.avatar_url,
        }));
        break;
      }

      case 'most_roasted': {
        const timeFilter = getTimeFilter(category);
        let query = supabase
          .from('profiles')
          .select('id, username, platform, roast_count, total_upvotes')
          .eq('is_banned', false)
          .order('roast_count', { ascending: false })
          .limit(limit);

        if (timeFilter) {
          query = query.gte('created_at', timeFilter);
        }

        const { data } = await query;
        if (!data) break;

        entries = data.map((d, i) => ({
          rank: i + 1,
          user_id: d.id,
          username: d.username,
          burn_score: (d.roast_count || 0) * 2 + (d.total_upvotes || 0),
          total_upvotes: d.total_upvotes || 0,
          total_roasts: d.roast_count || 0,
          level: 'Newbie' as const,
          streak: 0,
        }));
        break;
      }

      case 'funniest': {
        const timeFilter = getTimeFilter(category);
        let query = supabase
          .from('roasts')
          .select('id, roast_text, upvotes, reaction_haha, anon_id, user_id, created_at')
          .eq('is_hidden', false)
          .order('reaction_haha', { ascending: false })
          .limit(limit);

        if (timeFilter) {
          query = query.gte('created_at', timeFilter);
        }

        const { data } = await query;
        if (!data) break;

        const userIds = [...new Set(data.map(d => d.user_id).filter(Boolean))];
        const { data: users } = await supabase
          .from('user_profiles')
          .select('id, username')
          .in('id', userIds);
        const userMap = new Map((users || []).map((u: any) => [u.id, u.username]));

        entries = data.map((d, i) => ({
          rank: i + 1,
          user_id: d.user_id || d.anon_id,
          username: d.user_id ? (userMap.get(d.user_id) || 'Unknown') : d.anon_id,
          burn_score: d.reaction_haha || 0,
          total_upvotes: d.upvotes || 0,
          total_roasts: 1,
          level: 'Newbie' as const,
          streak: 0,
        }));
        break;
      }

      case 'streak': {
        const { data } = await supabase
          .from('user_karma')
          .select('user_id, streak, total_roasts_given, total_upvotes_received, burn_score, level')
          .gt('streak', 0)
          .order('streak', { ascending: false })
          .limit(limit);

        if (!data) break;

        const userIds = data.map(d => d.user_id).filter(Boolean);
        const { data: users } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds);
        const userMap = new Map((users || []).map((u: any) => [u.id, u]));

        entries = data.map((d, i) => ({
          rank: i + 1,
          user_id: d.user_id,
          username: userMap.get(d.user_id)?.username || 'Unknown',
          display_name: userMap.get(d.user_id)?.display_name,
          burn_score: d.burn_score || 0,
          total_upvotes: d.total_upvotes_received || 0,
          total_roasts: d.total_roasts_given || 0,
          level: d.level as any || 'Newbie',
          streak: d.streak || 0,
          avatar_url: userMap.get(d.user_id)?.avatar_url,
        }));
        break;
      }
    }

    // Cache for appropriate TTL
    const ttl = category === 'daily' ? 60 : category === 'weekly' ? 300 : 600;
    await cacheSet(cacheKey, entries, ttl);

    return entries;
  } catch (err) {
    console.warn('[Leaderboard] Fetch failed:', err);
    return [];
  }
}

function getTimeFilter(category: LeaderboardCategory): string | null {
  const now = new Date();
  switch (category) {
    case 'daily':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    case 'weekly':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case 'monthly':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return null;
  }
}

export async function getUserRank(
  userId: string,
  type: LeaderboardType = 'burn_score',
  category: LeaderboardCategory = 'alltime'
): Promise<number> {
  const entries = await fetchLeaderboard(type, category, 1000);
  const entry = entries.find(e => e.user_id === userId);
  return entry?.rank || entries.length + 1;
}

export function getLeaderboardTypeLabel(type: LeaderboardType): string {
  const labels: Record<LeaderboardType, string> = {
    burn_score: '🔥 Burn Score',
    most_roasted: '🎯 Most Roasted',
    funniest: '😂 Funniest',
    streak: '⚡ Streak',
  };
  return labels[type] || type;
}

export function getCategoryLabel(category: LeaderboardCategory): string {
  const labels: Record<LeaderboardCategory, string> = {
    alltime: 'All Time',
    weekly: 'This Week',
    daily: 'Today',
    monthly: 'This Month',
  };
  return labels[category] || category;
}
