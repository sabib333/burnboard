/**
 * BURNBOARD Karma — 100% REAL DATA
 *
 * NO fake karma. NO fake levels. NO fake streaks.
 * All from real Supabase counts.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { KarmaLevel, DailyChallenge } from '../types';

// ── Level Thresholds (pure math, no DB needed) ──────────────
export function getLevel(totalUpvotes: number): {
  level: KarmaLevel;
  badge: string;
  color: string;
  nextLevelAt: number | null;
  progress: number;
} {
  if (totalUpvotes >= 200) {
    return { level: 'Savage', badge: '🔥🔥🔥', color: '#ff4500', nextLevelAt: null, progress: 100 };
  }
  if (totalUpvotes >= 50) {
    return { level: 'Brutal', badge: '💀', color: '#ff0000', nextLevelAt: 200, progress: Math.min(100, Math.round(((totalUpvotes - 50) / 150) * 100)) };
  }
  if (totalUpvotes >= 10) {
    return { level: 'Roaster', badge: '😈', color: '#ffa500', nextLevelAt: 50, progress: Math.min(100, Math.round(((totalUpvotes - 10) / 40) * 100)) };
  }
  return { level: 'Newbie', badge: '🐣', color: '#888', nextLevelAt: 10, progress: Math.min(100, Math.round((totalUpvotes / 10) * 100)) };
}

// ── KarmaBar progress helper ────────────────────────────────
export function calculateKarmaLevel(upvotes: number) {
  const { level, badge, nextLevelAt, progress } = getLevel(upvotes);
  return { level, badge: `${level} ${badge}`, nextLevelAt: nextLevelAt ?? 500, progress };
}

// ── Fetch real karma from Supabase ──────────────────────────
export async function fetchUserKarma(userId: string): Promise<{
  total_upvotes_received: number;
  total_roasts_given: number;
  level: KarmaLevel;
  badge: string;
  streak: number;
} | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data } = await supabase
      .from('user_karma')
      .select('total_upvotes_received, total_roasts_given, level, streak')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) return null;

    const { level, badge } = getLevel(data.total_upvotes_received || 0);
    return {
      total_upvotes_received: data.total_upvotes_received || 0,
      total_roasts_given: data.total_roasts_given || 0,
      level,
      badge,
      streak: data.streak || 0,
    };
  } catch {
    return null;
  }
}

// ── Fetch karma for anonymous roaster by anon_id ────────────
export async function fetchAnonKarma(anonId: string): Promise<{
  total_upvotes_received: number;
  total_roasts_given: number;
  level: KarmaLevel;
  badge: string;
  streak: number;
} | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data } = await supabase
      .from('user_karma')
      .select('total_upvotes_received, total_roasts_given, level, streak')
      .eq('anon_id', anonId)
      .maybeSingle();

    if (!data) return null;

    const { level, badge } = getLevel(data.total_upvotes_received || 0);
    return {
      total_upvotes_received: data.total_upvotes_received || 0,
      total_roasts_given: data.total_roasts_given || 0,
      level,
      badge,
      streak: data.streak || 0,
    };
  } catch {
    return null;
  }
}

// ── Upsert karma after roast submission ─────────────────────
export async function recordRoastGiven(userId: string | null, anonId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    if (userId) {
      // Logged-in user: upsert + increment
      const { data: existing } = await supabase
        .from('user_karma')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        await supabase.rpc('increment_karma', {
          p_user_id: userId,
          p_upvotes_delta: 0,
          p_roasts_delta: 1,
        });
      } else {
        await supabase.from('user_karma').insert({
          user_id: userId,
          anon_id: anonId,
          total_roasts_given: 1,
          total_upvotes_received: 0,
          level: 'Newbie',
          streak: 1,
          last_roast_date: new Date().toISOString().split('T')[0],
        });
      }

      // Update streak
      await supabase.rpc('update_streak', { p_user_id: userId });
    } else {
      // Anonymous: upsert by anon_id
      const { data: existing } = await supabase
        .from('user_karma')
        .select('id')
        .eq('anon_id', anonId)
        .maybeSingle();

      if (existing) {
        await supabase.from('user_karma').update({
          total_roasts_given: (existing as any).total_roasts_given + 1,
        }).eq('anon_id', anonId);
      } else {
        await supabase.from('user_karma').insert({
          anon_id: anonId,
          total_roasts_given: 1,
          total_upvotes_received: 0,
          level: 'Newbie',
        });
      }
    }
  } catch (err) {
    console.warn('[Karma] recordRoastGiven failed:', err);
  }
}

// ── Increment upvotes received on a roast ───────────────────
export async function recordUpvoteReceived(roastOwnerId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    await supabase.rpc('increment_karma', {
      p_user_id: roastOwnerId,
      p_upvotes_delta: 1,
      p_roasts_delta: 0,
    });

    // Recalculate level
    const { data: karma } = await supabase
      .from('user_karma')
      .select('total_upvotes_received')
      .eq('user_id', roastOwnerId)
      .maybeSingle();

    if (karma) {
      const { level } = getLevel(karma.total_upvotes_received || 0);
      await supabase
        .from('user_karma')
        .update({ level })
        .eq('user_id', roastOwnerId);
    }
  } catch (err) {
    console.warn('[Karma] recordUpvoteReceived failed:', err);
  }
}

// ── Fetch real challenges from Supabase ─────────────────────
export async function fetchDailyChallenges(): Promise<DailyChallenge[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  try {
    const { data } = await supabase
      .from('challenges')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(3);

    if (!data || data.length === 0) return [];

    return data.map((ch: any) => ({
      id: ch.id,
      title: ch.title,
      description: ch.description,
      reward: `+${ch.reward_karma} Karma`,
      targetCount: ch.target_count,
      currentCount: 0, // Will be filled by progress fetch
      completed: false,
      type: ch.type === 'linkedin' ? 'roast' : ch.type,
    }));
  } catch {
    return [];
  }
}

// ── Fetch real challenge progress for current user ──────────
export async function fetchChallengeProgress(
  userId: string | null,
  anonId: string | null
): Promise<Record<string, number>> {
  if (!isSupabaseConfigured || !supabase) return {};
  if (!userId && !anonId) return {};

  try {
    const today = new Date().toISOString().split('T')[0];
    const progress: Record<string, number> = {};

    // Count roasts given today
    let roastQuery = supabase
      .from('roasts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today);

    if (userId) {
      roastQuery = roastQuery.eq('user_id', userId);
    } else if (anonId) {
      roastQuery = roastQuery.eq('anon_id', anonId);
    }

    const { count: roastCount } = await roastQuery;
    progress['roast'] = roastCount || 0;
    progress['linkedin'] = roastCount || 0; // Same for now — all roasts count

    // Count upvotes received today
    let upvoteCount = 0;
    if (userId) {
      const { data: todayRoasts } = await supabase
        .from('roasts')
        .select('upvotes')
        .eq('user_id', userId)
        .gte('created_at', today);

      if (todayRoasts) {
        upvoteCount = todayRoasts.reduce((sum: number, r: any) => sum + (r.upvotes || 0), 0);
      }
    }
    progress['upvote'] = upvoteCount;

    return progress;
  } catch {
    return {};
  }
}

// ── Legacy compat: getDailyChallenges (used by SidebarRight) ─
export function getDailyChallenges(): DailyChallenge[] {
  // Return empty — SidebarRight will fetch real data via SWR
  return [];
}
