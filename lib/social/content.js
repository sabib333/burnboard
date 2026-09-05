import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { CONTENT_TYPES } from './types';

/**
 * Social Content Service
 * 
 * Provides a unified abstraction over different content types.
 * Existing roast content is preserved — this adds a layer for future content types.
 */

/**
 * Get content by ID (works for roasts, future posts, etc.)
 */
export async function getContentById(contentId, contentType = 'roast') {
  if (!isSupabaseConfigured || !supabase) return null;

  // For roasts, query the existing roasts table
  if (contentType === CONTENT_TYPES.ROAST) {
    const { data, error } = await supabase
      .from('roasts')
      .select('*, profiles!inner(username, platform, avatar_letter, avatar_color)')
      .eq('id', contentId)
      .single();

    if (error) return null;
    return { ...data, content_type: 'roast' };
  }

  return null;
}

/**
 * Get roasts by user (for future social profile feeds)
 */
export async function getRoastsByUser(userId, { limit = 20, offset = 0 } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('roasts')
    .select('*, profiles!inner(username, platform, avatar_letter, avatar_color)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return [];
  return (data || []).map(r => ({ ...r, content_type: 'roast' }));
}

/**
 * Get feed content (paginated, for future social feed)
 * Currently returns roasts sorted by creation date.
 */
export async function getFeedContent({ limit = 20, cursor = null } = {}) {
  if (!isSupabaseConfigured || !supabase) return { items: [], nextCursor: null };

  let query = supabase
    .from('roasts')
    .select('*, profiles!inner(username, platform, avatar_letter, avatar_color, tagline)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) return { items: [], nextCursor: null };

  const items = (data || []).map(r => ({
    ...r,
    content_type: 'roast',
    author: r.profiles,
  }));

  const nextCursor = items.length === limit ? items[items.length - 1].created_at : null;

  return { items, nextCursor };
}

/**
 * Format content for display
 */
export function formatContentForDisplay(content) {
  if (!content) return null;

  return {
    id: content.id,
    type: content.content_type || 'roast',
    text: content.roast_text || content.content_text || '',
    author: content.author || content.profiles || null,
    authorId: content.user_id,
    reactions: {
      funny: content.reaction_haha || content.reaction_funny || 0,
      savage: content.reaction_brutal || content.reaction_savage || 0,
      fatal: content.reaction_cry || content.reaction_fatal || 0,
    },
    upvotes: content.upvotes || 0,
    createdAt: content.created_at,
  };
}
