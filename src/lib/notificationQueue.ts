/**
 * BURNBOARD Batch Notification Queue — 1M Scale
 *
 * Accumulates notifications in memory and flushes them in batches.
 * Avoids N individual Supabase INSERTs when 1M users are active.
 *
 * Browser push is handled by Supabase Realtime channel in NotificationBell.
 * This queue handles the batch INSERT into the notifications table.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { NotificationType } from './notify';
import { shouldNotify } from './notificationPrefs';

interface QueuedNotification {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  priority: number;
  dedup_key?: string;
}

const FLUSH_INTERVAL = 3000; // 3 seconds
const BATCH_SIZE = 100;
const DEDUP_WINDOW = 60000; // 60 seconds

class NotificationQueue {
  private queue: QueuedNotification[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;
  private dedupMap = new Map<string, number>();
  private upvoteCounters = new Map<string, number>();

  start() {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL);
  }

  stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  async enqueue(notification: QueuedNotification) {
    const enabled = await shouldNotify(notification.user_id, notification.type);
    if (!enabled) return;

    if (notification.dedup_key) {
      const lastSeen = this.dedupMap.get(notification.dedup_key);
      if (lastSeen && Date.now() - lastSeen < DEDUP_WINDOW) return;
      this.dedupMap.set(notification.dedup_key, Date.now());
    }

    this.queue.push(notification);

    if (this.queue.length >= BATCH_SIZE) {
      this.flush();
    }
  }

  async enqueueUpvote(userId: string, upvoteCount: number, profileId: string) {
    if (upvoteCount % 10 !== 0 || upvoteCount === 0) return;
    const key = `${userId}:${profileId}`;
    const lastCount = this.upvoteCounters.get(key) || 0;
    if (lastCount >= upvoteCount) return;
    this.upvoteCounters.set(key, upvoteCount);

    await this.enqueue({
      user_id: userId,
      type: 'upvote',
      title: 'Upvote Milestone ⬆️',
      message: `Your roast reached ${upvoteCount} upvotes!`,
      link: `#post/${profileId}`,
      priority: 1,
      dedup_key: `upvote:${userId}:${profileId}:${upvoteCount}`,
    });
  }

  async enqueueFollow(followedUserId: string, followerUsername: string) {
    await this.enqueue({
      user_id: followedUserId,
      type: 'follow',
      title: 'New Follower 👤',
      message: `${followerUsername} started following you`,
      link: `#u/${followerUsername}`,
      priority: 2,
      dedup_key: `follow:${followedUserId}:${followerUsername}`,
    });
  }

  async enqueueRoast(profileOwnerId: string, roasterUsername: string, roastText: string, profileId: string) {
    await this.enqueue({
      user_id: profileOwnerId,
      type: 'roast',
      title: 'New Roast 🔥',
      message: `${roasterUsername} roasted: "${roastText.slice(0, 60)}${roastText.length > 60 ? '...' : ''}"`,
      link: `#post/${profileId}`,
      priority: 1,
      dedup_key: `roast:${profileOwnerId}:${profileId}:${Date.now()}`,
    });
  }

  async enqueueDm(userId: string, senderUsername: string) {
    await this.enqueue({
      user_id: userId,
      type: 'dm',
      title: 'New Message 💬',
      message: `${senderUsername} sent you a message`,
      link: '#dm',
      priority: 3,
      dedup_key: `dm:${userId}:${senderUsername}:${Math.floor(Date.now() / 5000)}`,
    });
  }

  async enqueueLevelUp(userId: string, newLevel: string) {
    const emojis: Record<string, string> = {
      'Newbie': '🌱',
      'Roaster': '🔥',
      'Brutal': '⚡',
      'Savage': '💀',
    };

    await this.enqueue({
      user_id: userId,
      type: 'levelup',
      title: `Level Up! ${emojis[newLevel] || '🎉'}`,
      message: `You are now ${newLevel}! Keep roasting to climb higher.`,
      link: '#top',
      priority: 1,
    });
  }

  async flush(): Promise<number> {
    if (this.isFlushing || this.queue.length === 0) return 0;
    if (!isSupabaseConfigured || !supabase) {
      this.queue = [];
      return 0;
    }

    this.isFlushing = true;

    try {
      const batch = this.queue
        .sort((a, b) => b.priority - a.priority)
        .slice(0, BATCH_SIZE);

      this.queue = this.queue.slice(batch.length);

      // Batch insert via RPC
      const { data, error } = await supabase.rpc('batch_insert_notifications', {
        notifications: batch.map(n => ({
          user_id: n.user_id,
          type: n.type,
          title: n.title,
          message: n.message,
          link: n.link || null,
          priority: n.priority,
          dedup_key: n.dedup_key || null,
        })),
      });

      if (error) {
        console.warn('[NotificationQueue] Batch insert failed:', error.message);
        this.queue = [...batch, ...this.queue];
        return 0;
      }

      // Browser push is now handled by Supabase Realtime in NotificationBell
      // No need to trigger push here

      return data || 0;
    } catch (err) {
      console.warn('[NotificationQueue] Flush error:', err);
      return 0;
    } finally {
      this.isFlushing = false;
    }
  }

  get size(): number {
    return this.queue.length;
  }

  clearDedup(key: string) {
    this.dedupMap.delete(key);
  }

  clearAllDedup() {
    this.dedupMap.clear();
  }
}

export const notificationQueue = new NotificationQueue();

// Auto-start queue on module load
if (typeof window !== 'undefined') {
  notificationQueue.start();

  window.addEventListener('beforeunload', () => {
    notificationQueue.flush();
  });
}
