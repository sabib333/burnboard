import { createClient } from '@/lib/supabase/server';

/**
 * Get leaderboard rankings
 */
export async function getLeaderboard({
  period = 'all_time',
  limit = 20,
  offset = 0,
} = {}) {
  const supabase = await createClient();

  let query = supabase
    .from('user_profiles')
    .select(`
      user_id,
      username,
      display_name,
      avatar_url,
      reputation,
      level,
      follower_count,
      created_at
    `)
    .gt('reputation', 0)
    .order('reputation', { ascending: false })
    .range(offset, offset + limit - 1);

  if (period === 'weekly') {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    query = supabase
      .from('reputation_events')
      .select(`
        user_id,
        sum(value) as period_rep,
        user_profiles!inner (
          username,
          display_name,
          avatar_url,
          level
        )
      `)
      .gte('created_at', weekAgo)
      .group('user_id')
      .order('period_rep', { ascending: false })
      .range(offset, offset + limit - 1);
  } else if (period === 'monthly') {
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    query = supabase
      .from('reputation_events')
      .select(`
        user_id,
        sum(value) as period_rep,
        user_profiles!inner (
          username,
          display_name,
          avatar_url,
          level
        )
      `)
      .gte('created_at', monthAgo)
      .group('user_id')
      .order('period_rep', { ascending: false })
      .range(offset, offset + limit - 1);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((entry, index) => ({
    rank: offset + index + 1,
    user_id: entry.user_id,
    username: entry.user_profiles?.username || entry.username,
    display_name: entry.user_profiles?.display_name || entry.display_name,
    avatar_url: entry.user_profiles?.avatar_url || entry.avatar_url,
    reputation: entry.period_rep || entry.reputation,
    level: entry.user_profiles?.level || entry.level,
  }));
}
