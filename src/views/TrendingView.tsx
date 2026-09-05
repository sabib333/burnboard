import React, { useState, useEffect } from 'react';
import { TrendingUp, Flame, Clock, Filter, ArrowUpRight, Trophy, Zap } from 'lucide-react';
import { TrendingItem, TrendingFilters } from '../types';
import { fetchTrending } from '../lib/trending';
import { timeAgo } from '../lib/badWords';

interface TrendingViewProps {
  onOpenProfile: (id: string) => void;
  onShowToast: (text: string, sub?: string) => void;
}

export function TrendingView({ onOpenProfile, onShowToast }: TrendingViewProps) {
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TrendingFilters>({
    timeWindow: '24h',
    category: 'all',
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await fetchTrending(filters);
      setItems(data);
      setLoading(false);
    };
    load();
  }, [filters]);

  const timeWindows: Array<{ value: TrendingFilters['timeWindow']; label: string }> = [
    { value: '1h', label: '1H' },
    { value: '6h', label: '6H' },
    { value: '24h', label: '24H' },
    { value: '7d', label: '7D' },
  ];

  const categories: Array<{ value: TrendingFilters['category']; label: string; icon: string }> = [
    { value: 'all', label: 'All', icon: '🔥' },
    { value: 'profiles', label: 'Profiles', icon: '👤' },
    { value: 'roasts', label: 'Roasts', icon: '📝' },
    { value: 'battles', label: 'Battles', icon: '⚔️' },
  ];

  const getItemIcon = (type: TrendingItem['type']) => {
    switch (type) {
      case 'profile': return '👤';
      case 'roast': return '🔥';
      case 'battle': return '⚔️';
      default: return '🔥';
    }
  };

  const getVelocityColor = (velocity: number) => {
    if (velocity >= 50) return 'text-red-400';
    if (velocity >= 20) return 'text-orange-400';
    if (velocity >= 5) return 'text-yellow-400';
    return 'text-zinc-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-5 h-5 text-[#ff4d00]" />
        <h1 className="text-lg font-black text-white uppercase font-mono">TRENDING</h1>
      </div>

      {/* Time Window Filter */}
      <div className="flex items-center gap-2">
        {timeWindows.map(tw => (
          <button
            key={tw.value}
            onClick={() => setFilters(prev => ({ ...prev, timeWindow: tw.value }))}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              filters.timeWindow === tw.value
                ? 'bg-[#ff4d00] text-black'
                : 'bg-[#141414] text-zinc-400 border border-[#262626] hover:border-[#3a3a3a]'
            }`}
          >
            {tw.label}
          </button>
        ))}
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat.value}
            onClick={() => setFilters(prev => ({ ...prev, category: cat.value }))}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1 ${
              filters.category === cat.value
                ? 'bg-[#ff4d00] text-black'
                : 'bg-[#141414] text-zinc-400 border border-[#262626] hover:border-[#3a3a3a]'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Trending Items */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-[#111] border border-[#222] rounded-2xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#222]" />
                <div className="flex-1">
                  <div className="h-3 bg-[#222] rounded w-32 mb-2" />
                  <div className="h-2 bg-[#222] rounded w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-[#111] border border-dashed border-[#222] rounded-2xl">
          <TrendingUp className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">Nothing trending yet. Come back later!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => {
                if (item.type === 'profile') onOpenProfile(item.id);
                else onShowToast('View details', 'Navigate to the feed to see this item.');
              }}
              className="w-full bg-[#111] hover:bg-[#151515] border border-[#222] hover:border-[#333] rounded-2xl p-4 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                {/* Rank */}
                <div className="w-8 h-8 rounded-lg bg-[#141414] border border-[#262626] flex items-center justify-center shrink-0">
                  {index < 3 ? (
                    <Trophy className={`w-4 h-4 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-zinc-400' : 'text-amber-700'}`} />
                  ) : (
                    <span className="text-xs font-mono font-bold text-zinc-500">{index + 1}</span>
                  )}
                </div>

                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-[#141414] border border-[#262626] flex items-center justify-center text-lg shrink-0">
                  {getItemIcon(item.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white truncate">{item.title}</h3>
                    {item.platform && (
                      <span className="text-[10px] font-mono text-zinc-500 bg-[#141414] px-1.5 py-0.5 rounded border border-[#222]">
                        {item.platform}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 truncate">{item.subtitle}</p>
                </div>

                {/* Score + Velocity */}
                <div className="text-right shrink-0">
                  <div className="text-sm font-black text-white font-mono">{item.score}</div>
                  <div className={`text-[10px] font-mono flex items-center gap-0.5 justify-end ${getVelocityColor(item.velocity)}`}>
                    <Zap className="w-3 h-3" />
                    {item.velocity}
                  </div>
                </div>

                {/* Arrow */}
                <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-[#ff4d00] transition-colors shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
