'use client';

import React, { useState } from 'react';
import { Globe, Flame, Filter, Trophy, Share2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const GLOBAL_COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸', percentage: 45, totalBurns: 45200, topPlatform: 'LinkedIn', brutalityRating: 9.4 },
  { code: 'IN', name: 'India', flag: '🇮🇳', percentage: 20, totalBurns: 20100, topPlatform: 'X', brutalityRating: 9.6 },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', percentage: 15, totalBurns: 15400, topPlatform: 'GitHub', brutalityRating: 9.1 },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', percentage: 8, totalBurns: 8300, topPlatform: 'Facebook', brutalityRating: 9.8 },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', percentage: 5, totalBurns: 5100, topPlatform: 'GitHub', brutalityRating: 8.9 },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', percentage: 4, totalBurns: 4200, topPlatform: 'LinkedIn', brutalityRating: 8.7 },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', percentage: 3, totalBurns: 3100, topPlatform: 'Instagram', brutalityRating: 9.2 }
];

export default function WorldRoastPage() {
  const [platformFilter, setPlatformFilter] = useState('all');

  const filtered = GLOBAL_COUNTRIES.filter(c => {
    if (platformFilter === 'all') return true;
    return c.topPlatform.toLowerCase().includes(platformFilter);
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-[#222] pb-4">
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Feed</span>
          </Link>
          <div className="flex items-center gap-2 text-[#ff4d00] font-mono font-black text-sm">
            <Flame className="w-4 h-4 fill-[#ff4d00]" />
            <span>BURNBOARD WORLD MAP</span>
          </div>
        </div>

        {/* Hero */}
        <div className="bg-gradient-to-r from-[#1c1200] via-[#111] to-[#0a0a0a] border-2 border-amber-500/60 rounded-3xl p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-mono font-black text-amber-400 uppercase tracking-wider">
              Global Savage Heatmap
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-mono">WORLD ROAST LEADERBOARD</h1>
          <p className="text-xs sm:text-sm text-zinc-400 font-mono">
            Track which countries are dishing out and receiving the heaviest burns on earth.
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center justify-between bg-[#111] p-3 rounded-2xl border border-[#222]">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <Filter className="w-4 h-4 text-amber-500" />
            <span>Platform:</span>
          </div>
          <div className="flex gap-2">
            {['all', 'linkedin', 'x', 'github'].map(p => (
              <button
                key={p}
                onClick={() => setPlatformFilter(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold capitalize ${
                  platformFilter === p ? 'bg-amber-500 text-black' : 'bg-[#181818] text-zinc-400 border border-[#262626]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Country List */}
        <div className="space-y-3">
          {filtered.map((c, i) => (
            <div key={c.code} className="bg-[#111] border border-[#222] rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{c.flag}</span>
                  <div>
                    <h3 className="font-mono font-bold text-white text-base">#{i + 1} {c.name}</h3>
                    <p className="text-xs font-mono text-zinc-400">{c.totalBurns.toLocaleString()} burns • {c.topPlatform}</p>
                  </div>
                </div>
                <span className="text-xl font-mono font-black text-amber-400">{c.percentage}%</span>
              </div>
              <div className="w-full h-2.5 bg-[#181818] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-500 to-[#ff4d00]" style={{ width: `${c.percentage * 2}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
