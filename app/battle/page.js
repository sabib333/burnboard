'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ProfileCardSkeleton } from '@/components/Skeleton';
import LiveStats from '@/components/LiveStats';
import {
  Swords, Flame, RefreshCw, ArrowRight, Loader2
} from 'lucide-react';

export default function BattlePage() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fighter1, setFighter1] = useState(null);
  const [fighter2, setFighter2] = useState(null);
  const [activeBattle, setActiveBattle] = useState(null);
  const [hasVoted, setHasVoted] = useState(null);
  const [roasts1, setRoasts1] = useState([]);
  const [roasts2, setRoasts2] = useState([]);

  // ── Fetch all profiles ─────────────────────────────────────
  const fetchProfiles = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      setProfiles(data || []);
    } catch (err) {
      console.error('[Battle] Fetch profiles error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // ── Pick 2 random fighters ─────────────────────────────────
  const pickRandomFighters = useCallback(async (profileList) => {
    if (!profileList || profileList.length < 2) return;
    const shuffled = [...profileList].sort(() => 0.5 - Math.random());
    const p1 = shuffled[0];
    const p2 = shuffled[1];
    setFighter1(p1);
    setFighter2(p2);
    setHasVoted(null);

    // Fetch roasts for each fighter
    const [r1, r2] = await Promise.all([
      supabase.from('roasts').select('*').eq('profile_id', p1.id).order('created_at', { ascending: false }).limit(2),
      supabase.from('roasts').select('*').eq('profile_id', p2.id).order('created_at', { ascending: false }).limit(2),
    ]);
    setRoasts1(r1.data || []);
    setRoasts2(r2.data || []);

    // Find or create battle
    if (!isSupabaseConfigured || !supabase) return;

    const { data: existing } = await supabase
      .from('battles')
      .select('*')
      .or(`and(profile1_id.eq.${p1.id},profile2_id.eq.${p2.id}),and(profile1_id.eq.${p2.id},profile2_id.eq.${p1.id})`)
      .limit(1);

    if (existing && existing.length > 0) {
      setActiveBattle(existing[0]);
    } else {
      const { data: newBattle } = await supabase
        .from('battles')
        .insert({
          profile1_id: p1.id,
          profile2_id: p2.id,
          votes1: 0,
          votes2: 0,
        })
        .select()
        .single();
      if (newBattle) setActiveBattle(newBattle);
    }
  }, []);

  // Auto-pick when profiles load
  useEffect(() => {
    if (profiles.length >= 2 && !fighter1 && !loading) {
      pickRandomFighters(profiles);
    }
  }, [profiles, fighter1, loading, pickRandomFighters]);

  // ── Realtime subscription for this battle ───────────────────
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !activeBattle) return;

    const channel = supabase
      .channel(`battle-${activeBattle.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'battles', filter: `id=eq.${activeBattle.id}` },
        (payload) => {
          setActiveBattle(payload.new);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeBattle?.id]);

  // ── Vote Handler ───────────────────────────────────────────
  const handleVote = async (candidate) => {
    if (!activeBattle || hasVoted) return;
    setHasVoted(candidate);

    // Optimistic update
    setActiveBattle(prev => ({
      ...prev,
      votes1: candidate === 1 ? (prev.votes1 || 0) + 1 : (prev.votes1 || 0),
      votes2: candidate === 2 ? (prev.votes2 || 0) + 1 : (prev.votes2 || 0),
    }));

    try {
      if (candidate === 1) {
        await supabase.from('battles').update({ votes1: (activeBattle.votes1 || 0) + 1 }).eq('id', activeBattle.id);
      } else {
        await supabase.from('battles').update({ votes2: (activeBattle.votes2 || 0) + 1 }).eq('id', activeBattle.id);
      }
    } catch (err) {
      console.error('[Battle] Vote failed:', err);
    }
  };

  // ── Next Battle ────────────────────────────────────────────
  const handleNext = () => {
    setHasVoted(null);
    setActiveBattle(null);
    setFighter1(null);
    setFighter2(null);
    setRoasts1([]);
    setRoasts2([]);
  };

  // ── Vote Percentages ───────────────────────────────────────
  const totalVotes = (activeBattle?.votes1 || 0) + (activeBattle?.votes2 || 0);
  const pct1 = totalVotes > 0 ? Math.round(((activeBattle?.votes1 || 0) / totalVotes) * 100) : 50;
  const pct2 = 100 - pct1;

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
        <div className="max-w-4xl mx-auto space-y-6">
          <header className="text-center space-y-2 py-6 border-b border-[#222]">
            <div className="flex items-center justify-center gap-2 text-[#ff4d00]">
              <Swords className="w-8 h-8 text-[#ff4d00]" />
              <h1 className="text-2xl font-black uppercase tracking-wider font-mono">Battle Arena</h1>
            </div>
          </header>
          <div className="space-y-4">
            <ProfileCardSkeleton />
            <ProfileCardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // ── Not Configured ─────────────────────────────────────────
  if (!isSupabaseConfigured || !supabase) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
        <div className="max-w-4xl mx-auto space-y-6">
          <header className="text-center space-y-2 py-6 border-b border-[#222]">
            <div className="flex items-center justify-center gap-2 text-[#ff4d00]">
              <Swords className="w-8 h-8 text-[#ff4d00]" />
              <h1 className="text-2xl font-black uppercase tracking-wider font-mono">Battle Arena</h1>
            </div>
          </header>
          <div className="bg-[#111] border border-dashed border-[#333] rounded-2xl p-10 text-center space-y-4">
            <div className="text-4xl">⚔️</div>
            <h2 className="text-lg font-bold text-white uppercase">Supabase Not Configured</h2>
            <p className="text-xs text-zinc-400">Connect Supabase to start battles.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty State: Less than 2 profiles ──────────────────────
  if (profiles.length < 2) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
        <div className="max-w-4xl mx-auto space-y-6">
          <header className="text-center space-y-2 py-6 border-b border-[#222]">
            <div className="flex items-center justify-center gap-2 text-[#ff4d00]">
              <Swords className="w-8 h-8 text-[#ff4d00]" />
              <h1 className="text-2xl font-black uppercase tracking-wider font-mono">Battle Arena</h1>
            </div>
          </header>
          <div className="bg-[#111] border border-dashed border-[#333] rounded-2xl p-10 text-center space-y-4">
            <div className="text-5xl">⚔️</div>
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Need more targets</h3>
            <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto">
              Battles require at least 2 profiles. Currently at{' '}
              <span className="text-[#ff4d00] font-bold">{profiles.length}/2</span>.
              Invite friends to get roasted!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Waiting for fighters ───────────────────────────────────
  if (!fighter1 || !fighter2 || !activeBattle) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#ff4d00] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-red-950/40 via-[#111] to-blue-950/40 border border-[#333] rounded-2xl p-5 sm:p-6 text-center relative overflow-hidden shadow-2xl">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Swords className="w-6 h-6 text-[#ff4d00] animate-bounce" />
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-tight">
              Roast Arena: Head-to-Head Battle
            </h1>
            <Swords className="w-6 h-6 text-blue-400 animate-bounce" />
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto">
            Who got destroyed harder by real humans? Vote to decide.
          </p>
          <div className="flex justify-center mt-3">
            <LiveStats />
          </div>

          {/* Global vote bar */}
          <div className="mt-5 max-w-xl mx-auto">
            <div className="flex justify-between text-xs font-mono font-bold mb-1.5 px-1">
              <span className="text-[#ff4d00]">@{fighter1.username} ({pct1}%)</span>
              <span className="text-zinc-500">{totalVotes.toLocaleString()} TOTAL VOTES</span>
              <span className="text-blue-400">@{fighter2.username} ({pct2}%)</span>
            </div>
            <div className="h-3 bg-[#1c1c1c] rounded-full overflow-hidden flex border border-[#333] p-0.5">
              <div
                className="bg-gradient-to-r from-orange-600 to-[#ff4d00] h-full rounded-l-full transition-all duration-500"
                style={{ width: `${pct1}%` }}
              />
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-r-full transition-all duration-500"
                style={{ width: `${pct2}%` }}
              />
            </div>
          </div>
        </div>

        {/* Arena Fighters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
          {/* VS Center Indicator */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-[#0a0a0a] border-2 border-[#ff4d00] flex items-center justify-center shadow-[0_0_25px_rgba(255,77,0,0.6)] animate-pulse">
              <span className="font-black text-white italic text-lg tracking-tighter">VS</span>
            </div>
          </div>

          {/* Fighter 1 (Red) */}
          <div className={`bg-[#111] border rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between transition-all duration-200 ${
            hasVoted === 1
              ? 'border-[#ff4d00] shadow-[0_0_30px_rgba(255,77,0,0.3)] ring-1 ring-[#ff4d00]'
              : 'border-[#222] hover:border-[#333]'
          }`}>
            <div>
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black shrink-0 ${fighter1.avatar_color || 'bg-[#ff4d00] text-black'}`}>
                  {fighter1.avatar_letter}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-white text-lg truncate">@{fighter1.username}</h3>
                    <span className="text-[10px] font-bold bg-[#ff4d00]/20 text-[#ff4d00] border border-[#ff4d00]/40 px-2 py-0.5 rounded-full uppercase">
                      {fighter1.platform}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed line-clamp-3">{fighter1.bio}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs font-mono text-zinc-400">
                    <span>🔥 {fighter1.roast_count || 0} burns</span>
                    <span>▲ {fighter1.total_upvotes || 0} upvotes</span>
                  </div>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                <div className="text-[10px] font-mono uppercase text-zinc-500 font-bold">Featured Burns:</div>
                {roasts1.length > 0 ? roasts1.map(r => (
                  <div key={r.id} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-xl text-xs text-zinc-300">
                    <div className="text-[10px] text-[#ff4d00] font-mono font-bold mb-1">{r.anon_id}</div>
                    <p>&ldquo;{r.roast_text}&rdquo;</p>
                  </div>
                )) : (
                  <p className="text-xs text-zinc-500 italic">No roasts yet. Be the first to burn this target!</p>
                )}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-[#222] flex items-center justify-between gap-3">
              <button
                onClick={() => handleVote(1)}
                disabled={!!hasVoted}
                className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  hasVoted === 1
                    ? 'bg-[#ff4d00] text-black shadow-[0_0_20px_rgba(255,77,0,0.5)]'
                    : hasVoted
                    ? 'bg-[#1a1a1a] text-zinc-600 border border-[#333] cursor-not-allowed'
                    : 'bg-[#1a1a1a] hover:bg-[#ff4d00] text-white hover:text-black border border-[#333]'
                }`}
              >
                <Flame className="w-4 h-4" />
                <span>{hasVoted === 1 ? 'Voted! 🔥' : `Vote @${fighter1.username}`}</span>
              </button>
            </div>
          </div>

          {/* Fighter 2 (Blue) */}
          <div className={`bg-[#111] border rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between transition-all duration-200 ${
            hasVoted === 2
              ? 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)] ring-1 ring-blue-500'
              : 'border-[#222] hover:border-[#333]'
          }`}>
            <div>
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black shrink-0 ${fighter2.avatar_color || 'bg-blue-600 text-white'}`}>
                  {fighter2.avatar_letter}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-white text-lg truncate">@{fighter2.username}</h3>
                    <span className="text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40 px-2 py-0.5 rounded-full uppercase">
                      {fighter2.platform}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed line-clamp-3">{fighter2.bio}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs font-mono text-zinc-400">
                    <span>🔥 {fighter2.roast_count || 0} burns</span>
                    <span>▲ {fighter2.total_upvotes || 0} upvotes</span>
                  </div>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                <div className="text-[10px] font-mono uppercase text-zinc-500 font-bold">Featured Burns:</div>
                {roasts2.length > 0 ? roasts2.map(r => (
                  <div key={r.id} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-xl text-xs text-zinc-300">
                    <div className="text-[10px] text-blue-400 font-mono font-bold mb-1">{r.anon_id}</div>
                    <p>&ldquo;{r.roast_text}&rdquo;</p>
                  </div>
                )) : (
                  <p className="text-xs text-zinc-500 italic">No roasts yet. Be the first to burn this target!</p>
                )}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-[#222] flex items-center justify-between gap-3">
              <button
                onClick={() => handleVote(2)}
                disabled={!!hasVoted}
                className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  hasVoted === 2
                    ? 'bg-blue-500 text-black shadow-[0_0_20px_rgba(59,130,246,0.5)]'
                    : hasVoted
                    ? 'bg-[#1a1a1a] text-zinc-600 border border-[#333] cursor-not-allowed'
                    : 'bg-[#1a1a1a] hover:bg-blue-500 text-white hover:text-black border border-[#333]'
                }`}
              >
                <Flame className="w-4 h-4" />
                <span>{hasVoted === 2 ? 'Voted! 💀' : `Vote @${fighter2.username}`}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Next Battle */}
        <div className="flex justify-center pt-2">
          <button
            onClick={handleNext}
            className="px-6 py-3 bg-[#161616] hover:bg-[#222] text-white font-extrabold rounded-xl border border-[#333] hover:border-[#ff4d00]/50 transition-all flex items-center gap-2 text-xs uppercase tracking-wider shadow-lg active:scale-95"
          >
            <RefreshCw className="w-4 h-4 text-[#ff4d00]" />
            <span>Next Battle Matchup</span>
          </button>
        </div>
      </div>
    </div>
  );
}
