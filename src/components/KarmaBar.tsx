import React from 'react';
import { calculateKarmaLevel } from '../lib/karma';
import { Award, Zap, Flame, ShieldCheck } from 'lucide-react';

interface KarmaBarProps {
  upvotes: number;
  roastsGiven: number;
  streak?: number;
  className?: string;
}

export const KarmaBar: React.FC<KarmaBarProps> = ({
  upvotes,
  roastsGiven,
  streak = 1,
  className = ''
}) => {
  const { level, badge, nextLevelAt, progress } = calculateKarmaLevel(upvotes);

  const levelColors = {
    Newbie: 'from-emerald-500 to-teal-400 text-emerald-400',
    Roaster: 'from-orange-500 to-amber-400 text-orange-400',
    Brutal: 'from-red-600 to-orange-500 text-red-400',
    Savage: 'from-purple-600 via-pink-600 to-amber-400 text-purple-300'
  };

  return (
    <div className={`bg-[#111] border border-[#222] rounded-2xl p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
            <Award className="w-4 h-4 text-[#ff4d00]" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Karma Rank
              </span>
              <span className={`text-[11px] font-mono font-black px-2 py-0.5 rounded-full bg-[#1a1a1a] border border-[#333] ${levelColors[level]}`}>
                {badge}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">
              {upvotes} karma points • {roastsGiven} roasts delivered
            </p>
          </div>
        </div>

        {streak > 0 && (
          <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-mono font-bold">
            <Flame className="w-3.5 h-3.5 fill-amber-400" />
            <span>{streak}d Streak</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-mono text-zinc-400">
          <span>Level: {level}</span>
          <span>Next tier: {nextLevelAt} pts ({progress}%)</span>
        </div>
        <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden border border-[#262626]">
          <div
            className={`h-full bg-gradient-to-r ${levelColors[level]} transition-all duration-500 rounded-full`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
