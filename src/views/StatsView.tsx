import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { BarChart3, Flame, Users, MessageSquare, TrendingUp, Clock, Zap, Shield, Sparkles, Loader2 } from 'lucide-react';
import { Profile, Roast } from '../types';
import { PlatformIcon } from '../components/PlatformIcon';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface StatsViewProps {
  profiles: Profile[];
  roasts: Roast[];
}

// ── Real stats fetcher from Supabase ────────────────────────
async function fetchRealStats() {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    // Total counts
    const [profilesRes, roastsRes, todayRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('roasts').select('id', { count: 'exact', head: true }),
      supabase.from('roasts').select('id', { count: 'exact', head: true })
        .gte('created_at', new Date().toISOString().split('T')[0]),
    ]);

    const totalProfiles = profilesRes.count || 0;
    const totalRoasts = roastsRes.count || 0;
    const roastsToday = todayRes.count || 0;
    const avgPerProfile = totalProfiles > 0 ? (totalRoasts / totalProfiles).toFixed(1) : '0';

    // Platform distribution — real counts
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('platform');

    const platformCounts: Record<string, number> = {};
    (allProfiles || []).forEach((p: any) => {
      const plat = p.platform || 'Other';
      platformCounts[plat] = (platformCounts[plat] || 0) + 1;
    });

    const platformBreakdown = Object.entries(platformCounts)
      .map(([platform, count]) => ({
        platform: platform.toLowerCase().replace(/[^a-z]/g, ''),
        label: platform,
        count,
        percent: totalProfiles > 0 ? Math.round((count / totalProfiles) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Most active hour — real data from roasts
    const { data: recentRoasts } = await supabase
      .from('roasts')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    const hourCounts: Record<number, number> = {};
    (recentRoasts || []).forEach((r: any) => {
      const hour = new Date(r.created_at).getUTCHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const hourlyActivity: Array<{ hour: string; count: number; pct: number }> = Array.from({ length: 24 }, (_, i) => {
      const label = i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`;
      const count = hourCounts[i] || 0;
      return { hour: label, count, pct: 0 };
    });

    const maxHour = Math.max(...hourlyActivity.map(h => h.count), 1);
    hourlyActivity.forEach(h => {
      h.pct = Math.round((h.count / maxHour) * 100);
    });

    // Top roaster — real
    const { data: topKarma } = await supabase
      .from('user_karma')
      .select('anon_id, total_roasts_given, total_upvotes_received')
      .order('total_roasts_given', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Total upvotes
    const totalUpvotes = (recentRoasts || []).reduce((sum: number, r: any) => sum + (r.upvotes || 0), 0);

    return {
      totalProfiles,
      totalRoasts,
      roastsToday,
      avgPerProfile,
      platformBreakdown,
      hourlyActivity,
      topRoaster: topKarma,
      totalUpvotes,
    };
  } catch {
    return null;
  }
}

export const StatsView: React.FC<StatsViewProps> = ({ profiles, roasts }) => {
  // SWR polling for real stats
  const { data: stats, isLoading } = useSWR('stats-global', fetchRealStats, {
    refreshInterval: 60000,
    revalidateOnFocus: true,
  });

  const totalProfiles = stats?.totalProfiles ?? profiles.length;
  const totalRoasts = stats?.totalRoasts ?? roasts.length;
  const roastsToday = stats?.roastsToday ?? 0;
  const avgPerProfile = stats?.avgPerProfile ?? (totalProfiles > 0 ? (totalRoasts / totalProfiles).toFixed(1) : '0');
  const platformBreakdown = stats?.platformBreakdown ?? [];
  const hourlyActivity = stats?.hourlyActivity ?? [];
  const totalUpvotes = stats?.totalUpvotes ?? roasts.reduce((acc, r) => acc + (r.upvotes || 0), 0);

  const mostBrutalPlatform = platformBreakdown.length > 0 ? platformBreakdown[0] : null;
  const peakHour = hourlyActivity.length > 0
    ? hourlyActivity.reduce((max, h) => h.count > max.count ? h : max, hourlyActivity[0])
    : null;

  // Empty state
  if (!isLoading && totalProfiles === 0 && totalRoasts === 0) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#1c1005] via-[#111] to-[#0a0a0a] border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                <BarChart3 className="w-5 h-5" />
              </span>
              <span className="text-xs font-mono font-black text-amber-400 uppercase tracking-widest">
                Platform Intelligence
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
              GLOBAL TELEMETRY & STATS
            </h1>
          </div>
        </div>

        <div className="bg-[#111] border border-dashed border-[#333] rounded-2xl p-10 text-center space-y-4">
          <div className="text-4xl">📊</div>
          <h3 className="text-base font-bold text-white uppercase tracking-wider">No stats yet</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Be first to roast and stats will appear here 🔥
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1c1005] via-[#111] to-[#0a0a0a] border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <BarChart3 className="w-5 h-5" />
            </span>
            <span className="text-xs font-mono font-black text-amber-400 uppercase tracking-widest">
              Platform Intelligence
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
            GLOBAL TELEMETRY & STATS
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 font-mono max-w-xl">
            Live metrics, peak roasting velocity, and brutality breakdowns without AI bloat.
          </p>
        </div>
      </div>

      {/* Top 4 KPI Metrics — Real Data */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-[#111] border border-[#222] p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
            <span>Total Burns</span>
            <Flame className="w-4 h-4 text-[#ff4d00]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white">
            {totalRoasts.toLocaleString()}
          </div>
          <p className="text-[10px] font-mono text-emerald-400">↑ 100% human written</p>
        </div>

        <div className="bg-[#111] border border-[#222] p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
            <span>Target Profiles</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white">
            {totalProfiles.toLocaleString()}
          </div>
          <p className="text-[10px] font-mono text-zinc-400">
            {platformBreakdown.length} platforms active
          </p>
        </div>

        <div className="bg-[#111] border border-[#222] p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
            <span>Today&apos;s Burns</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white">
            {roastsToday.toLocaleString()}
          </div>
          <p className="text-[10px] font-mono text-zinc-400">
            {avgPerProfile} avg per target
          </p>
        </div>

        <div className="bg-[#111] border border-[#222] p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
            <span>Most Brutal Hub</span>
            <Zap className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-white truncate">
            {mostBrutalPlatform ? mostBrutalPlatform.label : 'N/A'}
          </div>
          <p className="text-[10px] font-mono text-red-400">
            {mostBrutalPlatform ? `${mostBrutalPlatform.percent}% of all targets` : 'No data yet'}
          </p>
        </div>
      </div>

      {/* Hourly Activity Bar Chart — Real Data */}
      {hourlyActivity.length > 0 && (
        <div className="bg-[#111] border border-[#222] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                Peak Roasting Activity (24H UTC)
              </h3>
            </div>
            <span className="text-xs font-mono text-zinc-400">
              {peakHour ? `Peak Hour: ${peakHour.hour}` : 'No data'}
            </span>
          </div>

          <div className="h-44 flex items-end justify-between gap-2 pt-6 px-2 border-b border-[#222]">
            {hourlyActivity.map((slot) => (
              <div key={slot.hour} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <span className="text-[10px] font-mono text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  {slot.count}
                </span>
                <div
                  className="w-full bg-gradient-to-t from-amber-500/40 via-[#ff4d00] to-red-500 rounded-t-lg transition-all duration-500 group-hover:brightness-125"
                  style={{ height: `${slot.pct || 2}%` }}
                />
                <span className="text-[10px] font-mono text-zinc-500 truncate w-full text-center">
                  {slot.hour}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform Breakdown — Real Data */}
      {platformBreakdown.length > 0 && (
        <div className="bg-[#111] border border-[#222] rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <span>Platform Distribution</span>
          </h3>

          <div className="space-y-3">
            {platformBreakdown.map((item) => (
              <div key={item.platform} className="p-3.5 bg-[#0a0a0a] rounded-xl border border-[#1f1f1f] space-y-2">
                <div className="flex items-center justify-between">
                  <PlatformIcon platform={item.platform} showLabel size="md" />
                  <span className="text-xs font-mono font-black text-amber-400">
                    {item.count} targets ({item.percent}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-[#181818] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-[#ff4d00] rounded-full transition-all duration-500"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Roaster — Real Data */}
      {stats?.topRoaster && (
        <div className="bg-[#111] border border-[#222] rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Top Roaster</span>
          </h3>
          <div className="flex items-center gap-3 p-3 bg-[#0a0a0a] rounded-xl border border-[#1f1f1f]">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#ff4d00] to-amber-500 text-black font-black text-sm flex items-center justify-center">
              {(stats.topRoaster.anon_id || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-xs font-bold text-white font-mono">{stats.topRoaster.anon_id}</div>
              <div className="text-[10px] text-zinc-500 font-mono">
                {stats.topRoaster.total_roasts_given} roasts • {stats.topRoaster.total_upvotes_received} upvotes
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
