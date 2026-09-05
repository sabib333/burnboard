'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Flame, Trophy, Skull, Swords, ArrowLeft, Plus, Loader2,
  TrendingUp, Calendar, Sparkles, ArrowUpRight
} from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { t } from '@/lib/lang';

// ── SWR Fetcher ──────────────────────────────────────────────
const fetchRecap = async (period) => {
  const params = new URLSearchParams({ period });
  const res = await fetch(`/api/weekly-recap?${params}`);
  if (!res.ok) throw new Error('Failed to fetch recap');
  return res.json();
};

// ── Period Tabs ──────────────────────────────────────────────
const PERIODS = [
  { key: 'this_week', label: 'This Week', emoji: '📅' },
  { key: 'last_week', label: 'Last Week', emoji: '📆' },
];

// ── Score Weight Badge ───────────────────────────────────────
function ScoreBadge({ score, label, color }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${color}`}>
      <span className="text-lg">{label}</span>
      <span className="font-mono font-black text-sm">{score}</span>
    </div>
  );
}

// ── Highlight Card ───────────────────────────────────────────
function HighlightCard({ emoji, title, color, children }) {
  return (
    <div className={`bg-[#111] border ${color} rounded-2xl p-5 space-y-3`}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{emoji}</span>
        <h3 className="text-sm font-black uppercase tracking-wider font-mono">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Stat Counter ─────────────────────────────────────────────
function StatCounter({ value, label, emoji }) {
  return (
    <div className="text-center">
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-xl font-black text-white font-mono">{value.toLocaleString()}</div>
      <div className="text-[10px] text-zinc-500 font-mono uppercase">{label}</div>
    </div>
  );
}

// ── Platform Badge ───────────────────────────────────────────
function getPlatformBadge(platform) {
  switch (platform?.toLowerCase()) {
    case 'x': case 'x / twitter': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'linkedin': return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    case 'github': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'instagram': return 'bg-pink-500/15 text-pink-400 border-pink-500/30';
    default: return 'bg-[#ff4d00]/15 text-[#ff4d00] border-[#ff4d00]/30';
  }
}

// ── Category Emoji ───────────────────────────────────────────
const CATEGORIES = {
  photo: '📸', vibe: '✨', bio: '📝', outfit: '👕',
  idea: '💡', dating_profile: '💘', music_taste: '🎵', hot_take: '🔥',
};

// ── Grand Empty State ────────────────────────────────────────
function GrandEmptyState({ period }) {
  return (
    <div className="bg-gradient-to-br from-[#1a0a00] via-[#111] to-[#0a0a0a] border-2 border-[#ff4d00]/30 rounded-3xl p-10 text-center space-y-4 shadow-[0_0_40px_rgba(255,77,0,0.1)]">
      <div className="text-5xl">📭</div>
      <h2 className="text-xl font-black text-white uppercase tracking-wider">
        {period === 'last_week' ? 'NO RECAP AVAILABLE' : 'NO HIGHLIGHTS YET'}
      </h2>
      <p className="text-xs text-zinc-400 max-w-sm mx-auto">
        {period === 'last_week' 
          ? 'There was no activity last week. This week is your chance to change that!'
          : 'This week hasn\'t produced any highlights yet. Get roasted and make the list!'}
      </p>
      <Link
        href="/hot-seat"
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff4d00] text-black font-black text-sm rounded-xl hover:bg-[#ff6622] transition-all shadow-[0_0_30px_rgba(255,77,0,0.4)] uppercase tracking-wider"
      >
        🔥 PUT YOURSELF ON THE HOT SEAT
      </Link>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function WeeklyPage() {
  const [activePeriod, setActivePeriod] = useState('this_week');

  const { data, error, isLoading } = useSWR(
    ['weekly-recap', activePeriod],
    () => fetchRecap(activePeriod),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 60000,
    }
  );

  const recap = data?.recap;
  const hasHighlights = recap && (
    recap.mostCooked || recap.funniestRoast || 
    recap.mostSavageRoast || recap.mostFatalRoast || recap.topBattle
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <header className="space-y-4 py-4">
          <AppHeader backLink="/" backLabel="BURN BOARD" />

          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-[#ff4d00]">
              <Calendar className="w-6 h-6" />
              <h1 className="text-xl font-black uppercase tracking-wider font-mono">{t('weekly_title')}</h1>
            </div>
            <p className="text-xs text-zinc-400 font-mono uppercase tracking-wider">
              🔥 {t('weekly_subtitle')} 🔥
            </p>
          </div>
        </header>

        {/* Period Tabs */}
        <div className="flex items-center justify-center gap-1 bg-[#111] p-1 rounded-xl border border-[#222] max-w-xs mx-auto">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setActivePeriod(p.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[11px] font-mono font-bold whitespace-nowrap transition-all flex-1 justify-center ${
                activePeriod === p.key
                  ? 'bg-[#ff4d00] text-black'
                  : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
              }`}
            >
              <span>{p.emoji}</span>
              {p.label}
            </button>
          ))}
        </div>

        {/* Week Range */}
        {recap?.weekRange && (
          <div className="text-center text-[11px] font-mono text-zinc-500">
            {recap.weekRange}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-[#111] border border-[#222] rounded-2xl p-5 animate-pulse space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#222]" />
                  <div className="w-32 h-4 bg-[#222] rounded" />
                </div>
                <div className="w-full h-12 bg-[#1a1a1a] rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-6 text-center">
            <p className="text-sm text-red-400 font-mono">Failed to load weekly recap</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && !hasHighlights && (
          <GrandEmptyState period={activePeriod} />
        )}

        {/* Weekly Recap Content */}
        {!isLoading && !error && hasHighlights && (
          <div className="space-y-6">
            {/* Week Stats */}
            {recap.stats && (
              <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
                <div className="grid grid-cols-5 gap-2">
                  <StatCounter value={recap.stats.hotSeats} label="Hot Seats" emoji="🪑" />
                  <StatCounter value={recap.stats.roasts} label="Roasts" emoji="📝" />
                  <StatCounter value={recap.stats.reactions} label="Reactions" emoji="🔥" />
                  <StatCounter value={recap.stats.battles} label="Battles" emoji="⚔️" />
                  <StatCounter value={recap.stats.votes} label="Votes" emoji="🗳️" />
                </div>
              </div>
            )}

            {/* Most Cooked */}
            {recap.mostCooked && (
              <HighlightCard
                emoji="🔥"
                title="Most Cooked"
                color="border-[#ff4d00]/40"
              >
                <Link href={recap.mostCooked.link}>
                  <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 hover:border-[#ff4d00]/40 transition-all group cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{CATEGORIES[recap.mostCooked.category] || '🔥'}</span>
                      <div>
                        <p className="text-base font-bold text-white group-hover:text-[#ff4d00] transition-colors">
                          {recap.mostCooked.title}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          by {recap.mostCooked.displayName || 'Anonymous'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono">
                      <ScoreBadge score={recap.mostCooked.burnScore} label="🔥" color="bg-[#ff4d00]/10 text-[#ff4d00] border-[#ff4d00]/30" />
                      <span className="text-zinc-500">
                        {recap.mostCooked.roastCount} burns · {recap.mostCooked.totalReactions} reactions
                      </span>
                    </div>
                  </div>
                </Link>
              </HighlightCard>
            )}

            {/* Funniest Roast */}
            {recap.funniestRoast && (
              <HighlightCard
                emoji="😂"
                title="Funniest Roast"
                color="border-yellow-500/40"
              >
                <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4">
                  <p className="text-sm text-zinc-100 leading-relaxed mb-2">
                    &ldquo;{recap.funniestRoast.text}&rdquo;
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#ff4d00] font-mono font-bold">
                      {recap.funniestRoast.anonId || 'Anonymous'}
                    </span>
                    <ScoreBadge score={recap.funniestRoast.primaryScore} label="😂" color="bg-yellow-500/10 text-yellow-400 border-yellow-500/30" />
                  </div>
                  {recap.funniestRoast.link && (
                    <Link
                      href={recap.funniestRoast.link}
                      className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-[#ff4d00] transition-colors"
                    >
                      View Hot Seat →
                    </Link>
                  )}
                </div>
              </HighlightCard>
            )}

            {/* Most Savage Roast */}
            {recap.mostSavageRoast && (
              <HighlightCard
                emoji="🔥"
                title="Most Savage Roast"
                color="border-orange-500/40"
              >
                <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4">
                  <p className="text-sm text-zinc-100 leading-relaxed mb-2">
                    &ldquo;{recap.mostSavageRoast.text}&rdquo;
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#ff4d00] font-mono font-bold">
                      {recap.mostSavageRoast.anonId || 'Anonymous'}
                    </span>
                    <ScoreBadge score={recap.mostSavageRoast.primaryScore} label="🔥" color="bg-orange-500/10 text-orange-400 border-orange-500/30" />
                  </div>
                  {recap.mostSavageRoast.link && (
                    <Link
                      href={recap.mostSavageRoast.link}
                      className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-[#ff4d00] transition-colors"
                    >
                      View Hot Seat →
                    </Link>
                  )}
                </div>
              </HighlightCard>
            )}

            {/* Most Fatal Roast */}
            {recap.mostFatalRoast && (
              <HighlightCard
                emoji="💀"
                title="Most Fatal Roast"
                color="border-red-500/40"
              >
                <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4">
                  <p className="text-sm text-zinc-100 leading-relaxed mb-2">
                    &ldquo;{recap.mostFatalRoast.text}&rdquo;
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#ff4d00] font-mono font-bold">
                      {recap.mostFatalRoast.anonId || 'Anonymous'}
                    </span>
                    <ScoreBadge score={recap.mostFatalRoast.primaryScore} label="💀" color="bg-red-500/10 text-red-400 border-red-500/30" />
                  </div>
                  {recap.mostFatalRoast.link && (
                    <Link
                      href={recap.mostFatalRoast.link}
                      className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-[#ff4d00] transition-colors"
                    >
                      View Hot Seat →
                    </Link>
                  )}
                </div>
              </HighlightCard>
            )}

            {/* Top Battle */}
            {recap.topBattle && (
              <HighlightCard
                emoji="⚔️"
                title="Top Battle"
                color="border-blue-500/40"
              >
                <Link href={recap.topBattle.link}>
                  <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 hover:border-blue-500/30 transition-all group cursor-pointer">
                    <div className="flex items-center justify-between gap-4">
                      {/* Fighter 1 */}
                      <div className="flex-1 text-center">
                        {recap.topBattle.profile1 && (
                          <>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black mx-auto ${recap.topBattle.profile1.avatar_color || 'bg-[#ff4d00] text-black'}`}>
                              {recap.topBattle.profile1.avatar_letter}
                            </div>
                            <p className="text-sm font-bold text-[#ff4d00] mt-1 truncate">
                              @{recap.topBattle.profile1.username}
                            </p>
                          </>
                        )}
                      </div>

                      {/* VS + Stats */}
                      <div className="text-center shrink-0">
                        <div className="w-12 h-12 rounded-full bg-[#111] border-2 border-[#ff4d00] flex items-center justify-center mx-auto shadow-[0_0_12px_rgba(255,77,0,0.4)]">
                          <span className="font-black text-white text-xs italic">VS</span>
                        </div>
                        <div className="mt-2 font-mono">
                          <span className="text-sm font-bold text-white">
                            {recap.topBattle.votes1} - {recap.topBattle.votes2}
                          </span>
                          <p className="text-[10px] text-zinc-500">
                            {recap.topBattle.totalVotes} total votes
                          </p>
                        </div>
                      </div>

                      {/* Fighter 2 */}
                      <div className="flex-1 text-center">
                        {recap.topBattle.profile2 && (
                          <>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black mx-auto ${recap.topBattle.profile2.avatar_color || 'bg-blue-600 text-white'}`}>
                              {recap.topBattle.profile2.avatar_letter}
                            </div>
                            <p className="text-sm font-bold text-blue-400 mt-1 truncate">
                              @{recap.topBattle.profile2.username}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </HighlightCard>
            )}

            {/* Share CTA */}
            <div className="text-center space-y-3 py-4">
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
                Think you can take next week?
              </p>
              <Link
                href="/hot-seat"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff4d00] text-black font-black text-sm rounded-xl hover:bg-[#ff6622] transition-all shadow-[0_0_25px_rgba(255,77,0,0.3)] uppercase tracking-wider"
              >
                🔥 PUT ME ON THE HOT SEAT
              </Link>
            </div>
          </div>
        )}

        {/* Footer Links */}
        <div className="flex items-center justify-center gap-4 pt-4 pb-8 border-t border-[#222]">
          <Link href="/leaderboards" className="text-[11px] font-mono text-zinc-500 hover:text-[#ff4d00] transition-colors flex items-center gap-1">
            <Trophy className="w-3 h-3" /> Full Rankings
          </Link>
          <Link href="/discover" className="text-[11px] font-mono text-zinc-500 hover:text-[#ff4d00] transition-colors flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Discover
          </Link>
          <Link href="/battle" className="text-[11px] font-mono text-zinc-500 hover:text-[#ff4d00] transition-colors flex items-center gap-1">
            <Swords className="w-3 h-3" /> Battles
          </Link>
        </div>
      </div>
    </div>
  );
}
