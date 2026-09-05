import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Social Reactions Service
 * 
 * Generic reaction system that works alongside existing roast reactions.
 * Supports multiple reaction types per content item.
 */

/**
 * React to a roast (extends existing reaction system)
 */
export async function reactToRoast(roastId, reactionType, participantId) {
  if (!isSupabaseConfigured || !supabase) return { error: 'Not configured' };

  const validTypes = ['funny', 'savage', 'fatal'];
  if (!validTypes.includes(reactionType)) {
    return { error: 'Invalid reaction type' };
  }

  const field = `reaction_${reactionType === 'funny' ? 'haha' : reactionType === 'savage' ? 'brutal' : 'cry'}`;

  // Get current count
  const { data: roast } = await supabase
    .from('roasts')
    .select(field)
    .eq('id', roastId)
    .single();

  if (!roast) return { error: 'Roast not found' };

  const currentCount = roast[field] || 0;

  // Update count
  const { error } = await supabase
    .from('roasts')
    .update({ [field]: currentCount + 1 })
    .eq('id', roastId);

  if (error) return { error: error.message };

  return {
    success: true,
    counts: {
      funny: field === 'reaction_haha' ? currentCount + 1 : undefined,
      savage: field === 'reaction_brutal' ? currentCount + 1 : undefined,
      fatal: field === 'reaction_cry' ? currentCount + 1 : undefined,
    },
  };
}

/**
 * Get reaction counts for multiple roasts
 */
export async function getRoastReactionCounts(roastIds) {
  if (!isSupabaseConfigured || !supabase || !roastIds.length) return {};

  const { data, error } = await supabase
    .from('roasts')
    .select('id, reaction_haha, reaction_brutal, reaction_cry')
    .in('id', roastIds);

  if (error) return {};

  const counts = {};
  for (const roast of data || []) {
    counts[roast.id] = {
      funny: roast.reaction_haha || 0,
      savage: roast.reaction_brutal || 0,
      fatal: roast.reaction_cry || 0,
      total: (roast.reaction_haha || 0) + (roast.reaction_brutal || 0) + (roast.reaction_cry || 0),
    };
  }

  return counts;
}

/**
 * Calculate engagement score for a roast
 */
export function calculateEngagementScore(reactionCounts) {
  if (!reactionCounts) return 0;
  const WEIGHTS = { funny: 3, savage: 2, fatal: 4 };
  return (
    (reactionCounts.funny || 0) * WEIGHTS.funny +
    (reactionCounts.savage || 0) * WEIGHTS.savage +
    (reactionCounts.fatal || 0) * WEIGHTS.fatal
  );
}
