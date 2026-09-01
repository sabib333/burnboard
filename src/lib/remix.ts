/**
 * BURNBOARD Roast Remix System
 *
 * Users can remix existing roasts with their own twist.
 * Like Instagram's remix feature but for text roasts.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { getAnonId } from './interactions';

// ── Types ────────────────────────────────────────────────────
export interface RoastRemix {
  id: string;
  original_roast_id: string;
  original_profile_id: string | null;
  user_id: string | null;
  anon_id: string | null;
  remix_text: string;
  upvotes: number;
  created_at: string;
}

export interface RemixWithOriginal extends RoastRemix {
  original_roast_text?: string;
  original_anon_id?: string;
  profile_username?: string;
  profile_platform?: string;
}

// ── Create Remix ─────────────────────────────────────────────
export async function createRemix(params: {
  originalRoastId: string;
  originalProfileId?: string;
  remixText: string;
  userId?: string | null;
}): Promise<RoastRemix | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    // Fetch original roast to get profile_id if not provided
    let profileId = params.originalProfileId;
    if (!profileId) {
      const { data: original } = await supabase
        .from('roasts')
        .select('profile_id')
        .eq('id', params.originalRoastId)
        .single();
      profileId = original?.profile_id || null;
    }

    const { data, error } = await supabase
      .from('roast_remixes')
      .insert({
        original_roast_id: params.originalRoastId,
        original_profile_id: profileId,
        remix_text: params.remixText.trim(),
        user_id: params.userId || null,
        anon_id: params.userId ? null : getAnonId(),
      })
      .select()
      .single();

    if (error) throw error;

    // Add karma for remixing
    if (params.userId) {
      try {
        await supabase
          .from('user_profiles')
          .update({ karma: supabase.rpc ? undefined : undefined })
          .eq('id', params.userId);

        // Manual karma increment
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('karma')
          .eq('id', params.userId)
          .single();

        if (profile) {
          await supabase
            .from('user_profiles')
            .update({ karma: (profile.karma || 0) + 3 })
            .eq('id', params.userId);
        }
      } catch (e) {
        console.warn('[Remix] Karma update failed:', e);
      }
    }

    return data as RoastRemix;
  } catch (err) {
    console.warn('[Remix] Create failed:', err);
    return null;
  }
}

// ── Fetch Remixes for a Roast ────────────────────────────────
export async function fetchRemixesForRoast(
  roastId: string,
  limit = 20
): Promise<RemixWithOriginal[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  try {
    const { data, error } = await supabase
      .from('roast_remixes')
      .select('*')
      .eq('original_roast_id', roastId)
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as RemixWithOriginal[]) || [];
  } catch (err) {
    console.warn('[Remix] Fetch failed:', err);
    return [];
  }
}

// ── Fetch User's Remixes ─────────────────────────────────────
export async function fetchUserRemixes(
  userId: string,
  limit = 50
): Promise<RemixWithOriginal[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  try {
    const { data, error } = await supabase
      .from('roast_remixes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as RemixWithOriginal[]) || [];
  } catch (err) {
    console.warn('[Remix] User fetch failed:', err);
    return [];
  }
}

// ── Upvote Remix ─────────────────────────────────────────────
export async function upvoteRemix(remixId: string): Promise<number> {
  if (!isSupabaseConfigured || !supabase) return 0;

  try {
    const { data: remix } = await supabase
      .from('roast_remixes')
      .select('upvotes')
      .eq('id', remixId)
      .single();

    if (!remix) return 0;

    const newCount = (remix.upvotes || 0) + 1;

    await supabase
      .from('roast_remixes')
      .update({ upvotes: newCount })
      .eq('id', remixId);

    return newCount;
  } catch (err) {
    console.warn('[Remix] Upvote failed:', err);
    return 0;
  }
}

// ── Delete Remix (Owner Only) ────────────────────────────────
export async function deleteRemix(
  remixId: string,
  userId: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('roast_remixes')
      .delete()
      .eq('id', remixId)
      .eq('user_id', userId);

    return !error;
  } catch {
    return false;
  }
}

// ── Get Remix Count for Roast ────────────────────────────────
export async function getRemixCount(roastId: string): Promise<number> {
  if (!isSupabaseConfigured || !supabase) return 0;

  try {
    const { count } = await supabase
      .from('roast_remixes')
      .select('id', { count: 'exact', head: true })
      .eq('original_roast_id', roastId);

    return count || 0;
  } catch {
    return 0;
  }
}
