import React, { useState, useEffect } from 'react';
import { Flame, Zap, TrendingUp, Trophy } from 'lucide-react';
import { BurnScoreData, BurnScoreBreakdown } from '../types';
import { fetchBurnScore, calculateBurnScoreBreakdown, getLevelFromScore } from '../lib/burnScore';

interface BurnScoreCardProps {
  userId: string;
  compact?: boolean;
}

export function BurnScoreCard({ userId, compact = false }: BurnScoreCardProps) {
  const [score, setScore] = useState<BurnScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await fetchBurnScore(userId);
      setScore(data);
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading || !score) {
    return (
      <div className={`bg-[#111] border border-[#222] rounded-xl ${compact ? 'p-3' : 'p-4'} animate-pulse`}>
        <div className="h-3 bg-[#222] rounded w-20 mb-2" />
        <div className="h-6 bg-[#222] rounded w-16" />
      </div>
    );
  }

  const levelInfo = getLevelFromScore(score.burn_score);

  if (compact) {
    return (
      <div className="flex items-center gap-2 bg-[#141414] border border-[#222] rounded-lg px-2 py-1">
        <Flame className="w-3 h-3 text-[#ff4d00]" />
        <span className="text-xs font-mono font-bold text-white">{score.burn_score}</span>
        <span className="text-[10px] font-mono" style={{ color: levelInfo.color }}>
          {levelInfo.badge}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-[#1a0a00] to-[#111] border border-[#ff4d00]/20 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-[#ff4d00] fill-[#ff4d00]" />
          <span className="text-xs font-mono font-black text-zinc-300 uppercase">Burn Score</span>
        </div>
        <span
          className="text-xs font-mono font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${levelInfo.color}20`, color: levelInfo.color }}
        >
          {levelInfo.badge} {score.level}
        </span>
      </div>

      <div className="text-3xl font-black text-white font-mono mb-3">{score.burn_score}</div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-[#0a0a0a] rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${levelInfo.progress}%`,
            backgroundColor: levelInfo.color,
          }}
        />
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-500" />
          <span className="text-white font-bold">{score.total_roasts}</span>
          <span>roasts</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-green-500" />
          <span className="text-white font-bold">{score.total_upvotes}</span>
          <span>upvotes</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-white font-bold">{score.streak}</span>
          <span>streak</span>
        </div>
      </div>
    </div>
  );
}
