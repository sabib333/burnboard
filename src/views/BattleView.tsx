import React, { useState, useEffect, useCallback } from 'react';
import { Swords, Flame, Sparkles, RefreshCw, Trophy, ArrowRight, Zap, Crown, Loader2 } from 'lucide-react';
import { Battle, Profile, Roast } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import confetti from 'canvas-confetti';

interface BattleViewProps {
  battles: Battle[];
  profiles: Profile[];
  roasts: Roast[];
  onVoteBattle: (battleId: string, candidate: 1 | 2) => void;
  onNextBattle: () => void;
  onOpenProfile: (profileId: string) => void;
  onShowToast: (text: string, subtext?: string) => void;
}

export const BattleView: React.FC<BattleViewProps> = ({
  battles,
  profiles,
  roasts,
  onVoteBattle,
  onNextBattle,
  onOpenProfile,
  onShowToast
}) => {
  const [loading, setLoading] = useState(true);
  const [hasVoted, setHasVoted] = useState<1 | 2 | null>(null);
  const [liveBattles, setLiveBattles] = useState<Battle[]>(battles);
  const [liveProfiles, setLiveProfiles] = useState<Profile[]>(profiles);

  useEffect(() => {
    setLiveBattles(battles);
    setLiveProfiles(profiles);
    setLoading(false);
  }, [battles, profiles]);

  // Randomly select 2 profiles for the battle
  const [fighter1, setFighter1] = useState<Profile | null>(null);
  const [fighter2, setFighter2] = useState<Profile | null>(null);
  const [activeBattle, setActiveBattle] = useState<Battle | null>(null);

  const pickRandomFighters = useCallback(() => {
    if (liveProfiles.length < 2) return;
    const shuffled = [...liveProfiles].sort(() => 0.5 - Math.random());
    setFighter1(shuffled[0]);
    setFighter2(shuffled[1]);
    setHasVoted(null);
  }, [liveProfiles]);

  useEffect(() => {
    if (liveProfiles.length >= 2 && !fighter1) {
      pickRandomFighters();
    }
  }, [liveProfiles, fighter1, pickRandomFighters]);

  // Find or create battle for the current pair
  useEffect(() => {
    if (!fighter1 || !fighter2) return;

    const existingBattle = liveBattles.find(b =>
      (b.profile1_id === fighter1.id && b.profile2_id === fighter2.id) ||
      (b.profile1_id === fighter2.id && b.profile2_id === fighter1.id)
    );

    if (existingBattle) {
      setActiveBattle(existingBattle);
    } else {
      // Create new battle in Supabase
      const createBattle = async () => {
        if (!isSupabaseConfigured || !supabase) return;
        try {
          const { data } = await supabase
            .from('battles')
            .insert({
              profile1_id: fighter1.id,
              profile2_id: fighter2.id,
              votes1: 0,
              votes2: 0,
            })
            .select()
            .single();

          if (data) {
            setActiveBattle(data as Battle);
            setLiveBattles(prev => [data as Battle, ...prev]);
          }
        } catch (err) {
          console.warn('Failed to create battle:', err);
        }
      };
      createBattle();
    }
  }, [fighter1, fighter2, liveBattles]);

  // Realtime subscription for battle votes
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !activeBattle) return;

    const channel = supabase
      .channel(`battle-${activeBattle.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battles',
          filter: `id=eq.${activeBattle.id}`,
        },
        (payload) => {
          const updated = payload.new as Battle;
          setActiveBattle(updated);
          setLiveBattles(prev => prev.map(b => b.id === updated.id ? updated : b));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBattle?.id]);

  const p1 = fighter1;
  const p2 = fighter2;
  const roasts1 = p1 ? roasts.filter(r => r.profile_id === p1.id).slice(0, 2) : [];
  const roasts2 = p2 ? roasts.filter(r => r.profile_id === p2.id).slice(0, 2) : [];

  // Vote calculation from REAL battle data
  const totalVotes = (activeBattle?.votes1 || 0) + (activeBattle?.votes2 || 0);
  const pct1 = totalVotes > 0 ? Math.round(((activeBattle?.votes1 || 0) / totalVotes) * 100) : 50;
  const pct2 = 100 - pct1;

  const handleVote = (candidate: 1 | 2) => {
    if (!activeBattle) return;
    setHasVoted(candidate);

    confetti({
      particleCount: 40,
      spread: 60,
      origin: { x: candidate === 1 ? 0.3 : 0.7, y: 0.6 },
      colors: candidate === 1 ? ['#ff4d00', '#ff8533', '#ffffff'] : ['#3b82f6', '#60a5fa', '#ffffff']
    });

    onVoteBattle(activeBattle.id, candidate);
    const targetName = candidate === 1 ? p1?.username : p2?.username;
    onShowToast(`Voted for @${targetName}!`, 'Your burn vote has been counted.');
  };

  const handleNext = () => {
    setHasVoted(null);
    setActiveBattle(null);
    setFighter1(null);
    setFighter2(null);
    // pickRandomFighters will be called in useEffect when fighters are null
    setTimeout(() => pickRandomFighters(), 100);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-[#111] border border-[#222] rounded-2xl p-6 animate-pulse text-center">
          <div className="h-6 bg-[#222] rounded w-64 mx-auto mb-2" />
          <div className="h-3 bg-[#222] rounded w-80 mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="bg-[#111] border border-[#222] rounded-2xl p-5 animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-[#222]" />
                <div className="flex-1">
                  <div className="h-4 bg-[#222] rounded w-32 mb-2" />
                  <div className="h-3 bg-[#222] rounded w-48" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-[#222] rounded w-full" />
                <div className="h-3 bg-[#222] rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state: Less than 2 profiles
  if (liveProfiles.length < 2) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-950/40 via-[#111] to-blue-950/40 border border-[#333] rounded-2xl p-5 sm:p-6 text-center relative overflow-hidden shadow-2xl">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Swords className="w-6 h-6 text-[#ff4d00]" />
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-tight">
              Roast Arena: Head-to-Head Battle
            </h1>
            <Swords className="w-6 h-6 text-blue-400" />
          </div>
        </div>

        {/* Empty State */}
        <div className="bg-[#111] border border-dashed border-[#333] rounded-2xl p-10 text-center">
          <div className="text-5xl mb-4">⚔️</div>
          <h3 className="text-lg font-bold text-white uppercase tracking-wider">Need more targets</h3>
          <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto">
            Battles require at least 2 profiles. Currently at <span className="text-[#ff4d00] font-bold">{liveProfiles.length}/2</span>.
            Invite friends to get roasted!
          </p>
          <button
            onClick={() => window.location.hash = '#submit'}
            className="mt-6 px-6 py-3 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-extrabold rounded-xl text-sm uppercase tracking-wider transition-colors"
          >
            Submit a Target
          </button>
        </div>
      </div>
    );
  }

  if (!p1 || !p2 || !activeBattle) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#ff4d00] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          Who got destroyed harder by real humans? Vote to decide the ultimate roasted champion.
        </p>

        {/* Global vote bar — REAL DATA */}
        <div className="mt-5 max-w-xl mx-auto">
          <div className="flex justify-between text-xs font-mono font-bold mb-1.5 px-1">
            <span className="text-[#ff4d00]">@{p1.username} ({pct1}%)</span>
            <span className="text-zinc-500">{totalVotes.toLocaleString()} TOTAL VOTES</span>
            <span className="text-blue-400">@{p2.username} ({pct2}%)</span>
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

      {/* Arena Fighters Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
        {/* VS Center Indicator for Desktop */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-[#0a0a0a] border-2 border-[#ff4d00] flex items-center justify-center shadow-[0_0_25px_rgba(255,77,0,0.6)] animate-pulse">
            <span className="font-black text-white italic text-lg tracking-tighter">VS</span>
          </div>
        </div>

        {/* Fighter 1 (Left / Red) */}
        <div
          className={`bg-[#111] border rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between transition-all duration-200 ${
            hasVoted === 1
              ? 'border-[#ff4d00] shadow-[0_0_30px_rgba(255,77,0,0.3)] ring-1 ring-[#ff4d00]'
              : 'border-[#222] hover:border-[#333]'
          }`}
        >
          <div>
            <div className="flex items-start gap-4">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black shrink-0 ${
                  p1.avatar_color || 'bg-[#ff4d00] text-black'
                }`}
              >
                {p1.avatar_letter}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-white text-lg truncate">@{p1.username}</h3>
                  <span className="text-[10px] font-bold bg-[#ff4d00]/20 text-[#ff4d00] border border-[#ff4d00]/40 px-2 py-0.5 rounded-full uppercase">
                    {p1.platform}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed line-clamp-3">{p1.bio}</p>
                <div className="flex items-center gap-3 mt-2 text-xs font-mono text-zinc-400">
                  <span>🔥 {p1.roast_count} burns</span>
                  <span>▲ {p1.total_upvotes} upvotes</span>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <div className="text-[10px] font-mono uppercase text-zinc-500 font-bold">Featured Burns:</div>
              {roasts1.length > 0 ? roasts1.map(r => (
                <div key={r.id} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-xl text-xs text-zinc-300">
                  <div className="text-[10px] text-[#ff4d00] font-mono font-bold mb-1">{r.anon_id}</div>
                  <p>"{r.roast_text}"</p>
                </div>
              )) : (
                <p className="text-xs text-zinc-500 italic">No roasts yet. Be the first to burn this target!</p>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#222] flex items-center justify-between gap-3">
            <button
              onClick={() => handleVote(1)}
              className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                hasVoted === 1
                  ? 'bg-[#ff4d00] text-black shadow-[0_0_20px_rgba(255,77,0,0.5)]'
                  : 'bg-[#1a1a1a] hover:bg-[#ff4d00] text-white hover:text-black border border-[#333]'
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>{hasVoted === 1 ? 'Voted! 🔥' : `Vote @${p1.username}`}</span>
            </button>
            <button
              onClick={() => onOpenProfile(p1.id)}
              className="p-3 bg-[#161616] hover:bg-[#222] text-zinc-400 hover:text-white rounded-xl border border-[#2b2b2b] text-xs font-mono transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Fighter 2 (Right / Blue) */}
        <div
          className={`bg-[#111] border rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between transition-all duration-200 ${
            hasVoted === 2
              ? 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)] ring-1 ring-blue-500'
              : 'border-[#222] hover:border-[#333]'
          }`}
        >
          <div>
            <div className="flex items-start gap-4">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black shrink-0 ${
                  p2.avatar_color || 'bg-blue-600 text-white'
                }`}
              >
                {p2.avatar_letter}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-white text-lg truncate">@{p2.username}</h3>
                  <span className="text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40 px-2 py-0.5 rounded-full uppercase">
                    {p2.platform}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed line-clamp-3">{p2.bio}</p>
                <div className="flex items-center gap-3 mt-2 text-xs font-mono text-zinc-400">
                  <span>🔥 {p2.roast_count} burns</span>
                  <span>▲ {p2.total_upvotes} upvotes</span>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <div className="text-[10px] font-mono uppercase text-zinc-500 font-bold">Featured Burns:</div>
              {roasts2.length > 0 ? roasts2.map(r => (
                <div key={r.id} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-xl text-xs text-zinc-300">
                  <div className="text-[10px] text-blue-400 font-mono font-bold mb-1">{r.anon_id}</div>
                  <p>"{r.roast_text}"</p>
                </div>
              )) : (
                <p className="text-xs text-zinc-500 italic">No roasts yet. Be the first to burn this target!</p>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#222] flex items-center justify-between gap-3">
            <button
              onClick={() => handleVote(2)}
              className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                hasVoted === 2
                  ? 'bg-blue-500 text-black shadow-[0_0_20px_rgba(59,130,246,0.5)]'
                  : 'bg-[#1a1a1a] hover:bg-blue-500 text-white hover:text-black border border-[#333]'
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>{hasVoted === 2 ? 'Voted! 💀' : `Vote @${p2.username}`}</span>
            </button>
            <button
              onClick={() => onOpenProfile(p2.id)}
              className="p-3 bg-[#161616] hover:bg-[#222] text-zinc-400 hover:text-white rounded-xl border border-[#2b2b2b] text-xs font-mono transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Next Battle Action */}
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
  );
};
