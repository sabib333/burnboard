import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Flame, ArrowUpRight, Crown, Medal, Sparkles, TrendingUp, Award, UserCheck, Loader2 } from 'lucide-react';
import { Profile, Roast } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface LeaderboardViewProps {
  profiles: Profile[];
  roasts?: Roast[];
  onOpenProfile: (profileId: string) => void;
  onOpenSubmit: () => void;
}

interface RoasterStat {
  anonId: string;
  totalUpvotes: number;
  count: number;
  brutalReactions: number;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  profiles,
  roasts = [],
  onOpenProfile,
  onOpenSubmit
}) => {
  const [tab, setTab] = useState<'victims' | 'hallOfFame'>('victims');
  const [loading, setLoading] = useState(true);
  const [liveProfiles, setLiveProfiles] = useState<Profile[]>(profiles);

  // Update live profiles when parent prop changes
  useEffect(() => {
    setLiveProfiles(profiles);
    setLoading(false);
  }, [profiles]);

  // Realtime subscription for profile updates
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel('leaderboard-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updated = payload.new as Profile;
          setLiveProfiles(prev =>
            prev.map(p => p.id === updated.id ? updated : p)
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles' },
        (payload) => {
          const newProfile = payload.new as Profile;
          setLiveProfiles(prev => [newProfile, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Sort top 10 profiles by roast_count desc
  const sortedProfiles = [...liveProfiles].sort((a, b) => b.roast_count - a.roast_count).slice(0, 10);
  const maxRoasts = sortedProfiles[0]?.roast_count || 1;

  // Calculate Hall of Fame: Aggregate Roasters (anon_id) by upvotes and burns written
  const roasterStats = roasts.reduce((acc, r) => {
    const aid = r.anon_id || 'Anonymous Burner';
    if (!acc[aid]) {
      acc[aid] = { anonId: aid, totalUpvotes: 0, count: 0, brutalReactions: 0 };
    }
    acc[aid].totalUpvotes += (r.upvotes || 0);
    acc[aid].count += 1;
    acc[aid].brutalReactions += (r.reaction_brutal || 0);
    return acc;
  }, {} as Record<string, RoasterStat>);

  const topRoasters: RoasterStat[] = (Object.values(roasterStats) as RoasterStat[])
    .sort((a, b) => b.totalUpvotes - a.totalUpvotes || b.count - a.count)
    .slice(0, 10);

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-black flex items-center justify-center font-black shadow-[0_0_15px_rgba(234,179,8,0.5)]">
            <Crown className="w-4 h-4 fill-black" />
          </div>
        );
      case 2:
        return (
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-zinc-400 to-zinc-200 text-black flex items-center justify-center font-black shadow-[0_0_15px_rgba(228,228,231,0.3)]">
            <Medal className="w-4 h-4" />
          </div>
        );
      case 3:
        return (
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-700 to-amber-600 text-white flex items-center justify-center font-black shadow-[0_0_15px_rgba(180,83,9,0.3)]">
            <Medal className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-[#1c1c1c] text-zinc-400 border border-[#2a2a2a] flex items-center justify-center font-mono font-bold text-xs">
            #{rank}
          </div>
        );
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-[#111] border border-[#222] rounded-2xl p-6 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#222]" />
            <div className="flex-1">
              <div className="h-5 bg-[#222] rounded w-48 mb-2" />
              <div className="h-3 bg-[#222] rounded w-64" />
            </div>
          </div>
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-[#111] border border-[#222] rounded-2xl p-4 animate-pulse flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-[#222]" />
            <div className="w-10 h-10 rounded-full bg-[#222]" />
            <div className="flex-1">
              <div className="h-3 bg-[#222] rounded w-32 mb-2" />
              <div className="h-2 bg-[#222] rounded w-48" />
            </div>
            <div className="h-2 bg-[#222] rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#14100c] via-[#111] to-[#0a0a0a] border border-[#ff4d00]/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-[#ff4d00]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#ff4d00] flex items-center justify-center shadow-[0_0_25px_rgba(255,77,0,0.5)]">
              <Trophy className="w-7 h-7 text-black stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-tight">
                Leaderboards & Hall of Fame
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400">
                Live rankings of the most burnt victims and legendary anonymous roasters.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Tabs */}
            <div className="bg-[#0a0a0a] p-1 rounded-xl border border-[#262626] flex items-center gap-1">
              <button
                id="tab-victims"
                onClick={() => setTab('victims')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  tab === 'victims'
                    ? 'bg-[#ff4d00] text-black shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Top Burnt Targets
              </button>
              <button
                id="tab-hall-of-fame"
                onClick={() => setTab('hallOfFame')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition-all ${
                  tab === 'hallOfFame'
                    ? 'bg-amber-400 text-black shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Hall of Fame</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* HALL OF FAME TAB */}
      {tab === 'hallOfFame' && (
        <div className="space-y-4">
          <div className="bg-[#111] border border-amber-500/30 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-2 text-amber-400 mb-1">
              <Sparkles className="w-4 h-4" />
              <h2 className="text-sm font-bold font-mono uppercase tracking-wider">
                👑 Top Anonymous Roasters (Hall of Fame)
              </h2>
            </div>
            <p className="text-xs text-zinc-400">
              Ranked by crowd upvotes and brutal reactions across all submissions. Verified human humor only.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topRoasters.map((roaster, index) => {
              const rank = index + 1;
              const badgeTitle = `Top Roaster #${rank}`;
              return (
                <div
                  key={roaster.anonId}
                  className="bg-[#121212] border border-[#262626] hover:border-amber-500/50 rounded-2xl p-4 space-y-3 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold text-xs flex items-center justify-center">
                        #{rank}
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono text-[10px] font-bold border border-amber-500/20">
                        {badgeTitle}
                      </span>
                    </div>
                    <Flame className="w-4 h-4 text-[#ff4d00]" />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white font-mono group-hover:text-amber-400 transition-colors">
                      {roaster.anonId}
                    </h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {roaster.count} verified burns submitted
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#222] flex items-center justify-between font-mono text-xs">
                    <span className="text-zinc-400">Total Upvotes</span>
                    <span className="font-black text-[#ff4d00]">▲ {roaster.totalUpvotes}</span>
                  </div>
                </div>
              );
            })}

            {topRoasters.length === 0 && (
              <div className="col-span-3 text-center py-10 bg-[#111] border border-dashed border-[#333] rounded-2xl">
                <Award className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-400 font-bold">Hall of Fame is empty</p>
                <p className="text-xs text-zinc-500 mt-1">No roasts yet. Submit burns to claim rank #1!</p>
                <button
                  onClick={onOpenSubmit}
                  className="mt-4 px-4 py-2 bg-[#ff4d00] text-black font-bold rounded-xl text-xs uppercase"
                >
                  Submit a Roast
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOP BURNT TARGETS TAB */}
      {tab === 'victims' && (
        <>
          {/* Empty state */}
          {sortedProfiles.length === 0 && (
            <div className="bg-[#111] border border-dashed border-[#333] rounded-2xl p-10 text-center">
              <Trophy className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white uppercase tracking-wider">Leaderboard is empty</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                No roast targets yet. Be the first legend on BURNBOARD! 🔥
              </p>
              <button
                onClick={onOpenSubmit}
                className="mt-4 px-5 py-2.5 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-colors"
              >
                Get Roasted Now
              </button>
            </div>
          )}

          {/* Podium Cards for Top 3 */}
          {sortedProfiles.length >= 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Rank 2 */}
              <div
                onClick={() => onOpenProfile(sortedProfiles[1].id)}
                className="bg-[#111] border border-[#262626] hover:border-zinc-500 rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer transition-all duration-200 order-2 sm:order-1 hover:-translate-y-1"
              >
                <div className="mb-2">{getRankBadge(2)}</div>
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-sky-400 text-white font-black text-xl flex items-center justify-center my-1">
                  {sortedProfiles[1].avatar_letter}
                </div>
                <h3 className="font-bold text-white text-base mt-2 truncate w-full">
                  @{sortedProfiles[1].username}
                </h3>
                <span className="text-[10px] font-mono text-zinc-400 uppercase mt-0.5">
                  {sortedProfiles[1].platform}
                </span>
                <div className="mt-3 pt-3 border-t border-[#222] w-full flex justify-between text-xs font-mono">
                  <span className="text-zinc-500">Total Burns</span>
                  <span className="text-white font-bold">{sortedProfiles[1].roast_count.toLocaleString()}</span>
                </div>
              </div>

              {/* Rank 1 (Tall & Highlighted) */}
              <div
                onClick={() => onOpenProfile(sortedProfiles[0].id)}
                className="bg-gradient-to-b from-[#1c140e] to-[#111] border border-[#ff4d00]/50 hover:border-[#ff4d00] rounded-2xl p-5 flex flex-col items-center text-center cursor-pointer transition-all duration-200 order-1 sm:order-2 shadow-[0_0_30px_rgba(255,77,0,0.2)] hover:-translate-y-1"
              >
                <div className="mb-2">{getRankBadge(1)}</div>
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#ff4d00] to-amber-500 text-black font-black text-2xl flex items-center justify-center my-1 shadow-[0_0_20px_rgba(255,77,0,0.4)]">
                  {sortedProfiles[0].avatar_letter}
                </div>
                <h3 className="font-extrabold text-white text-lg mt-2 truncate w-full">
                  @{sortedProfiles[0].username}
                </h3>
                <span className="text-xs font-mono text-[#ff4d00] uppercase font-bold mt-0.5">
                  👑 Undisputed #1 Burned
                </span>
                <div className="mt-3 pt-3 border-t border-[#ff4d00]/20 w-full flex justify-between text-xs font-mono">
                  <span className="text-zinc-400">Total Burns</span>
                  <span className="text-[#ff4d00] font-black text-sm">{sortedProfiles[0].roast_count.toLocaleString()}</span>
                </div>
              </div>

              {/* Rank 3 */}
              <div
                onClick={() => onOpenProfile(sortedProfiles[2].id)}
                className="bg-[#111] border border-[#262626] hover:border-amber-700 rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer transition-all duration-200 order-3 sm:order-3 hover:-translate-y-1"
              >
                <div className="mb-2">{getRankBadge(3)}</div>
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-black font-black text-xl flex items-center justify-center my-1">
                  {sortedProfiles[2].avatar_letter}
                </div>
                <h3 className="font-bold text-white text-base mt-2 truncate w-full">
                  @{sortedProfiles[2].username}
                </h3>
                <span className="text-[10px] font-mono text-zinc-400 uppercase mt-0.5">
                  {sortedProfiles[2].platform}
                </span>
                <div className="mt-3 pt-3 border-t border-[#222] w-full flex justify-between text-xs font-mono">
                  <span className="text-zinc-500">Total Burns</span>
                  <span className="text-white font-bold">{sortedProfiles[2].roast_count.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Rankings List */}
          {sortedProfiles.length > 0 && (
            <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-[#222] flex items-center justify-between text-xs font-mono text-zinc-500 uppercase tracking-wider">
                <span>Target Rank & Profile</span>
                <div className="flex items-center gap-8">
                  <span className="hidden sm:inline">Roast Intensity</span>
                  <span>Burns / Upvotes</span>
                </div>
              </div>

              <div className="divide-y divide-[#1a1a1a]">
                {sortedProfiles.map((profile, idx) => {
                  const rank = idx + 1;
                  const percentage = Math.round((profile.roast_count / maxRoasts) * 100);

                  return (
                    <div
                      key={profile.id}
                      id={`leaderboard-row-${profile.id}`}
                      onClick={() => onOpenProfile(profile.id)}
                      className="p-4 flex items-center justify-between hover:bg-[#161616] transition-colors cursor-pointer group"
                    >
                      {/* Left info */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="shrink-0">{getRankBadge(rank)}</div>
                        <div className="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center text-base font-black text-white shrink-0 border border-[#333]">
                          {profile.avatar_letter}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white group-hover:text-[#ff4d00] transition-colors flex items-center gap-2 truncate">
                            <span>@{profile.username}</span>
                            <span className="text-[10px] bg-[#1a1a1a] text-zinc-400 px-2 py-0.5 rounded border border-[#262626] uppercase">
                              {profile.platform}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 truncate max-w-xs sm:max-w-md mt-0.5">
                            {profile.bio}
                          </p>
                        </div>
                      </div>

                      {/* Right stats */}
                      <div className="flex items-center gap-6 shrink-0 pl-2">
                        {/* Visual Bar */}
                        <div className="hidden sm:block w-32 bg-[#1c1c1c] h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-amber-500 to-[#ff4d00] h-full rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>

                        <div className="text-right font-mono">
                          <div className="text-sm font-bold text-white flex items-center justify-end gap-1">
                            <span>{profile.roast_count.toLocaleString()}</span>
                            <Flame className="w-3.5 h-3.5 text-[#ff4d00]" />
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            ▲ {profile.total_upvotes.toLocaleString()}
                          </div>
                        </div>

                        <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
