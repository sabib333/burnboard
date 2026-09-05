import { createClient } from '@/lib/supabase/server';

const STREAK_QUALIFYING_EVENTS = [
  'content_created',
  'comment_created',
  'daily_activity_participated',
];

/**
 * Record daily activity and update streak
 */
export async function recordDailyActivity(userId) {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  // Check if already active today
  const { data: existing } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing?.last_active_date === today) {
    return existing;
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  let newStreak = 1;
  let longestStreak = existing?.longest_streak || 0;

  if (existing?.last_active_date === yesterday) {
    // Consecutive day
    newStreak = (existing.current_streak || 0) + 1;
    longestStreak = Math.max(longestStreak, newStreak);
  } else if (existing) {
    // Streak broken
    newStreak = 1;
  }

  const streakData = {
    user_id: userId,
    current_streak: newStreak,
    longest_streak: longestStreak,
    last_active_date: today,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data } = await supabase
      .from('user_streaks')
      .update(streakData)
      .eq('user_id', userId)
      .select()
      .single();
    return data;
  } else {
    const { data } = await supabase
      .from('user_streaks')
      .insert(streakData)
      .select()
      .single();
    return data;
  }
}

/**
 * Get user's current streak info
 */
export async function getUserStreak(userId) {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!data) {
    return {
      current_streak: 0,
      longest_streak: 0,
      is_active_today: false,
      last_active_date: null,
    };
  }

  return {
    ...data,
    is_active_today: data.last_active_date === today,
  };
}

/**
 * Check if a user qualifies for streak based on an event
 */
export function isStreakQualifyingEvent(eventType) {
  return STREAK_QUALIFYING_EVENTS.includes(eventType);
}
