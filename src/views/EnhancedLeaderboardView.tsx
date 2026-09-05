import React, { useState, useEffect } from 'react';
import { Trophy, Flame, Zap, TrendingUp, ArrowLeft, Crown, Medal, Award } from 'lucide-react';
import { LeaderboardEntry, LeaderboardCategory, LeaderboardType } from '../types';
import { fetchLeaderboard, getLeaderboardTypeLabel, getCategoryLabel } from '../lib/leaderboards';
import { useAuth } from '../lib/auth';

interface EnhancedLeaderboardViewProps {
  onBack: () => void;
  onOpenProfile?: (id: string) => void;
  onShowToast: (text: string, sub?: string) => void;
}

export function EnhancedLeaderboardView({ onBack, onOpenProfile, onShowToast }: EnhancedLeaderboardViewProps) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<LeaderboardType>('burn_score');
  const [category, setCategory] = useState<LeaderboardCategory>('alltime');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await fetchLeaderboard(type, category, 20);
      setEntries(data);
      setLoading(false);
    };
    load();
  }, [type, category]);

  const types: Array<{ value: LeaderboardType; label: string; icon: React.ReactNode }> = [
    { value: 'burn_score', label: 'Burn Score', icon: <Flame className="w-3.5 h-3.5" /> },
    { value: 'most_roasted', label: 'Most Roasted', icon: <Target className="w-3.5 h-3.5" /> },
    { value: 'funniest', label: 'Funniest', icon: <span className="text-xs">😂</span> },
    { value: 'streak', label: 'Streak', icon: <Zap className="w-3.5 h-3.5" /> },
  ];

  const categories: Array<{ value: LeaderboardCategory; label: string }> = [
    { value: 'alltime', label: 'All Time' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'daily', label: 'Daily' },
    { value: 'monthly', label: 'Monthly' },
  ];

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />;
      case 2: return <Medal className="w-5 h-5 text-zinc-400" />;
      case 3: return <Award className="w-5 h-5 text-amber-600" />;
      default: return <span className="text-sm font-mono font-bold text-zinc-500 w-5 text-center">{rank}</span>;
    }
  };

  const getScoreDisplay = (entry: LeaderboardEntry) => {
    switch (type) {
      case 'burn_score': return entry.burn_score;
      case 'most_roasted': return entry.total_roasts;
      case 'funniest': return entry.total_upvotes;
      case 'streak': return entry.streak;
      default: return entry.burn_score;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h1 className="text-lg font-black text-white uppercase font-mono">LEADERBOARD</h1>
        </div>
      </div>

      {/* Type Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {types.map(t => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition-all ${
              type === t.value
                ? 'bg-[#ff4d00] text-black'
                : 'bg-[#141414] text-zinc-400 border border-[#262626] hover:border-[#3a3a3a]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2">
        {categories.map(cat => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all ${
              category === cat.value
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Leaderboard List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-[#111] border border-[#222] rounded-xl p-3 animate-pulse flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#222]" />
              <div className="flex-1">
                <div className="h-3 bg-[#222] rounded w-24 mb-1" />
                <div className="h-2 bg-[#222] rounded w-16" />
              </div>
              <div className="h-6 bg-[#222] rounded w-12" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 bg-[#111] border border-dashed border-[#222] rounded-2xl">
          <Trophy className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">No entries yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <button
              key={entry.user_id}
              onClick={() => onOpenProfile?.(entry.user_id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                entry.user_id === user?.id
                  ? 'bg-[#ff4d00]/10 border border-[#ff4d00]/30'
                  : 'bg-[#111] border border-[#222] hover:border-[#333]'
              }`}
            >
              {/* Rank */}
              <div className="w-8 flex items-center justify-center shrink-0">
                {getRankIcon(entry.rank)}
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white truncate">
                    @{entry.username}
                  </span>
                  {entry.user_id === user?.id && (
                    <span className="text-[10px] font-mono text-[#ff4d00] bg-[#ff4d00]/10 px-1.5 py-0.5 rounded">YOU</span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-500 font-mono">
                  {entry.level} • {entry.total_roasts} roasts • {entry.streak}d streak
                </div>
              </div>

              {/* Score */}
              <div className="text-right shrink-0">
                <div className="text-lg font-black text-white font-mono">
                  {getScoreDisplay(entry)}
                </div>
                <div className="text-[10px] font-mono text-zinc-500">
                  {type === 'burn_score' ? 'score' : type === 'streak' ? 'days' : 'count'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper component for the Target icon
function Target({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
