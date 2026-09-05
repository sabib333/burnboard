/**
 * BURN BOARD — Hot Seat Module
 *
 * Users can put themselves in the "Hot Seat" and share a unique link.
 * Anyone with the link can roast them without navigating the full feed.
 */

import { supabase, isSupabaseConfigured } from './supabase';

export async function generateHotSeatToken(profileId: string): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const token = `hs_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const { error } = await supabase
    .from('profiles')
    .update({ hot_seat_token: token, hot_seat_expires_at: expiresAt })
    .eq('id', profileId);

  if (error) {
    console.warn('[HotSeat] Token generation failed:', error.message);
    return null;
  }
  return token;
}

export async function getProfileByHotSeatToken(token: string): Promise<any | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('hot_seat_token', token)
      .gt('hot_seat_expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;

    // Increment share count
    await supabase
      .from('profiles')
      .update({ hot_seat_share_count: (data.hot_seat_share_count || 0) + 1 })
      .eq('id', data.id);

    return data;
  } catch {
    return null;
  }
}

export async function revokeHotSeatToken(profileId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  await supabase
    .from('profiles')
    .update({ hot_seat_token: null, hot_seat_expires_at: null })
    .eq('id', profileId);
}

export function getHotSeatShareUrl(token: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://burnboard.app';
  return `${base}/#hot-seat/${token}`;
}
