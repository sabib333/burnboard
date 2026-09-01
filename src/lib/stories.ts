/**
 * BURNBOARD Stories System
 *
 * Instagram-style 24h expiring stories.
 * - Create stories with text + color
 * - Track views per user
 * - Auto-expire after 24 hours
 * - Reactions: 🔥 💀 😂
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { getAnonId } from './interactions';

// ── Types ────────────────────────────────────────────────────
export interface Story {
  id: string;
  user_id: string | null;
  anon_id: string | null;
  profile_id: string | null;
  text: string;
  background_color: string;
  view_count: number;
  is_hidden: boolean;
  created_at: string;
  expires_at: string;
}

export interface StoryWithMeta extends Story {
  is_viewed?: boolean;
  is_own?: boolean;
}

// ── Create Story ─────────────────────────────────────────────
export async function createStory(params: {
  text: string;
  backgroundColor?: string;
  userId?: string | null;
  profileId?: string | null;
}): Promise<Story | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('stories')
      .insert({
        text: params.text.trim(),
        background_color: params.backgroundColor || '#ff4500',
        user_id: params.userId || null,
        anon_id: params.userId ? null : getAnonId(),
        profile_id: params.profileId || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as Story;
  } catch (err) {
    console.warn('[Stories] Create failed:', err);
    return null;
  }
}

// ── Fetch Active Stories ─────────────────────────────────────
export async function fetchActiveStories(): Promise<Story[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  try {
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return (data as Story[]) || [];
  } catch (err) {
    console.warn('[Stories] Fetch failed:', err);
    return [];
  }
}

// ── Fetch Stories Grouped by User ────────────────────────────
export async function fetchStoriesGroupedByUser(): Promise<Map<string, Story[]>> {
  const stories = await fetchActiveStories();
  const grouped = new Map<string, Story[]>();

  for (const story of stories) {
    const key = story.user_id || story.anon_id || 'unknown';
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(story);
  }

  return grouped;
}

// ── Record Story View ────────────────────────────────────────
export async function recordStoryView(
  storyId: string,
  userId?: string | null
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const anonId = userId ? undefined : getAnonId();

    // Upsert to avoid duplicate views
    const { error } = await supabase
      .from('story_views')
      .upsert(
        {
          story_id: storyId,
          user_id: userId || null,
          anon_id: anonId || null,
        },
        {
          onConflict: userId ? 'story_id,user_id' : 'story_id,anon_id',
        }
      );

    if (error) throw error;

    // Increment view_count on story
    await supabase
      .rpc('increment_story_views', { story_id: storyId })
      .catch(() => {
        // Fallback: manual increment
        supabase
          .from('stories')
          .select('view_count')
          .eq('id', storyId)
          .single()
          .then(({ data }) => {
            if (data) {
              supabase
                .from('stories')
                .update({ view_count: (data.view_count || 0) + 1 })
                .eq('id', storyId);
            }
          });
      });

    return true;
  } catch (err) {
    console.warn('[Stories] View record failed:', err);
    return false;
  }
}

// ── Check if User Viewed Story ───────────────────────────────
export async function hasUserViewedStory(
  storyId: string,
  userId?: string | null
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    let query = supabase
      .from('story_views')
      .select('id')
      .eq('story_id', storyId)
      .limit(1);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('anon_id', getAnonId());
    }

    const { data } = await query;
    return (data && data.length > 0) || false;
  } catch {
    return false;
  }
}

// ── Bulk Check Viewed Stories ────────────────────────────────
export async function fetchViewedStoryIds(
  userId?: string | null
): Promise<Set<string>> {
  if (!isSupabaseConfigured || !supabase) return new Set();

  try {
    let query = supabase
      .from('story_views')
      .select('story_id');

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('anon_id', getAnonId());
    }

    const { data } = await query;
    return new Set((data || []).map((v: any) => v.story_id));
  } catch {
    return new Set();
  }
}

// ── Delete Story (Owner Only) ────────────────────────────────
export async function deleteStory(
  storyId: string,
  userId: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('stories')
      .delete()
      .eq('id', storyId)
      .eq('user_id', userId);

    return !error;
  } catch {
    return false;
  }
}

// ── Hide Story (Admin) ───────────────────────────────────────
export async function hideStory(storyId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('stories')
      .update({ is_hidden: true })
      .eq('id', storyId);

    return !error;
  } catch {
    return false;
  }
}
