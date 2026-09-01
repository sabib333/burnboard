'use client';

import React from 'react';
import Link from 'next/link';
import { BarChart3, Flame, Users, TrendingUp, Zap, ArrowLeft, Clock } from 'lucide-react';

export default function StatsPage() {
  const hourlyActivity = [
    { hour: '12 AM', count: 12, pct: 15 },
    { hour: '3 AM', count: 8, pct: 10 },
    { hour: '6 AM', count: 18, pct: 22 },
    { hour: '9 AM', count: 54, pct: 68 },
    { hour: '12 PM', count: 72, pct: 90 },
    { hour: '3 PM', count: 80, pct: 100 },
    { hour: '6 PM', count: 65, pct: 81 },
    { hour: '9 PM', count: 48, pct: 60 }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-[#222] pb-4">
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Feed</span>
          </Link>
          <div className="flex items-center gap-2 text-[#ff4d00] font-mono font-black text-sm">
            <BarChart3 className="w-4 h-4" />
            <span>BURNBOARD TELEMETRY</span>
          </div>
        </div>

        <div className="bg-[#111] border border-[#222] rounded-3xl p-6 sm:p-8 space-y-3">
          <h1 className="text-2xl sm:text-3xl font-black font-mono">GLOBAL ROAST STATS</h1>
          <p className="text-xs text-zinc-400 font-mono">Real-time stats across all platforms and profiles.</p>
        </div>

        {/* 4 KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#111] border border-[#222] p-4 rounded-2xl">
            <span className="text-zinc-400 text-xs font-mono">Total Roasts</span>
            <div className="text-2xl font-black font-mono text-white mt-1">1,420</div>
          </div>
          <div className="bg-[#111] border border-[#222] p-4 rounded-2xl">
            <span className="text-zinc-400 text-xs font-mono">Target Profiles</span>
            <div className="text-2xl font-black font-mono text-white mt-1">128</div>
          </div>
          <div className="bg-[#111] border border-[#222] p-4 rounded-2xl">
            <span className="text-zinc-400 text-xs font-mono">Avg / Target</span>
            <div className="text-2xl font-black font-mono text-white mt-1">11.1</div>
          </div>
          <div className="bg-[#111] border border-[#222] p-4 rounded-2xl">
            <span className="text-zinc-400 text-xs font-mono">Brutal Platform</span>
            <div className="text-lg font-black font-mono text-red-400 mt-1">LinkedIn</div>
          </div>
        </div>

        {/* Hourly chart */}
        <div className="bg-[#111] border border-[#222] p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-mono font-bold text-white uppercase">Most Active Roasting Hours</h3>
            <span className="text-xs font-mono text-zinc-400">Peak: 3:00 PM</span>
          </div>
          <div className="h-36 flex items-end justify-between gap-2 pt-4 px-2 border-b border-[#222]">
            {hourlyActivity.map(slot => (
              <div key={slot.hour} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <div className="w-full bg-gradient-to-t from-amber-500 to-[#ff4d00] rounded-t" style={{ height: `${slot.pct}%` }} />
                <span className="text-[10px] font-mono text-zinc-500">{slot.hour}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
