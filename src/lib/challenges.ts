/**
 * BURN BOARD — Friend Challenges Module
 *
 * Users can challenge friends to roast battles, most-roasts contests,
 * upvote races, and karma competitions.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { UserChallenge, ChallengeType, ChallengeStatus } from '../types';

export async function createChallenge(params: {
  challengerId: string;
  challengedId: string;
  type: ChallengeType;
  description?: string;
}): Promise<UserChallenge | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  if (params.challengerId === params.challengedId) return null;

  try {
    const { data, error } = await supabase
      .from('user_challenges')
      .insert({
        challenger_id: params.challengerId,
        challenged_id: params.challengedId,
        challenge_type: params.type,
        description: params.description || null,
      })
      .select()
      .single();

    if (error) {
      console.warn('[Challenges] Create failed:', error.message);
      return null;
    }

    return data as UserChallenge;
  } catch {
    return null;
  }
}

export async function respondToChallenge(
  challengeId: string,
  userId: string,
  accept: boolean
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const newStatus: ChallengeStatus = accept ? 'active' : 'declined';
    const { error } = await supabase
      .from('user_challenges')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', challengeId)
      .eq('challenged_id', userId);

    return !error;
  } catch {
    return false;
  }
}

export async function updateChallengeScore(
  challengeId: string,
  userId: string,
  score: number
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    const { data: challenge } = await supabase
      .from('user_challenges')
      .select('challenger_id, challenged_id')
      .eq('id', challengeId)
      .single();

    if (!challenge) return;

    const isChallenger = challenge.challenger_id === userId;
    const updateField = isChallenger ? 'challenger_score' : 'challenged_score';

    await supabase
      .from('user_challenges')
      .update({ [updateField]: score, updated_at: new Date().toISOString() })
      .eq('id', challengeId);
  } catch (err) {
    console.warn('[Challenges] Score update failed:', err);
  }
}

export async function completeChallenge(challengeId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    const { data: challenge } = await supabase
      .from('user_challenges')
      .select('challenger_id, challenged_id, challenger_score, challenged_score')
      .eq('id', challengeId)
      .single();

    if (!challenge) return;

    const winnerId = challenge.challenger_score > challenge.challenged_score
      ? challenge.challenger_id
      : challenge.challenged_score > challenge.challenger_score
        ? challenge.challenged_id
        : null;

    await supabase
      .from('user_challenges')
      .update({
        status: 'completed',
        winner_id: winnerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', challengeId);

    // Award burn score to winner
    if (winnerId) {
      await supabase.rpc('increment_burn_score', {
        p_user_id: winnerId,
        p_score_delta: 25,
        p_challenges_delta: 1,
      });
    }
  } catch (err) {
    console.warn('[Challenges] Completion failed:', err);
  }
}

export async function getUserChallenges(
  userId: string,
  status?: ChallengeStatus
): Promise<UserChallenge[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  try {
    let query = supabase
      .from('user_challenges')
      .select('*')
      .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    // Enrich with usernames
    const userIds = [...new Set(data.flatMap(c => [c.challenger_id, c.challenged_id]))];
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id, username')
      .in('id', userIds);

    const userMap = new Map((users || []).map((u: any) => [u.id, u.username]));

    return data.map((c: any) => ({
      ...c,
      challenger_username: userMap.get(c.challenger_id) || 'Unknown',
      challenged_username: userMap.get(c.challenged_id) || 'Unknown',
    })) as UserChallenge[];
  } catch {
    return [];
  }
}

export async function getActiveChallengesForUser(userId: string): Promise<UserChallenge[]> {
  return getUserChallenges(userId, 'active');
}

export async function getPendingChallengesForUser(userId: string): Promise<UserChallenge[]> {
  return getUserChallenges(userId, 'pending');
}

export async function expireOldChallenges(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    await supabase
      .from('user_challenges')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString());
  } catch {
    // Silent fail — cron job will retry
  }
}

export function getChallengeTypeLabel(type: ChallengeType): string {
  const labels: Record<ChallengeType, string> = {
    roast_battle: '⚔️ Roast Battle',
    most_roasts: '🔥 Most Roasts',
    most_upvotes: '⬆️ Most Upvotes',
    karma_race: '⚡ Karma Race',
  };
  return labels[type] || type;
}

export function getChallengeStatusColor(status: ChallengeStatus): string {
  const colors: Record<ChallengeStatus, string> = {
    pending: '#eab308',
    active: '#22c55e',
    completed: '#3b82f6',
    expired: '#6b7280',
    declined: '#ef4444',
  };
  return colors[status] || '#6b7280';
}
