/**
 * BURNBOARD Presence — Real "Roasting Now" Counter
 *
 * Uses Supabase Realtime Presence to track connected users.
 * Stable anon_id from localStorage (persists across reloads).
 */

import { supabase, isSupabaseConfigured } from './supabase';

let channel: ReturnType<typeof supabase.channel> | null = null;

/**
 * Get or create a stable anonymous ID from localStorage.
 * Persists across page reloads — same user = same ID.
 */
export function getOrCreateAnonId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let anonId = localStorage.getItem('burnboard_anon_id');
  if (!anonId) {
    anonId = `Anonymous #${Math.floor(Math.random() * 900) + 100}`;
    localStorage.setItem('burnboard_anon_id', anonId);
  }
  return anonId;
}

/**
 * Get the stable user identifier for presence tracking.
 * Returns user_id if logged in, otherwise persistent anon_id.
 */
export function getPresenceKey(userId?: string | null): string {
  if (userId) return userId;
  return getOrCreateAnonId();
}

/**
 * Setup presence channel for "roasting now" counter.
 * Returns cleanup function to unsubscribe.
 */
export function setupRoastingPresence(
  setCount: (count: number) => void
): () => void {
  if (!isSupabaseConfigured || !supabase) {
    setCount(0);
    return () => {};
  }

  // Clean up existing channel
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }

  const presenceKey = getPresenceKey();

  channel = supabase.channel('roasting-now-global', {
    config: { presence: { key: presenceKey } },
  });

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel!.presenceState();
    const count = Object.keys(state).length;
    setCount(count);
  });

  channel.on('presence', { event: 'join' }, () => {
    const state = channel!.presenceState();
    setCount(Object.keys(state).length);
  });

  channel.on('presence', { event: 'leave' }, () => {
    const state = channel!.presenceState();
    setCount(Object.keys(state).length);
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel!.track({
        online_at: new Date().toISOString(),
        user_id: presenceKey,
      });
    }
  });

  return () => {
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  };
}
