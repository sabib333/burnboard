import React, { useState, useEffect } from 'react';
import { Trophy, Flame, Crown, Clock, TrendingUp, Sparkles, ChevronRight, RefreshCw } from 'lucide-react';
import { Profile, Roast } from '../types';

interface LeaderboardLiveProps {
  profiles: Profile[];
  roasts: Roast[];
  onSelectProfile: (profileId: string) => void;
  className?: string;
}

export const LeaderboardLive: React.FC<LeaderboardLiveProps> = ({
  profiles,
  roasts,
  onSelectProfile,
  className = ''
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'week'>('all');
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(30);

  // 30-second auto refresh ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsUntilRefresh(prev => {
        if (prev <= 1) {
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Compute stats for This Week vs All Time
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const rankedProfiles = profiles.map(profile => {
    const profileRoasts = roasts.filter(r => r.profile_id === profile.id);
    const weeklyRoasts = profileRoasts.filter(r => new Date(r.created_at).getTime() >= sevenDaysAgo);
    const weeklyCount = weeklyRoasts.length;
    const allTimeCount = profile.roast_count || profileRoasts.length;

    return {
      ...profile,
      displayCount: filterMode === 'week' ? weeklyCount : allTimeCount,
      weeklyCount,
      allTimeCount,
      isHotStreak: (filterMode === 'week' ? weeklyCount : allTimeCount) > 10
    };
  });

  const sortedProfiles = [...rankedProfiles]
    .sort((a, b) => b.displayCount - a.displayCount)
    .slice(0, 10);

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-400/20 text-amber-300 font-mono font-black text-xs border border-amber-400/50 shadow-[0_0_10px_rgba(251,191,36,0.3)]">
          <Crown className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-300/20 text-zinc-200 font-mono font-black text-xs border border-zinc-300/50">
          2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-500 font-mono font-black text-xs border border-amber-700/50">
          3
        </span>
      );
    }
    return (
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#181818] text-zinc-400 font-mono font-bold text-xs border border-[#262626]">
        {rank}
      </span>
    );
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-amber-300';
    if (rank === 2) return 'text-zinc-200';
    if (rank === 3) return 'text-amber-500';
    return 'text-white';
  };

  return (
    <div className={`bg-[#111111] border border-[#222222] rounded-2xl p-4 shadow-xl space-y-3.5 ${className}`}>
      {/* Header & Live Ticker */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-mono font-black uppercase tracking-wider text-white">
            Live Burn Leaderboard
          </h3>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>{secondsUntilRefresh}s</span>
        </div>
      </div>

      {/* Filter Tabs: All Time vs This Week */}
      <div className="grid grid-cols-2 gap-1 bg-[#0a0a0a] p-1 rounded-xl border border-[#262626]">
        <button
          onClick={() => setFilterMode('all')}
          className={`py-1 rounded-lg text-xs font-mono font-bold transition-all ${
            filterMode === 'all'
              ? 'bg-[#ff4d00] text-black shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          All Time
        </button>
        <button
          onClick={() => setFilterMode('week')}
          className={`py-1 rounded-lg text-xs font-mono font-bold transition-all ${
            filterMode === 'week'
              ? 'bg-[#ff4d00] text-black shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          This Week
        </button>
      </div>

      {/* Top 10 List */}
      <div className="space-y-1.5">
        {sortedProfiles.map((p, index) => {
          const rank = index + 1;
          return (
            <div
              key={p.id}
              onClick={() => onSelectProfile(p.id)}
              className="flex items-center justify-between p-2 rounded-xl bg-[#0e0e0e] hover:bg-[#181818] border border-[#1f1f1f] hover:border-[#333] transition-all cursor-pointer group hover:scale-[1.01]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {getRankBadge(rank)}

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold truncate ${getRankColor(rank)}`}>
                      @{p.username}
                    </span>
                    {rank === 1 && <span className="text-xs">👑</span>}
                    {p.isHotStreak && (
                      <span
                        title="Fire streak (>10 burns)"
                        className="text-xs animate-pulse"
                      >
                        🔥
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase">
                    {p.platform}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-right shrink-0">
                <div className="text-right">
                  <div className="text-xs font-mono font-black text-[#ff4d00]">
                    {p.displayCount}
                  </div>
                  <div className="text-[9px] font-mono text-zinc-400 uppercase">
                    burns
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
              </div>
            </div>
          );
        })}

        {sortedProfiles.length === 0 && (
          <div className="p-4 text-center text-xs text-zinc-500 font-mono">
            No active roastees yet
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardLive;
