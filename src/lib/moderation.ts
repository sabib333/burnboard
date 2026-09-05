/**
 * BURN BOARD — Moderation Module (Phase 10)
 *
 * User blocking, auto-moderation rules, bulk moderation tools.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { UserBlock, ModerationRule, ModerationAction } from '../types';

// ── User Blocking ──────────────────────────────────────────

export async function blockUser(blockerId: string, blockedId: string, reason?: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  if (blockerId === blockedId) return false;

  try {
    const { error } = await supabase
      .from('user_blocks')
      .insert({ blocker_id: blockerId, blocked_id: blockedId, reason: reason || null });
    return !error;
  } catch {
    return false;
  }
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);
    return !error;
  } catch {
    return false;
  }
}

export async function isBlockedBy(blockerId: string, blockedId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { data } = await supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

export async function getBlockedUsers(userId: string): Promise<UserBlock[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  try {
    const { data } = await supabase
      .from('user_blocks')
      .select('*')
      .eq('blocker_id', userId)
      .order('created_at', { ascending: false });

    return (data as UserBlock[]) || [];
  } catch {
    return [];
  }
}

export async function getBlockedIds(userId: string): Promise<Set<string>> {
  const blocks = await getBlockedUsers(userId);
  return new Set(blocks.map(b => b.blocked_id));
}

// ── Moderation Rules ────────────────────────────────────────

export async function fetchModerationRules(): Promise<ModerationRule[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  try {
    const { data } = await supabase
      .from('moderation_rules')
      .select('*')
      .eq('enabled', true)
      .order('severity', { ascending: false });

    return (data as ModerationRule[]) || [];
  } catch {
    return [];
  }
}

export async function checkModerationRules(text: string): Promise<{
  flagged: boolean;
  action: ModerationAction;
  rule?: ModerationRule;
}> {
  const rules = await fetchModerationRules();

  for (const rule of rules) {
    try {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(text)) {
        return {
          flagged: true,
          action: rule.action as ModerationAction,
          rule,
        };
      }
    } catch {
      // Invalid regex pattern — skip
    }
  }

  return { flagged: false, action: 'flag' };
}

// ── Bulk Moderation ─────────────────────────────────────────

export async function hideRoast(roastId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('roasts')
      .update({ is_hidden: true })
      .eq('id', roastId);
    return !error;
  } catch {
    return false;
  }
}

export async function unhideRoast(roastId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('roasts')
      .update({ is_hidden: false })
      .eq('id', roastId);
    return !error;
  } catch {
    return false;
  }
}

export async function banProfile(profileId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ is_banned: true })
      .eq('id', profileId);
    return !error;
  } catch {
    return false;
  }
}

export async function hideProfile(profileId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ is_hidden: true })
      .eq('id', profileId);
    return !error;
  } catch {
    return false;
  }
}

export async function getReportsWithDetails(limit: number = 50): Promise<any[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  try {
    const { data } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!data || data.length === 0) return [];

    // Enrich with roast and profile data
    const roastIds = [...new Set(data.map((r: any) => r.roast_id).filter(Boolean))];
    const { data: roasts } = await supabase
      .from('roasts')
      .select('id, roast_text, profile_id, anon_id')
      .in('id', roastIds);

    const roastMap = new Map((roasts || []).map((r: any) => [r.id, r]));

    return data.map((r: any) => {
      const roast = roastMap.get(r.roast_id);
      return {
        ...r,
        roast_text: roast?.roast_text,
        anon_id: roast?.anon_id,
        profile_id: roast?.profile_id,
      };
    });
  } catch {
    return [];
  }
}

export async function bulkResolveReports(
  reportIds: string[],
  action: 'resolve' | 'dismiss'
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    await supabase
      .from('reports')
      .update({ status: action === 'resolve' ? 'resolved' : 'dismissed' })
      .in('id', reportIds);
  } catch (err) {
    console.warn('[Moderation] Bulk resolve failed:', err);
  }
}
