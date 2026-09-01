import { supabase, isSupabaseConfigured } from './supabase';
import { notificationQueue } from './notificationQueue';

export type NotificationType = 'roast' | 'follow' | 'upvote' | 'battle' | 'levelup' | 'dm';

export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface DmThread {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message: string | null;
  updated_at: string;
  other_user?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    last_active: string | null;
  };
}

export interface DmMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  message: string;
  is_roast: boolean;
  created_at: string;
}

/**
 * Create a notification for a user — uses batch queue at 1M scale
 * Notifications are accumulated and flushed in batches of 100
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string,
  options?: { priority?: number; dedupKey?: string }
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  // Use batch queue for all notifications at 1M scale
  notificationQueue.enqueue({
    user_id: userId,
    type,
    title,
    message,
    link,
    priority: options?.priority || 0,
    dedup_key: options?.dedupKey,
  });
}

/**
 * Notify when someone roasts a profile — batched
 */
export async function notifyRoastOnProfile(
  profileOwnerId: string,
  roasterUsername: string,
  roastText: string,
  profileId: string
): Promise<void> {
  notificationQueue.enqueueRoast(profileOwnerId, roasterUsername, roastText, profileId);
}

/**
 * Notify when someone upvotes a roast (every 10 upvotes) — batched with dedup
 */
export async function notifyUpvoteMilestone(
  roastOwnerId: string,
  upvoteCount: number,
  profileId: string
): Promise<void> {
  notificationQueue.enqueueUpvote(roastOwnerId, upvoteCount, profileId);
}

/**
 * Notify when someone follows — batched
 */
export async function notifyFollow(
  followedUserId: string,
  followerUsername: string
): Promise<void> {
  notificationQueue.enqueueFollow(followedUserId, followerUsername);
}

/**
 * Notify on level up — batched
 */
export async function notifyLevelUp(
  userId: string,
  newLevel: string
): Promise<void> {
  notificationQueue.enqueueLevelUp(userId, newLevel);
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured || !supabase) return 0;

  try {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * Get recent notifications for a user
 */
export async function getNotifications(userId: string, limit = 20): Promise<NotificationItem[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  try {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data as NotificationItem[]) || [];
  } catch {
    return [];
  }
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
  } catch {}
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(userId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
  } catch {}
}

// ==================== DM SYSTEM ====================

/**
 * Get or create DM thread between two users
 */
export async function getOrCreateDmThread(userId1: string, userId2: string): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    // Ensure consistent ordering
    const [a, b] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];

    // Check existing thread
    const { data: existing } = await supabase
      .from('dm_threads')
      .select('id')
      .eq('user1_id', a)
      .eq('user2_id', b)
      .single();

    if (existing) return existing.id;

    // Create new thread
    const { data: newThread } = await supabase
      .from('dm_threads')
      .insert({ user1_id: a, user2_id: b })
      .select('id')
      .single();

    return newThread?.id || null;
  } catch {
    return null;
  }
}

/**
 * Get DM threads for current user — limit 20 with cursor pagination for 1M scale
 */
export async function getDmThreads(
  userId: string,
  limit = 20,
  cursor?: string
): Promise<{ threads: DmThread[]; nextCursor: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { threads: [], nextCursor: null };

  try {
    let query = supabase
      .from('dm_threads')
      .select('*')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('updated_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('updated_at', cursor);
    }

    const { data: threads } = await query;

    if (!threads || threads.length === 0) return { threads: [], nextCursor: null };

    const hasMore = threads.length > limit;
    const rows = hasMore ? threads.slice(0, limit) : threads;
    const nextCursor = hasMore && rows.length > 0 ? (rows[rows.length - 1] as any).updated_at : null;

    // Batch fetch all other user profiles in one query (not N queries!)
    const otherIds = [...new Set(rows.map((t: DmThread) =>
      t.user1_id === userId ? t.user2_id : t.user1_id
    ))];

    const { data: otherUsers } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, last_active')
      .in('id', otherIds);

    const userMap = new Map((otherUsers || []).map((u: any) => [u.id, u]));

    const enriched = rows.map((thread: DmThread) => {
      const otherId = thread.user1_id === userId ? thread.user2_id : thread.user1_id;
      return { ...thread, other_user: userMap.get(otherId) || undefined };
    });

    return { threads: enriched, nextCursor };
  } catch {
    return { threads: [], nextCursor: null };
  }
}

/**
 * Get messages for a DM thread — cursor pagination for 1M messages
 * Fetches last N messages, load more on scroll up
 */
export async function getDmMessages(
  threadId: string,
  limit = 30,
  cursor?: string
): Promise<{ messages: DmMessage[]; nextCursor: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { messages: [], nextCursor: null };

  try {
    let query = supabase
      .from('dm_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    // Cursor pagination for loading older messages
    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data } = await query;
    if (!data) return { messages: [], nextCursor: null };

    const hasMore = data.length > limit;
    const rows = hasMore ? data.slice(0, limit) : data;
    // Reverse so oldest first (for display), but return cursor for oldest
    const messages = [...rows].reverse();
    const nextCursor = hasMore && rows.length > 0 ? (rows[rows.length - 1] as any).created_at : null;

    return { messages, nextCursor };
  } catch {
    return { messages: [], nextCursor: null };
  }
}

/**
 * Send a DM message
 */
export async function sendDmMessage(
  threadId: string,
  senderId: string,
  message: string,
  isRoast = true
): Promise<DmMessage | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data: newMsg } = await supabase
      .from('dm_messages')
      .insert({
        thread_id: threadId,
        sender_id: senderId,
        message: message.trim(),
        is_roast: isRoast,
      })
      .select()
      .single();

    if (newMsg) {
      // Update thread last_message and timestamp
      await supabase
        .from('dm_threads')
        .update({
          last_message: message.trim().slice(0, 100),
          updated_at: new Date().toISOString(),
        })
        .eq('id', threadId);

      // Notify the other user
      const { data: thread } = await supabase
        .from('dm_threads')
        .select('user1_id, user2_id')
        .eq('id', threadId)
        .single();

      if (thread) {
        const otherUserId = thread.user1_id === senderId ? thread.user2_id : thread.user1_id;
        const { data: sender } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('id', senderId)
          .single();

        notificationQueue.enqueueDm(otherUserId, sender?.username || 'Someone');
      }
    }

    return newMsg;
  } catch {
    return null;
  }
}

/**
 * Get notifications with cursor pagination for 1M scale
 */
export interface NotificationFilters {
  type?: NotificationType;
  dateFrom?: string; // ISO date string
  dateTo?: string;   // ISO date string
}

export async function getNotificationsPaginated(
  userId: string,
  limit = 20,
  cursor?: string,
  filters?: NotificationFilters
): Promise<{ notifications: NotificationItem[]; nextCursor: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { notifications: [], nextCursor: null };

  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    // Apply type filter
    if (filters?.type) {
      query = query.eq('type', filters.type);
    }

    // Apply date range filters
    if (filters?.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }
    if (filters?.dateTo) {
      // Add 1 day to make it inclusive of the end date
      const toDate = new Date(filters.dateTo);
      toDate.setDate(toDate.getDate() + 1);
      query = query.lt('created_at', toDate.toISOString());
    }

    const { data } = await query;
    if (!data) return { notifications: [], nextCursor: null };

    const hasMore = data.length > limit;
    const rows = hasMore ? data.slice(0, limit) : data;
    const nextCursor = hasMore && rows.length > 0 ? (rows[rows.length - 1] as any).created_at : null;

    return { notifications: rows as NotificationItem[], nextCursor };
  } catch {
    return { notifications: [], nextCursor: null };
  }
}

/**
 * Get notification counts by type for a user (for filter badges)
 */
export async function getNotificationCounts(
  userId: string
): Promise<Record<string, number>> {
  if (!isSupabaseConfigured || !supabase) return {};

  try {
    const { data } = await supabase
      .from('notifications')
      .select('type')
      .eq('user_id', userId);

    if (!data) return {};

    const counts: Record<string, number> = {};
    for (const row of data) {
      counts[row.type] = (counts[row.type] || 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

/**
 * Search users for DM creation — uses trigram index for fast search at 1M
 */
export async function searchUsers(query: string, excludeUserId?: string): Promise<Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null }>> {
  if (!isSupabaseConfigured || !supabase || !query.trim()) return [];

  try {
    let q = supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url')
      .ilike('username', `%${query.trim()}%`)
      .limit(5);

    if (excludeUserId) {
      q = q.neq('id', excludeUserId);
    }

    const { data } = await q;
    return (data as any[]) || [];
  } catch {
    return [];
  }
}
