/**
 * BURN BOARD — Trending Module
 *
 * Computes trending content from existing data (roasts, profiles, battles).
 * Uses velocity scoring: how fast content gains engagement in recent windows.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { cacheGet, cacheSet, CACHE_KEYS } from './redisCache';
import type { TrendingItem, TrendingFilters } from '../types';

function getTimeWindowMs(window: TrendingFilters['timeWindow']): number {
  switch (window) {
    case '1h': return 60 * 60 * 1000;
    case '6h': return 6 * 60 * 60 * 1000;
    case '24h': return 24 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

export async function fetchTrending(filters: TrendingFilters): Promise<TrendingItem[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const cacheKey = `trending:${filters.timeWindow}:${filters.category}:${filters.platform || 'all'}`;
  const cached = await cacheGet<TrendingItem[]>(cacheKey);
  if (cached) return cached;

  const since = new Date(Date.now() - getTimeWindowMs(filters.timeWindow)).toISOString();
  const results: TrendingItem[] = [];

  try {
    // Trending profiles (by recent roast count + upvotes)
    if (filters.category === 'all' || filters.category === 'profiles') {
      let profileQuery = supabase
        .from('profiles')
        .select('id, username, platform, roast_count, total_upvotes, created_at')
        .eq('is_banned', false)
        .eq('is_hidden', false)
        .gte('created_at', since)
        .order('roast_count', { ascending: false })
        .limit(10);

      if (filters.platform) {
        profileQuery = profileQuery.eq('platform', filters.platform);
      }

      const { data: profiles } = await profileQuery;
      if (profiles) {
        profiles.forEach((p, i) => {
          results.push({
            type: 'profile',
            id: p.id,
            score: (p.roast_count || 0) * 2 + (p.total_upvotes || 0),
            velocity: p.roast_count || 0,
            title: `@${p.username}`,
            subtitle: `${p.roast_count || 0} roasts • ${p.total_upvotes || 0} upvotes`,
            platform: p.platform,
            created_at: p.created_at,
          });
        });
      }
    }

    // Trending roasts (by upvotes in time window)
    if (filters.category === 'all' || filters.category === 'roasts') {
      const { data: roasts } = await supabase
        .from('roasts')
        .select('id, roast_text, upvotes, reaction_brutal, created_at, profiles!inner(username, platform)')
        .eq('is_hidden', false)
        .gte('created_at', since)
        .order('upvotes', { ascending: false })
        .limit(10);

      if (roasts) {
        roasts.forEach((r: any) => {
          results.push({
            type: 'roast',
            id: r.id,
            score: (r.upvotes || 0) + (r.reaction_brutal || 0) * 2,
            velocity: r.upvotes || 0,
            title: r.roast_text.slice(0, 80),
            subtitle: `by @${r.profiles?.username || 'anon'} • ${r.upvotes || 0} upvotes`,
            platform: r.profiles?.platform,
            created_at: r.created_at,
          });
        });
      }
    }

    // Trending battles
    if (filters.category === 'all' || filters.category === 'battles') {
      const { data: battles } = await supabase
        .from('battles')
        .select('id, votes1, votes2, created_at, p1:profiles!battles_profile1_id_fkey(username, platform), p2:profiles!battles_profile2_id_fkey(username, platform)')
        .eq('is_active', true)
        .gte('created_at', since)
        .order('votes1', { ascending: false })
        .limit(5);

      if (battles) {
        battles.forEach((b: any) => {
          const totalVotes = (b.votes1 || 0) + (b.votes2 || 0);
          results.push({
            type: 'battle',
            id: b.id,
            score: totalVotes,
            velocity: totalVotes,
            title: `@${b.p1?.username || '?'} vs @${b.p2?.username || '?'}`,
            subtitle: `${b.votes1 || 0} vs ${b.votes2 || 0} votes`,
            created_at: b.created_at,
          });
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Cache for 60 seconds
    await cacheSet(cacheKey, results, 60);

    return results;
  } catch (err) {
    console.warn('[Trending] Fetch failed:', err);
    return [];
  }
}

export async function getTrendingCount(filters: TrendingFilters): Promise<number> {
  const items = await fetchTrending(filters);
  return items.length;
}
