/**
 * BURNBOARD Explore View — Instagram-Style Discovery
 *
 * Shows profiles with HIGH velocity but NOT in followingIds.
 * Score = velocity * 2 + engagement + random.
 * Filters out viewedIds to show new content.
 */

import React, { useMemo, useState, useEffect } from 'react';
import useSWR from 'swr';
import { Compass, Flame, TrendingUp, Zap, Eye, ArrowBigUp } from 'lucide-react';
import { Profile, Roast } from '../types';
import { ProfileCard } from '../components/ProfileCard';
import { calculateVelocity } from '../lib/feedAlgorithm';
import { useAuth } from '../lib/auth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface ExploreViewProps {
  profiles: Profile[];
  roasts: Roast[];
  followingUserIds?: string[];
  onOpenProfile: (profileId: string) => void;
  onUpvoteRoast: (roastId: string) => void;
  onReactRoast: (roastId: string, type: 'haha' | 'brutal' | 'cry') => void;
  onSubmitRoast: (profileId: string, roastText: string, anonId: string, savageLevel?: string) => Promise<void>;
  onShareRoast: (roast: Roast) => void;
  onReportRoast: (roastId: string) => void;
  onTriggerWarning: (message: string, subtext?: string) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  profiles,
  roasts,
  followingUserIds: propsFollowingUserIds = [],
  onOpenProfile,
  onUpvoteRoast,
  onReactRoast,
  onSubmitRoast,
  onShareRoast,
  onReportRoast,
  onTriggerWarning,
}) => {
  const { user } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState<'hot' | 'rising' | 'fresh' | 'brutal'>('hot');

  // Fetch following list
  const { data: followingData = [] } = useSWR(
    user ? `explore-following:${user.id}` : null,
    async () => {
      if (!user || !isSupabaseConfigured || !supabase) return [];
      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      return (data || []).map((f: any) => f.following_id);
    },
    { refreshInterval: 30000 }
  );

  const followingUserIds = useMemo(() => {
    return [...new Set([...propsFollowingUserIds, ...followingData])];
  }, [propsFollowingUserIds, followingData]);
  const viewedProfileIds = useMemo(() => {
    try {
      const viewed = JSON.parse(localStorage.getItem('burnboard_viewed_profiles') || '[]');
      return new Set(viewed);
    } catch {
      return new Set<string>();
    }
  }, []);

  // Score profiles for Explore (discovery algorithm)
  const exploreProfiles = useMemo(() => {
    // Filter out following and already-viewed profiles
    const candidates = profiles.filter(p => {
      if (followingUserIds.includes(p.user_id || '')) return false;
      // Don't filter out viewed for now — just deprioritize
      return true;
    });

    // Score each candidate
    const scored = candidates.map(profile => {
      const velocity = calculateVelocity(roasts, profile.id);
      const engagementRaw = (profile.roast_count || 0) * 2 + (profile.total_upvotes || 0);
      const engagement = Math.log10(engagementRaw + 1) * 50;
      const velocityScore = velocity.recent_roasts_3h * 30 + velocity.recent_upvotes_3h * 20;
      const ageHours = (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60);
      const timeliness = Math.exp(-ageHours / 24) * 100;

      // Explore score: velocity * 2 + engagement + random
      let score = velocityScore * 2 + engagement + Math.random() * 10;

      // Deprioritize viewed profiles
      if (viewedProfileIds.has(profile.id)) score *= 0.5;

      // Filter by selected mode
      if (selectedFilter === 'fresh') {
        score = timeliness + Math.random() * 5;
      } else if (selectedFilter === 'rising') {
        score = velocityScore * 3 + Math.random() * 10;
      } else if (selectedFilter === 'brutal') {
        const profileRoasts = roasts.filter(r => r.profile_id === profile.id);
        const brutalScore = profileRoasts.reduce((sum, r) => sum + (r.reaction_brutal || 0), 0);
        score = brutalScore * 5 + Math.random() * 10;
      }

      return {
        profile,
        score,
        velocity: velocityScore,
        engagement,
        recent_roasts_3h: velocity.recent_roasts_3h,
      };
    });

    // Sort by score descending
    return scored.sort((a, b) => b.score - a.score);
  }, [profiles, roasts, followingUserIds, viewedProfileIds, selectedFilter]);

  // Stats
  const totalVelocity = exploreProfiles.reduce((sum, p) => sum + p.velocity, 0);

  return (
    <div className="space-y-5">
      {/* Explore Header */}
      <div className="bg-gradient-to-r from-[#1a0a00] via-[#141414] to-[#0a0a1a] border border-[#333] rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#ff4d00]/20 flex items-center justify-center">
            <Compass className="w-5 h-5 text-[#ff4d00]" />
          </div>
          <div>
            <h2 className="text-base font-black text-white uppercase tracking-wider">Explore</h2>
            <p className="text-xs text-zinc-400 font-mono">Discover new targets beyond your feed</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-[#ff4d00]" />
            <span className="text-zinc-300 font-bold">{exploreProfiles.length}</span>
            <span className="text-zinc-500">targets</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-zinc-300 font-bold">{Math.round(totalVelocity)}</span>
            <span className="text-zinc-500">velocity</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-[#111] border border-[#222] rounded-xl p-1">
        <button
          onClick={() => setSelectedFilter('hot')}
          className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1 ${
            selectedFilter === 'hot'
              ? 'bg-[#ff4d00] text-black'
              : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
          }`}
        >
          <Flame className="w-3 h-3" />
          🔥 Hot
        </button>
        <button
          onClick={() => setSelectedFilter('rising')}
          className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1 ${
            selectedFilter === 'rising'
              ? 'bg-yellow-500 text-black'
              : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
          }`}
        >
          <TrendingUp className="w-3 h-3" />
          📈 Rising
        </button>
        <button
          onClick={() => setSelectedFilter('fresh')}
          className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1 ${
            selectedFilter === 'fresh'
              ? 'bg-blue-500 text-white'
              : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
          }`}
        >
          <Eye className="w-3 h-3" />
          ✨ Fresh
        </button>
        <button
          onClick={() => setSelectedFilter('brutal')}
          className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1 ${
            selectedFilter === 'brutal'
              ? 'bg-red-600 text-white'
              : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
          }`}
        >
          💀 Brutal
        </button>
      </div>

      {/* Explore Grid */}
      <div className="space-y-4">
        {exploreProfiles.slice(0, 30).map((item, index) => {
          const profileRoasts = roasts.filter(r => r.profile_id === item.profile.id);

          return (
            <div key={item.profile.id} className="relative">
              {/* Velocity badge for hot/rising items */}
              {item.velocity > 50 && (
                <div className="absolute -top-2 right-4 z-10 bg-[#ff4d00] text-black text-[10px] font-black font-mono px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
                  <Zap className="w-2.5 h-2.5" />
                  {Math.round(item.velocity)} velocity
                </div>
              )}

              <ProfileCard
                profile={item.profile}
                roasts={profileRoasts}
                onOpenProfile={onOpenProfile}
                onUpvoteRoast={onUpvoteRoast}
                onReactRoast={onReactRoast}
                onSubmitRoast={onSubmitRoast}
                onShareRoast={onShareRoast}
                onReportRoast={onReportRoast}
                onTriggerWarning={onTriggerWarning}
              />
            </div>
          );
        })}

        {/* Empty State */}
        {exploreProfiles.length === 0 && (
          <div className="bg-[#111] border border-dashed border-[#333] rounded-2xl p-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#1c1c1c] mx-auto flex items-center justify-center text-2xl">
              🧭
            </div>
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wider">
                Nothing to explore yet
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
                Add more targets to unlock the discovery algorithm!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
