/**
 * BURNBOARD WorldLeaderboardView
 *
 * Real world leaderboard from Supabase.
 * - Fetches real profiles with country_code
 * - Empty state when 0 profiles
 * - Platform filter (All, LinkedIn, X, GitHub)
 * - Calculates real share % and brutality rating
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Globe, Flame, Filter, Trophy, TrendingUp, Sparkles, MapPin, Share2, Loader2, Plus } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PlatformIcon } from '../components/PlatformIcon';

// Country code to flag/name mapping
const COUNTRY_MAP: Record<string, { name: string; flag: string }> = {
  'US': { name: 'United States', flag: '🇺🇸' },
  'IN': { name: 'India', flag: '🇮🇳' },
  'GB': { name: 'United Kingdom', flag: '🇬🇧' },
  'BD': { name: 'Bangladesh', flag: '🇧🇩' },
  'DE': { name: 'Germany', flag: '🇩🇪' },
  'CA': { name: 'Canada', flag: '🇨🇦' },
  'BR': { name: 'Brazil', flag: '🇧🇷' },
  'FR': { name: 'France', flag: '🇫🇷' },
  'JP': { name: 'Japan', flag: '🇯🇵' },
  'AU': { name: 'Australia', flag: '🇦🇺' },
  'NL': { name: 'Netherlands', flag: '🇳🇱' },
  'SE': { name: 'Sweden', flag: '🇸🇪' },
  'NG': { name: 'Nigeria', flag: '🇳🇬' },
  'ZA': { name: 'South Africa', flag: '🇿🇦' },
  'KR': { name: 'South Korea', flag: '🇰🇷' },
  'SG': { name: 'Singapore', flag: '🇸🇬' },
  'AE': { name: 'UAE', flag: '🇦🇪' },
  'PK': { name: 'Pakistan', flag: '🇵🇰' },
  'PH': { name: 'Philippines', flag: '🇵🇭' },
  'MX': { name: 'Mexico', flag: '🇲🇽' },
  'AR': { name: 'Argentina', flag: '🇦🇷' },
  'CO': { name: 'Colombia', flag: '🇨🇴' },
  'ES': { name: 'Spain', flag: '🇪🇸' },
  'IT': { name: 'Italy', flag: '🇮🇹' },
  'PL': { name: 'Poland', flag: '🇵🇱' },
  'TR': { name: 'Turkey', flag: '🇹🇷' },
  'VN': { name: 'Vietnam', flag: '🇻🇳' },
  'ID': { name: 'Indonesia', flag: '🇮🇩' },
  'MY': { name: 'Malaysia', flag: '🇲🇾' },
  'KE': { name: 'Kenya', flag: '🇰🇪' },
  'GH': { name: 'Ghana', flag: '🇬🇭' },
  'ET': { name: 'Ethiopia', flag: '🇪🇹' },
  'EG': { name: 'Egypt', flag: '🇪🇬' },
  'SA': { name: 'Saudi Arabia', flag: '🇸🇦' },
  'IL': { name: 'Israel', flag: '🇮🇱' },
  'CH': { name: 'Switzerland', flag: '🇨🇭' },
  'AT': { name: 'Austria', flag: '🇦🇹' },
  'BE': { name: 'Belgium', flag: '🇧🇪' },
  'PT': { name: 'Portugal', flag: '🇵🇹' },
  'IE': { name: 'Ireland', flag: '🇮🇪' },
  'NZ': { name: 'New Zealand', flag: '🇳🇿' },
  'DK': { name: 'Denmark', flag: '🇩🇰' },
  'FI': { name: 'Finland', flag: '🇫🇮' },
  'NO': { name: 'Norway', flag: '🇳🇴' },
  'CZ': { name: 'Czech Republic', flag: '🇨🇿' },
  'RO': { name: 'Romania', flag: '🇷🇴' },
  'UA': { name: 'Ukraine', flag: '🇺🇦' },
  'CL': { name: 'Chile', flag: '🇨🇱' },
  'PE': { name: 'Peru', flag: '🇵🇪' },
  'TH': { name: 'Thailand', flag: '🇹🇭' },
};

function getCountryInfo(code: string) {
  return COUNTRY_MAP[code?.toUpperCase()] || { name: code || 'Unknown', flag: '🌍' };
}

interface WorldLeaderboardViewProps {
  onShowToast?: (title: string, msg: string, type?: string) => void;
}

interface CountryStat {
  code: string;
  name: string;
  flag: string;
  totalBurns: number;
  percentage: number;
  topPlatform: string;
  brutalityRating: number;
}

export const WorldLeaderboardView: React.FC<WorldLeaderboardViewProps> = ({ onShowToast }) => {
  const [platformFilter, setPlatformFilter] = useState<'all' | 'linkedin' | 'x' | 'github' | 'instagram'>('all');
  const [countryStats, setCountryStats] = useState<CountryStat[]>([]);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [totalRoasts, setTotalRoasts] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    try {
      // Get total counts
      const [profilesRes, roastsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_banned', false),
        supabase.from('roasts').select('id', { count: 'exact', head: true }).eq('is_hidden', false),
      ]);

      const pCount = profilesRes.count || 0;
      const rCount = roastsRes.count || 0;
      setTotalProfiles(pCount);
      setTotalRoasts(rCount);

      if (pCount === 0) {
        setLoading(false);
        return;
      }

      // Fetch profiles with country_code
      let query = supabase
        .from('profiles')
        .select('country_code, platform, upvotes:total_upvotes, reaction_brutal')
        .eq('is_banned', false);

      if (platformFilter !== 'all') {
        query = query.ilike('platform', platformFilter);
      }

      const { data: profiles } = await query;

      if (!profiles || profiles.length === 0) {
        setCountryStats([]);
        setLoading(false);
        return;
      }

      // Group by country_code
      const grouped: Record<string, { count: number; platforms: Record<string, number>; totalBrutal: number; totalUpvotes: number }> = {};

      for (const p of profiles) {
        const code = (p.country_code || 'XX').toUpperCase();
        if (!grouped[code]) {
          grouped[code] = { count: 0, platforms: {}, totalBrutal: 0, totalUpvotes: 0 };
        }
        grouped[code].count++;
        grouped[code].platforms[p.platform] = (grouped[code].platforms[p.platform] || 0) + 1;
        grouped[code].totalBrutal += (p as any).reaction_brutal || 0;
        grouped[code].totalUpvotes += (p as any).upvotes || 0;
      }

      // Calculate stats per country
      const stats: CountryStat[] = Object.entries(grouped)
        .map(([code, data]) => {
          const info = getCountryInfo(code);
          const dominantPlatform = Object.entries(data.platforms)
            .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Unknown';

          // Real brutality: avg upvotes per profile (0-10 scale)
          const avgUpvotes = data.count > 0 ? data.totalUpvotes / data.count : 0;
          const brutalityRating = Math.min(10, Math.round((avgUpvotes / 5) * 10 * 10) / 10);

          return {
            code,
            name: info.name,
            flag: info.flag,
            totalBurns: data.count,
            percentage: rCount > 0 ? Math.round((data.count / rCount) * 100) : 0,
            topPlatform: dominantPlatform,
            brutalityRating: isNaN(brutalityRating) ? 0 : brutalityRating,
          };
        })
        .sort((a, b) => b.totalBurns - a.totalBurns);

      setCountryStats(stats);
    } catch (err) {
      console.warn('[WorldMap] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [platformFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleShareWorld = () => {
    const text = totalProfiles > 0
      ? `Check out the world's most roasted tech hubs on BURNBOARD! ${countryStats.slice(0, 3).map(c => `${c.name} (${c.percentage}%)`).join(', ')}.`
      : 'BURNBOARD — No AI. Just Humans Roasting Humans. Be the first to roast!';
    navigator.clipboard?.writeText(`${text}\nhttps://burnboard.app`);
    onShowToast?.('Shared!', 'Link copied to clipboard');
  };

  return (
    <div className="space-y-6">
      {/* World Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1c1200] via-[#111] to-[#0a0a0a] border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                <Globe className="w-6 h-6 animate-pulse" />
              </span>
              <span className="text-xs font-mono font-black text-amber-400 uppercase tracking-widest">
                Global Heatmap
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
              WORLD ROAST LEADERBOARD
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 font-mono max-w-xl">
              {totalProfiles > 0
                ? `Real-time geographic distribution of savage burns across ${countryStats.length} countries. No AI bias — pure international human comedy.`
                : 'Real-time geographic distribution will appear here once humans start roasting. No AI bias.'}
            </p>
          </div>

          <button
            onClick={handleShareWorld}
            className="self-start sm:self-center flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black font-mono text-xs uppercase rounded-xl transition-all shadow-lg active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Share World Map</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
      ) : totalProfiles === 0 ? (
        /* ── Empty State ────────────────────────────────────── */
        <div className="bg-[#111] border border-dashed border-amber-500/30 rounded-2xl p-10 text-center space-y-4">
          <div className="text-5xl">🌍</div>
          <h3 className="text-lg font-bold text-white uppercase tracking-wider">
            No global burns yet
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Be the first country to roast 🔥 — submit a target and put your country on the map.
          </p>
          <button
            onClick={() => window.location.hash = '#submit'}
            className="px-5 py-2.5 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Target
          </button>
        </div>
      ) : (
        <>
          {/* Platform Filter */}
          <div className="flex items-center justify-between gap-3 bg-[#111] border border-[#222] p-3 rounded-2xl">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 pl-2">
              <Filter className="w-4 h-4 text-amber-500" />
              <span>Top Platform Filter:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'All Global' },
                { id: 'linkedin', label: 'LinkedIn', icon: 'linkedin' },
                { id: 'x', label: 'X / Twitter', icon: 'x' },
                { id: 'github', label: 'GitHub', icon: 'github' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setPlatformFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                    platformFilter === tab.id
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'bg-[#181818] text-zinc-400 hover:text-white border border-[#262626]'
                  }`}
                >
                  {tab.icon && <PlatformIcon platform={tab.icon} size="sm" />}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Countries Grid — Real Data */}
          {countryStats.length === 0 ? (
            <div className="bg-[#111] border border-dashed border-[#222] rounded-2xl p-8 text-center">
              <p className="text-xs text-zinc-500 font-mono">
                No country data yet — profiles need country codes to appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {countryStats.map((c, index) => (
                <div
                  key={c.code}
                  className="bg-[#111] border border-[#222] hover:border-[#333] rounded-2xl p-4 sm:p-5 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl sm:text-3xl">{c.flag}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-white text-base sm:text-lg">
                            #{index + 1} {c.name}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e1e1e] text-zinc-400 border border-[#333]">
                            {c.code}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-mono text-zinc-400 mt-0.5">
                          <span>{c.totalBurns.toLocaleString()} Burn{c.totalBurns !== 1 ? 's' : ''} Logged</span>
                          <span>•</span>
                          {c.brutalityRating > 0 ? (
                            <span className="flex items-center gap-1 text-amber-400">
                              <Flame className="w-3.5 h-3.5 fill-amber-400" />
                              <span>{c.brutalityRating}/10 Brutality</span>
                            </span>
                          ) : (
                            <span className="text-zinc-600">No burns yet</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xl sm:text-2xl font-black font-mono text-amber-400">
                        {c.percentage}%
                      </span>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase">Global Share</p>
                    </div>
                  </div>

                  {/* Visual Heat Bar */}
                  <div className="space-y-1">
                    <div className="w-full h-3 bg-[#181818] rounded-full overflow-hidden border border-[#262626]">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 via-[#ff4d00] to-red-600 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, c.percentage * 2)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono pt-1 text-zinc-400 border-t border-[#1a1a1a]">
                    <div className="flex items-center gap-2">
                      <span>Dominant Target Platform:</span>
                      <PlatformIcon platform={c.topPlatform.toLowerCase()} size="sm" showLabel />
                    </div>
                    {c.totalBurns >= 5 && (
                      <span className="text-emerald-400 text-[11px]">🔥 High Activity</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
