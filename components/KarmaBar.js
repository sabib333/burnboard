import React from 'react';

export function KarmaBar({ upvotes = 20, roastsGiven = 5, streak = 1 }) {
  let level = 'Newbie';
  let badge = 'Newbie 🌱';
  let nextLevelAt = 10;
  let progress = 100;

  if (upvotes >= 200) {
    level = 'Savage';
    badge = 'Savage 💀';
    nextLevelAt = 500;
    progress = 100;
  } else if (upvotes >= 50) {
    level = 'Brutal';
    badge = 'Brutal ⚡';
    nextLevelAt = 200;
    progress = Math.min(100, Math.round(((upvotes - 50) / 150) * 100));
  } else if (upvotes >= 10) {
    level = 'Roaster';
    badge = 'Roaster 🔥';
    nextLevelAt = 50;
    progress = Math.min(100, Math.round(((upvotes - 10) / 40) * 100));
  } else {
    progress = Math.min(100, Math.round((upvotes / 10) * 100));
  }

  return (
    <div className="bg-[#111] border border-[#222] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">Karma Rank: </span>
          <span className="text-xs font-mono font-black text-amber-400">{badge}</span>
          <p className="text-[11px] text-zinc-400 font-mono mt-0.5">{upvotes} karma points</p>
        </div>
        {streak > 0 && (
          <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/30">
            🔥 {streak}d Streak
          </span>
        )}
      </div>
      <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden border border-[#262626]">
        <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
