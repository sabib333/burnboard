'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Flame, TrendingUp, Clock, Skull, Swords, ArrowLeft, Loader2,
  Plus, Zap, Trophy, Sparkles, ArrowUpRight, MessageSquare
} from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import SuggestedForYou from '@/components/discover/SuggestedForYou';
import { t, formatCount } from '@/lib/lang';
import { trackGrowthEvent } from '@/lib/experiments';

// ── Helpers ──────────────────────────────────────────────────
function timeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diff = Math.max(0, Math.floor((now - past) / 1000));
  if (diff < 60) return 'now';
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}



// ── SWR Fetcher ──────────────────────────────────────────────
const fetchTrending = async (type, window) => {
  const params = new URLSearchParams({ type, window, limit: '20' });
  const res = await fetch(`/api/trending?${params}`);
  if (!res.ok) throw new Error('Failed to fetch trending');
  return res.json();
};

// ── Time Window Tabs ─────────────────────────────────────────
const WINDOWS = [
  { key: 'now',     label: 'Now',     icon: Zap },
  { key: 'today',   label: 'Today',   icon: Clock },
  { key: 'week',    label: 'This Week', icon: TrendingUp },
  { key: 'alltime', label: 'All Time', icon: Trophy },
];

// ── Content Type Tabs ────────────────────────────────────────
const CONTENT_TYPES = [
  { key: 'all',     label: 'All',     emoji: '🔥' },
  { key: 'hotseats', label: 'Hot Seats', emoji: '🪑' },
  { key: 'roasts',  label: 'Roasts',  emoji: '😂' },
  { key: 'battles', label: 'Battles', emoji: '⚔️' },
];

// ── Heat Level Config ────────────────────────────────────────
const HEAT_LEVELS = {
  light:  { label: 'Light',  emoji: '🙂', color: 'text-green-400' },
  savage: { label: 'Savage', emoji: '🔥', color: 'text-[#ff4d00]' },
  brutal: { label: 'Brutal', emoji: '💀', color: 'text-red-400' },
};

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

// ── Trending Label Badge ─────────────────────────────────────
function TrendingBadge({ label }) {
  if (!label) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${label.color}`}>
      <span>{label.emoji}</span>
      <span>{label.text}</span>
    </span>
  );
}

// ── Hot Seat Card ────────────────────────────────────────────
function HotSeatCard({ seat }) {
  const heat = HEAT_LEVELS[seat.heat_level] || HEAT_LEVELS.savage;
  const cat = {
    photo: { label: 'My Photo', emoji: '📸' },
    vibe: { label: 'My Vibe', emoji: '✨' },
    bio: { label: 'My Bio', emoji: '📝' },
    outfit: { label: 'My Outfit', emoji: '👕' },
    idea: { label: 'My Idea', emoji: '💡' },
    dating_profile: { label: 'My Dating Profile', emoji: '💘' },
    music_taste: { label: 'My Music Taste', emoji: '🎵' },
    hot_take: { label: 'My Hot Take', emoji: '🔥' },
  }[seat.category] || { label: seat.category, emoji: '🔥' };

  return (
    <Link href={`/hot-seat/${seat.id}`}>
      <div className="bg-[#111] border border-[#222] hover:border-[#ff4d00]/40 rounded-2xl p-4 transition-all duration-200 hover:shadow-[0_0_20px_rgba(255,77,0,0.1)] group cursor-pointer">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">{cat.emoji}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate group-hover:text-[#ff4d00] transition-colors">
                {seat.title}
              </p>
              <p className="text-[11px] text-zinc-400 truncate">
                by {seat.display_name || 'Anonymous'}
              </p>
            </div>
          </div>
          <TrendingBadge label={seat.trendingLabel} />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className={`px-2 py-0.5 rounded-md border border-[#262626] ${heat.color}`}>
            {heat.emoji} {heat.label}
          </span>
          <span className="px-2 py-0.5 rounded-md border border-[#262626] text-zinc-400">
            {cat.emoji} {cat.label}
          </span>
          <span className="px-2 py-0.5 rounded-md border border-[#262626] text-zinc-400 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {seat.roast_count || 0} roasts
          </span>
          {(seat.totalReactions || 0) > 0 && (
            <span className="px-2 py-0.5 rounded-md border border-[#262626] text-[#ff4d00] flex items-center gap-1">
              <Flame className="w-3 h-3" />
              {formatCount(seat.totalReactions)}
            </span>
          )}
        </div>

        {seat.context && (
          <p className="text-[11px] text-zinc-500 mt-2 line-clamp-2">{seat.context}</p>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1a1a1a]">
          <span className="text-[10px] text-zinc-600 font-mono">{timeAgo(seat.created_at)}</span>
          <span className="text-[11px] font-mono font-bold text-[#ff4d00] group-hover:text-white transition-colors flex items-center gap-1">
            🔥 ADD YOUR ROAST <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Roast Card ───────────────────────────────────────────────
function RoastCard({ roast }) {
  const totalReactions = Object.entries(roast.reactionCounts || {})
    .filter(([k]) => k !== 'total')
    .reduce((sum, [, v]) => sum + (v || 0), 0);

  return (
    <div className="bg-[#111] border border-[#222] hover:border-[#333] rounded-2xl p-4 transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[11px] text-[#ff4d00] font-black font-mono flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff4d00]" />
          {roast.anon_id || 'Anonymous'}
        </span>
        <TrendingBadge label={roast.trendingLabel} />
      </div>

      <p className="text-sm text-zinc-100 leading-relaxed select-text mb-3">
        &ldquo;{roast.roast_text}&rdquo;
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-[#1a1a1a]">
        <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500">
          {(roast.reactionCounts?.funny || roast.reaction_haha || 0) > 0 && (
            <span className="flex items-center gap-1">😂 {formatCount(roast.reactionCounts?.funny || roast.reaction_haha || 0)}</span>
          )}
          {(roast.reactionCounts?.savage || roast.reaction_brutal || 0) > 0 && (
            <span className="flex items-center gap-1">🔥 {formatCount(roast.reactionCounts?.savage || roast.reaction_brutal || 0)}</span>
          )}
          {(roast.reactionCounts?.fatal || roast.reaction_cry || 0) > 0 && (
            <span className="flex items-center gap-1">💀 {formatCount(roast.reactionCounts?.fatal || roast.reaction_cry || 0)}</span>
          )}
          {totalReactions === 0 && <span>No reactions yet</span>}
        </div>
        <span className="text-[10px] text-zinc-600 font-mono">{timeAgo(roast.created_at)}</span>
      </div>

      {roast.source === 'hot_seat' && roast.hot_seat_id && (
        <Link
          href={`/hot-seat/${roast.hot_seat_id}`}
          className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-[#ff4d00] transition-colors"
        >
          View Hot Seat →
        </Link>
      )}
    </div>
  );
}

// ── Battle Card ──────────────────────────────────────────────
function BattleCard({ battle }) {
  const p1 = battle.profile1;
  const p2 = battle.profile2;
  const totalVotes = battle.totalVotes || 0;
  const pct1 = totalVotes > 0 ? Math.round(((battle.votes1 || 0) / totalVotes) * 100) : 50;
  const pct2 = 100 - pct1;

  if (!p1 || !p2) return null;

  return (
    <Link href="/battle">
      <div className="bg-[#111] border border-[#222] hover:border-blue-500/30 rounded-2xl p-4 transition-all duration-200 hover:shadow-[0_0_15px_rgba(59,130,246,0.1)] cursor-pointer group">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <Swords className="w-4 h-4 text-[#ff4d00]" />
            <span className="text-[11px] font-mono font-bold text-zinc-300 uppercase">Roast Battle</span>
          </div>
          <TrendingBadge label={battle.trendingLabel} />
        </div>

        <div className="flex items-center justify-between gap-3">
          {/* Fighter 1 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${p1.avatar_color || 'bg-[#ff4d00] text-black'}`}>
                {p1.avatar_letter}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate group-hover:text-[#ff4d00] transition-colors">
                  @{p1.username}
                </p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${getPlatformBadge(p1.platform)}`}>
                  {p1.platform}
                </span>
              </div>
            </div>
          </div>

          {/* VS */}
          <div className="shrink-0 flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-[#0a0a0a] border-2 border-[#ff4d00] flex items-center justify-center shadow-[0_0_12px_rgba(255,77,0,0.4)]">
              <span className="font-black text-white text-xs italic">VS</span>
            </div>
            {totalVotes > 0 && (
              <span className="text-[10px] font-mono text-zinc-500 mt-1">{totalVotes} votes</span>
            )}
          </div>

          {/* Fighter 2 */}
          <div className="flex-1 min-w-0 flex justify-end">
            <div className="flex items-center gap-2">
              <div className="min-w-0 text-right">
                <p className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                  @{p2.username}
                </p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${getPlatformBadge(p2.platform)}`}>
                  {p2.platform}
                </span>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${p2.avatar_color || 'bg-blue-600 text-white'}`}>
                {p2.avatar_letter}
              </div>
            </div>
          </div>
        </div>

        {/* Vote Bar */}
        {totalVotes > 0 && (
          <div className="mt-3">
            <div className="h-2 bg-[#1c1c1c] rounded-full overflow-hidden flex border border-[#262626] p-0.5">
              <div
                className="bg-gradient-to-r from-orange-600 to-[#ff4d00] h-full rounded-l-full transition-all"
                style={{ width: `${pct1}%` }}
              />
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-r-full transition-all"
                style={{ width: `${pct2}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono mt-1">
              <span className="text-[#ff4d00]">{pct1}%</span>
              <span className="text-blue-400">{pct2}%</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1a1a1a]">
          <span className="text-[10px] text-zinc-600 font-mono">{timeAgo(battle.created_at)}</span>
          <span className="text-[11px] font-mono font-bold text-blue-400 group-hover:text-white transition-colors flex items-center gap-1">
            ⚔️ JOIN THE ACTION <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Section Header ───────────────────────────────────────────
function SectionHeader({ emoji, title, count, link, linkLabel }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <h2 className="text-sm font-black text-white uppercase tracking-wider font-mono">{title}</h2>
        {count !== undefined && (
          <span className="text-[10px] font-mono text-zinc-500 bg-[#1a1a1a] px-2 py-0.5 rounded-full border border-[#262626]">
            {count}
          </span>
        )}
      </div>
      {link && (
        <Link href={link} className="text-[11px] font-mono text-[#ff4d00] hover:text-white transition-colors flex items-center gap-1">
          {linkLabel || 'See All'} <ArrowUpRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────
function EmptyState({ type }) {
  return (
    <div className="bg-[#111] border border-dashed border-[#333] rounded-2xl p-8 text-center space-y-3">
      <div className="text-4xl">🦗</div>
      <p className="text-sm font-bold text-zinc-400 uppercase">
        {type === 'hotseats' && 'No trending hot seats yet'}
        {type === 'roasts' && 'No trending roasts yet'}
        {type === 'battles' && 'No trending battles yet'}
        {type === 'all' && 'Nothing trending yet'}
      </p>
      <p className="text-xs text-zinc-500">Be the first to start the fire!</p>
      <Link
        href="/hot-seat"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ff4d00] text-black font-bold text-xs rounded-xl hover:bg-[#ff6622] transition-all shadow-[0_0_20px_rgba(255,77,0,0.3)]"
      >
        <Plus className="w-4 h-4" />
        PUT YOURSELF ON THE HOT SEAT
      </Link>
    </div>
  );
}

// ── Grand Empty State (fresh database) ───────────────────────
function GrandEmptyState() {
  return (
    <div className="bg-gradient-to-br from-[#1a0a00] via-[#111] to-[#0a0a0a] border-2 border-[#ff4d00]/30 rounded-3xl p-10 text-center space-y-4 shadow-[0_0_40px_rgba(255,77,0,0.1)]">
      <div className="text-5xl">🔥</div>
      <h2 className="text-xl font-black text-white uppercase tracking-wider">
        THE INTERNET IS QUIET... FOR NOW.
      </h2>
      <p className="text-xs text-zinc-400 max-w-sm mx-auto">
        No one has been roasted yet. Be the legend who starts the first fire on BURN BOARD.
      </p>
      <Link
        href="/hot-seat"
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff4d00] text-black font-black text-sm rounded-xl hover:bg-[#ff6622] transition-all shadow-[0_0_30px_rgba(255,77,0,0.4)] uppercase tracking-wider"
      >
        🔥 START THE FIRST FIRE
      </Link>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function DiscoverPage() {
  const [activeWindow, setActiveWindow] = useState('now');
  const [activeType, setActiveType] = useState('all');

  const { data, error, isLoading } = useSWR(
    ['trending', activeWindow],
    () => fetchTrending('all', activeWindow),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 30000, // refresh every 30 seconds
    }
  );

  const hotSeats = data?.hotSeats || [];
  const roasts = data?.roasts || [];
  const battles = data?.battles || [];

  // Track discovery opened on mount
  useEffect(() => {
    trackGrowthEvent('discovery_opened');
  }, []);

  const isEmpty = !isLoading && hotSeats.length === 0 && roasts.length === 0 && battles.length === 0;

  // Filter content based on active type
  const showHotSeats = activeType === 'all' || activeType === 'hotseats';
  const showRoasts = activeType === 'all' || activeType === 'roasts';
  const showBattles = activeType === 'all' || activeType === 'battles';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="space-y-4 py-4">
          <AppHeader backLink="/" backLabel="BURN BOARD" />

          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2 text-[#ff4d00]">
              <Flame className="w-6 h-6 fill-[#ff4d00]" />
              <h1 className="text-xl font-black uppercase tracking-wider font-mono">{t('discover_title')}</h1>
            </div>
            <p className="text-xs text-zinc-400 font-mono">
              {t('discover_subtitle')}
            </p>
          </div>
        </header>

        {/* Suggested for you — mutual-follow creator discovery */}
        <SuggestedForYou />

        {/* Time Window Tabs */}
        <div className="flex items-center gap-1 bg-[#111] p-1 rounded-xl border border-[#222] overflow-x-auto">
          {WINDOWS.map(w => {
            const Icon = w.icon;
            return (
              <button
                key={w.key}
                onClick={() => setActiveWindow(w.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-mono font-bold whitespace-nowrap transition-all ${
                  activeWindow === w.key
                    ? 'bg-[#ff4d00] text-black'
                    : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(`discover_window_${w.key}`) || w.label}
              </button>
            );
          })}
        </div>

        {/* Content Type Tabs */}
        <div className="flex items-center gap-1 bg-[#111] p-1 rounded-xl border border-[#222] overflow-x-auto">
          {CONTENT_TYPES.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveType(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-mono font-bold whitespace-nowrap transition-all ${
                activeType === t.key
                  ? 'bg-[#1a1a1a] text-white border border-[#333]'
                  : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
              }`}
            >
              <span>{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-[#111] border border-[#222] rounded-2xl p-4 animate-pulse space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#222]" />
                  <div className="space-y-2 flex-1">
                    <div className="w-3/4 h-4 bg-[#222] rounded" />
                    <div className="w-1/3 h-3 bg-[#1a1a1a] rounded" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-16 h-5 bg-[#222] rounded" />
                  <div className="w-20 h-5 bg-[#222] rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-6 text-center">
            <p className="text-sm text-red-400 font-mono">Failed to load trending content</p>
            <p className="text-xs text-zinc-500 mt-1">Please try again later</p>
          </div>
        )}

        {/* Grand Empty State */}
        {!isLoading && isEmpty && <GrandEmptyState />}

        {/* Trending Content */}
        {!isLoading && !error && (
          <div className="space-y-8">
            {/* Trending Hot Seats */}
            {showHotSeats && (
              <section className="space-y-4">
                <SectionHeader
                  emoji="🪑"
                  title="Trending Hot Seats"
                  count={hotSeats.length}
                  link={hotSeats.length > 0 ? undefined : undefined}
                />
                {hotSeats.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {hotSeats.map(seat => (
                      <HotSeatCard key={seat.id} seat={seat} />
                    ))}
                  </div>
                ) : (
                  <EmptyState type="hotseats" />
                )}
              </section>
            )}

            {/* Trending Roasts */}
            {showRoasts && (
              <section className="space-y-4">
                <SectionHeader
                  emoji="😂"
                  title="Hottest Roasts"
                  count={roasts.length}
                />
                {roasts.length > 0 ? (
                  <div className="space-y-3">
                    {roasts.map(roast => (
                      <RoastCard key={roast.id} roast={roast} />
                    ))}
                  </div>
                ) : (
                  <EmptyState type="roasts" />
                )}
              </section>
            )}

            {/* Trending Battles */}
            {showBattles && (
              <section className="space-y-4">
                <SectionHeader
                  emoji="⚔️"
                  title="Live Roast Battles"
                  count={battles.length}
                  link="/battle"
                  linkLabel="Enter Arena"
                />
                {battles.length > 0 ? (
                  <div className="space-y-4">
                    {battles.map(battle => (
                      <BattleCard key={battle.id} battle={battle} />
                    ))}
                  </div>
                ) : (
                  <EmptyState type="battles" />
                )}
              </section>
            )}
          </div>
        )}

        {/* Bottom CTA */}
        {!isLoading && !isEmpty && (
          <div className="text-center pt-6 pb-8 border-t border-[#222] space-y-4">
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
              Ready to get roasted?
            </p>
            <Link
              href="/hot-seat"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff4d00] text-black font-black text-sm rounded-xl hover:bg-[#ff6622] transition-all shadow-[0_0_25px_rgba(255,77,0,0.3)] uppercase tracking-wider"
            >
              🔥 PUT YOURSELF ON THE HOT SEAT
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
