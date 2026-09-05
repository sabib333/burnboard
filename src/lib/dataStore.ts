/**
 * BURNBOARD DataStore — 100% Supabase Realtime
 *
 * NO demo data. NO dummy profiles. NO fake roasts.
 * Everything comes from Supabase. If Supabase is not configured,
 * the app shows empty states telling users to connect.
 */

import { Profile, Roast, Battle, ReportItem, BlockedIP, DailyWinner } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { generateAnonId } from './badWords';

// Broadcast channel for multi-tab realtime emulation
const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('burnboard_realtime_events')
  : null;

// Listeners
type EventCallback = (event: { type: string; payload: any }) => void;
const listeners = new Set<EventCallback>();

export function subscribeToStore(cb: EventCallback) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notifySubscribers(type: string, payload: any) {
  listeners.forEach(cb => cb({ type, payload }));
  if (channel) {
    channel.postMessage({ type, payload });
  }
}

if (channel) {
  channel.onmessage = (msg) => {
    listeners.forEach(cb => cb(msg.data));
  };
}

// ============================================================
// HELPER: Require Supabase or throw
// ============================================================
function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured. Please connect your Supabase project.');
  }
}

// ============================================================
// DATA STORE — 100% SUPABASE
// ============================================================
export const DataStore = {
  // ----------------------------------------------------------
  // PROFILES
  // ----------------------------------------------------------
  async getProfiles(): Promise<Profile[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[DataStore] Failed to fetch profiles:', error.message);
        return [];
      }

      const profiles = (data as Profile[]) || [];
      // Save count for offline page
      try { localStorage.setItem('burnboard_profile_count', String(profiles.length)); } catch {}
      return profiles;
    } catch (err) {
      console.warn('[DataStore] Profile fetch error:', err);
      return [];
    }
  },

  async getProfileById(id: string): Promise<Profile | undefined> {
    if (!isSupabaseConfigured || !supabase) return undefined;

    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      return (data as Profile) || undefined;
    } catch {
      return undefined;
    }
  },

  async createProfile(data: { username: string; platform: string; bio: string }): Promise<Profile> {
    requireSupabase();

    const avatarLetter = (data.username.trim().charAt(0) || '?').toUpperCase();
    const colors = [
      'bg-gradient-to-tr from-[#ff4d00] to-orange-400 text-black',
      'bg-gradient-to-tr from-cyan-500 to-blue-500 text-white',
      'bg-gradient-to-tr from-emerald-500 to-teal-400 text-black',
      'bg-gradient-to-tr from-purple-500 to-pink-500 text-white',
      'bg-gradient-to-tr from-yellow-500 to-amber-400 text-black',
      'bg-gradient-to-tr from-rose-500 to-red-500 text-white'
    ];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const { data: newProfile, error } = await supabase!
      .from('profiles')
      .insert({
        username: data.username.trim().replace(/^@/, ''),
        platform: data.platform,
        bio: data.bio.trim(),
        avatar_letter: avatarLetter,
        avatar_color: avatarColor,
        tagline: `${data.platform} Roastee`,
        roast_count: 0,
        total_upvotes: 0,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    notifySubscribers('PROFILE_CREATED', newProfile);
    return newProfile as Profile;
  },

  // ----------------------------------------------------------
  // ROASTS
  // ----------------------------------------------------------
  async getRoasts(profileId?: string): Promise<Roast[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      let query = supabase
        .from('roasts')
        .select('*')
        .order('created_at', { ascending: false });

      if (profileId) {
        query = query.eq('profile_id', profileId);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('[DataStore] Failed to fetch roasts:', error.message);
        return [];
      }

      return (data as Roast[]) || [];
    } catch (err) {
      console.warn('[DataStore] Roast fetch error:', err);
      return [];
    }
  },

  async createRoast(profileId: string, roastText: string, customAnonId?: string, userId?: string, savageLevel?: string): Promise<Roast> {
    requireSupabase();

    const anonId = customAnonId || generateAnonId();
    const validLevels = ['mild', 'savage', 'toxic', 'bangla'];
    const level = validLevels.includes(savageLevel || '') ? savageLevel : 'savage';

    const { data: newRoast, error } = await supabase!
      .from('roasts')
      .insert({
        profile_id: profileId,
        roast_text: roastText.trim(),
        upvotes: 1,
        reaction_haha: 0,
        reaction_brutal: 1,
        reaction_cry: 0,
        anon_id: anonId,
        user_id: userId || null,
        savage_level: level,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Increment profile roast count
    await supabase!
      .from('profiles')
      .update({ roast_count: supabase!.rpc ? undefined : undefined }) // Will use RPC below
      .eq('id', profileId);

    // Use raw increment via RPC or manual update
    try {
      const { data: profile } = await supabase!
        .from('profiles')
        .select('roast_count, total_upvotes')
        .eq('id', profileId)
        .single();

      if (profile) {
        await supabase!
          .from('profiles')
          .update({
            roast_count: (profile.roast_count || 0) + 1,
            total_upvotes: (profile.total_upvotes || 0) + 1,
          })
          .eq('id', profileId);
      }
    } catch (e) {
      console.warn('[DataStore] Failed to increment roast count:', e);
    }

    // Track local roast count for streak/achievements
    if (typeof window !== 'undefined') {
      try {
        const count = parseInt(localStorage.getItem('my_roast_count') || '0', 10) + 1;
        localStorage.setItem('my_roast_count', String(count));

        const lastRoastDate = localStorage.getItem('my_last_roast_date');
        const today = new Date().toISOString().slice(0, 10);
        let streak = parseInt(localStorage.getItem('my_roast_streak') || '1', 10);

        if (lastRoastDate) {
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          if (lastRoastDate === yesterday) {
            streak += 1;
          } else if (lastRoastDate !== today) {
            streak = 1;
          }
        } else {
          streak = 1;
        }

        localStorage.setItem('my_last_roast_date', today);
        localStorage.setItem('my_roast_streak', String(streak));
      } catch (e) {
        console.warn('Anon stats storage error:', e);
      }
    }

    notifySubscribers('ROAST_CREATED', newRoast);
    return newRoast as Roast;
  },

  // ----------------------------------------------------------
  // UPVOTES & REACTIONS
  // ----------------------------------------------------------
  async upvoteRoast(roastId: string): Promise<{ upvotes: number; isUpvoted: boolean }> {
    requireSupabase();

    // Check if already upvoted (localStorage-based per browser)
    const voteKey = `burnboard_vote_${roastId}`;
    const alreadyVoted = typeof window !== 'undefined' && localStorage.getItem(voteKey) === 'true';

    // Optimistic: toggle
    const delta = alreadyVoted ? -1 : 1;

    // Get current upvotes
    const { data: roast } = await supabase!
      .from('roasts')
      .select('upvotes')
      .eq('id', roastId)
      .single();

    const newCount = Math.max(0, (roast?.upvotes || 0) + delta);

    await supabase!
      .from('roasts')
      .update({ upvotes: newCount })
      .eq('id', roastId);

    if (typeof window !== 'undefined') {
      localStorage.setItem(voteKey, (!alreadyVoted).toString());
    }

    notifySubscribers('ROAST_UPVOTED', { roastId, upvotes: newCount, isUpvoted: !alreadyVoted });
    return { upvotes: newCount, isUpvoted: !alreadyVoted };
  },

  async reactRoast(roastId: string, type: 'haha' | 'brutal' | 'cry'): Promise<{ counts: { haha: number; brutal: number; cry: number } }> {
    requireSupabase();

    const reactionKey = `burnboard_react_${roastId}_${type}`;
    const alreadyReacted = typeof window !== 'undefined' && localStorage.getItem(reactionKey) === 'true';
    const delta = alreadyReacted ? -1 : 1;

    const { data: roast } = await supabase!
      .from('roasts')
      .select('reaction_haha, reaction_brutal, reaction_cry')
      .eq('id', roastId)
      .single();

    if (!roast) return { counts: { haha: 0, brutal: 0, cry: 0 } };

    const counts = {
      haha: Math.max(0, (roast.reaction_haha || 0) + (type === 'haha' ? delta : 0)),
      brutal: Math.max(0, (roast.reaction_brutal || 0) + (type === 'brutal' ? delta : 0)),
      cry: Math.max(0, (roast.reaction_cry || 0) + (type === 'cry' ? delta : 0)),
    };

    await supabase!
      .from('roasts')
      .update({
        reaction_haha: counts.haha,
        reaction_brutal: counts.brutal,
        reaction_cry: counts.cry,
      })
      .eq('id', roastId);

    if (typeof window !== 'undefined') {
      localStorage.setItem(reactionKey, (!alreadyReacted).toString());
    }

    notifySubscribers('ROAST_REACTED', { roastId, counts });
    return { counts };
  },

  // ----------------------------------------------------------
  // BATTLES
  // ----------------------------------------------------------
  async getBattles(): Promise<Battle[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      const { data } = await supabase
        .from('battles')
        .select('*')
        .order('created_at', { ascending: false });

      return (data as Battle[]) || [];
    } catch {
      return [];
    }
  },

  async voteBattle(battleId: string, candidate: 1 | 2): Promise<Battle> {
    requireSupabase();

    const { data: battle } = await supabase!
      .from('battles')
      .select('*')
      .eq('id', battleId)
      .single();

    if (!battle) throw new Error('Battle not found');

    const update = candidate === 1
      ? { votes1: (battle.votes1 || 0) + 1 }
      : { votes2: (battle.votes2 || 0) + 1 };

    const { data: updated } = await supabase!
      .from('battles')
      .update(update)
      .eq('id', battleId)
      .select()
      .single();

    notifySubscribers('BATTLE_VOTED', updated);
    return updated as Battle;
  },

  async createRandomBattle(): Promise<Battle> {
    requireSupabase();

    const { data: profiles } = await supabase!
      .from('profiles')
      .select('id')
      .limit(100);

    if (!profiles || profiles.length < 2) {
      throw new Error('Need at least 2 profiles to create a battle');
    }

    const idx1 = Math.floor(Math.random() * profiles.length);
    let idx2 = Math.floor(Math.random() * profiles.length);
    while (idx2 === idx1) {
      idx2 = Math.floor(Math.random() * profiles.length);
    }

    const { data: battle, error } = await supabase!
      .from('battles')
      .insert({
        profile1_id: profiles[idx1].id,
        profile2_id: profiles[idx2].id,
        votes1: 0,
        votes2: 0,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return battle as Battle;
  },

  // ----------------------------------------------------------
  // ADMIN / DELETE
  // ----------------------------------------------------------
  async deleteProfile(id: string): Promise<void> {
    requireSupabase();
    await supabase!.from('profiles').delete().eq('id', id);
    notifySubscribers('STORE_RESET', { deletedProfileId: id });
  },

  async deleteRoast(id: string): Promise<void> {
    requireSupabase();
    await supabase!.from('roasts').delete().eq('id', id);
    notifySubscribers('STORE_RESET', { deletedRoastId: id });
  },

  async toggleFeatureProfile(id: string): Promise<boolean> {
    requireSupabase();

    const { data: profile } = await supabase!
      .from('profiles')
      .select('featured')
      .eq('id', id)
      .single();

    const newVal = !(profile?.featured);
    await supabase!
      .from('profiles')
      .update({ featured: newVal })
      .eq('id', id);

    notifySubscribers('STORE_RESET', { featuredProfileId: id, isNowFeatured: newVal });
    return newVal;
  },

  // ----------------------------------------------------------
  // REPORTS
  // ----------------------------------------------------------
  async getReports(): Promise<ReportItem[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      const { data } = await supabase
        .from('reports')
        .select('*, roasts!inner(roast_text, profiles!inner(username))')
        .order('created_at', { ascending: false });

      return ((data || []) as any[]).map((r: any) => ({
        id: r.id,
        roast_id: r.roast_id,
        reason: r.reason,
        created_at: r.created_at,
        roast_text: r.roasts?.roast_text,
        profile_username: r.roasts?.profiles?.username,
      })) as ReportItem[];
    } catch {
      return [];
    }
  },

  async addReport(roastId: string, reason: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    await supabase.from('reports').insert({
      roast_id: roastId,
      reason,
    });
  },

  // ----------------------------------------------------------
  // BLOCKED IPS
  // ----------------------------------------------------------
  async getBlockedIps(): Promise<BlockedIP[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    try {
      const { data } = await supabase.from('blocked_ips').select('*').order('created_at', { ascending: false });
      return (data as BlockedIP[]) || [];
    } catch {
      return [];
    }
  },

  async blockIp(ipHash: string, reason: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('blocked_ips').upsert({ ip_hash: ipHash, reason });
  },

  async unblockIp(ipHash: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('blocked_ips').delete().eq('ip_hash', ipHash);
  },

  // ----------------------------------------------------------
  // RESOLVE REPORT
  // ----------------------------------------------------------
  async resolveReport(reportId: string, action: 'approve' | 'delete', roastId?: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('reports').delete().eq('id', reportId);
    if (action === 'delete' && roastId) {
      await this.deleteRoast(roastId);
    }
  },

  // ----------------------------------------------------------
  // DAILY WINNER (computed from top roast)
  // ----------------------------------------------------------
  async getDailyWinner(): Promise<DailyWinner | null> {
    if (!isSupabaseConfigured || !supabase) return null;

    try {
      const { data: topRoast } = await supabase
        .from('roasts')
        .select('*, profiles!inner(id, username)')
        .order('upvotes', { ascending: false })
        .limit(1)
        .single();

      if (!topRoast) return null;

      return {
        id: `daily-${new Date().toISOString().slice(0, 10)}`,
        profile_id: topRoast.profile_id,
        roast_id: topRoast.id,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        roast_text: topRoast.roast_text,
        username: (topRoast as any).profiles?.username || 'Top Victim',
        upvotes: topRoast.upvotes,
      };
    } catch {
      return null;
    }
  },

  // ----------------------------------------------------------
  // RESET (admin only — deletes all data)
  // ----------------------------------------------------------
  async resetDefaults(): Promise<void> {
    // This is a nuclear option — only for admin
    if (!isSupabaseConfigured || !supabase) return;

    await supabase.from('roasts').delete().neq('id', '');
    await supabase.from('profiles').delete().neq('id', '');
    await supabase.from('battles').delete().neq('id', '');

    notifySubscribers('STORE_RESET', {});
  },
};
