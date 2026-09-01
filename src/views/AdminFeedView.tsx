/**
 * BURNBOARD Admin Feed Tuning — Instagram-Grade Algorithm Control
 *
 * Shows sliders for weights (relationship, interest, timeliness, etc.)
 * Shows real stats: avg score, top profiles by score, user favorite platforms.
 * NO fake data — all real interactions.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Sliders, BarChart3, Users, Flame, TrendingUp, Clock, Zap, Save, RotateCcw } from 'lucide-react';
import { Profile, Roast } from '../types';
import { useAuth } from '../lib/auth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AdminFeedViewProps {
  profiles: Profile[];
  roasts: Roast[];
  onBack: () => void;
  onShowToast: (title: string, msg: string, type?: string) => void;
}

interface FeedWeights {
  relationship: number;
  interest: number;
  timeliness: number;
  engagement: number;
  velocity: number;
}

const DEFAULT_WEIGHTS: FeedWeights = {
  relationship: 0.35,
  interest: 0.25,
  timeliness: 0.20,
  engagement: 0.10,
  velocity: 0.07,
};

export const AdminFeedView: React.FC<AdminFeedViewProps> = ({
  profiles,
  roasts,
  onBack,
  onShowToast,
}) => {
  const { user } = useAuth();
  const [weights, setWeights] = useState<FeedWeights>(() => {
    try {
      const saved = localStorage.getItem('burnboard_feed_weights');
      return saved ? JSON.parse(saved) : DEFAULT_WEIGHTS;
    } catch {
      return DEFAULT_WEIGHTS;
    }
  });
  const [interactionStats, setInteractionStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Fetch real interaction stats from Supabase
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoadingStats(false);
      return;
    }

    const fetchStats = async () => {
      try {
        // Get action distribution
        const { data: actions } = await supabase
          .from('user_interactions')
          .select('action')
          .order('created_at', { ascending: false })
          .limit(1000);

        // Get platform distribution
        const { data: platforms } = await supabase
          .from('user_interactions')
          .select('platform')
          .not('platform', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1000);

        // Get interaction count
        const { count: totalInteractions } = await supabase
          .from('user_interactions')
          .select('*', { count: 'exact', head: true });

        // Get unique users
        const { data: uniqueUsers } = await supabase
          .from('user_interactions')
          .select('user_id')
          .not('user_id', 'is', null);

        // Compute stats
        const actionCounts: Record<string, number> = {};
        (actions || []).forEach(a => {
          actionCounts[a.action] = (actionCounts[a.action] || 0) + 1;
        });

        const platformCounts: Record<string, number> = {};
        (platforms || []).forEach(p => {
          platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
        });

        const uniqueUserIds = new Set((uniqueUsers || []).map(u => u.user_id).filter(Boolean));

        setInteractionStats({
          totalInteractions: totalInteractions || 0,
          uniqueUsers: uniqueUserIds.size,
          actionCounts,
          platformCounts,
          topActions: Object.entries(actionCounts)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .slice(0, 5),
          topPlatforms: Object.entries(platformCounts)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .slice(0, 5),
        });
      } catch (err) {
        console.warn('[AdminFeed] Failed to fetch stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, []);

  // Compute real algorithm scores for top profiles
  const topScoredProfiles = useMemo(() => {
    return [...profiles]
      .sort((a, b) => {
        const scoreA = (a.roast_count || 0) * 2 + (a.total_upvotes || 0);
        const scoreB = (b.roast_count || 0) * 2 + (b.total_upvotes || 0);
        return scoreB - scoreA;
      })
      .slice(0, 10)
      .map(profile => {
        const engagementRaw = (profile.roast_count || 0) * 2 + (profile.total_upvotes || 0);
        const engagement = Math.log10(engagementRaw + 1) * 50;
        const ageHours = (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60);
        const timeliness = Math.exp(-ageHours / 24) * 100;

        const score = engagement * weights.engagement + timeliness * weights.timeliness;

        return {
          ...profile,
          score: Math.round(score * 100) / 100,
          engagement: Math.round(engagement * 100) / 100,
          timeliness: Math.round(timeliness * 100) / 100,
        };
      });
  }, [profiles, weights]);

  // Save weights
  const handleSave = () => {
    localStorage.setItem('burnboard_feed_weights', JSON.stringify(weights));
    onShowToast('Weights Saved', 'Feed algorithm weights updated successfully.', 'success');
  };

  // Reset weights
  const handleReset = () => {
    setWeights(DEFAULT_WEIGHTS);
    localStorage.removeItem('burnboard_feed_weights');
    onShowToast('Weights Reset', 'Feed algorithm weights reset to defaults.', 'info');
  };

  // Weight slider component
  const WeightSlider = ({
    label,
    icon: Icon,
    value,
    onChange,
    description,
  }: {
    label: string;
    icon: React.ElementType;
    value: number;
    onChange: (v: number) => void;
    description: string;
  }) => (
    <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#ff4d00]" />
          <span className="text-xs font-mono font-bold text-white uppercase">{label}</span>
        </div>
        <span className="text-sm font-mono font-black text-[#ff4d00]">
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value * 100}
        onChange={(e) => onChange(parseInt(e.target.value) / 100)}
        className="w-full h-2 bg-[#222] rounded-lg appearance-none cursor-pointer accent-[#ff4d00]"
      />
      <p className="text-[10px] text-zinc-500 font-mono mt-1">{description}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ff4d00]/20 flex items-center justify-center">
            <Sliders className="w-5 h-5 text-[#ff4d00]" />
          </div>
          <div>
            <h2 className="text-base font-black text-white uppercase tracking-wider">Feed Algorithm Tuning</h2>
            <p className="text-xs text-zinc-400 font-mono">Instagram-grade weight controls</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222] text-zinc-400 hover:text-white border border-[#333] rounded-lg text-xs font-mono font-bold transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#ff4d00] hover:bg-[#ff6622] text-black rounded-lg text-xs font-mono font-black transition-all"
          >
            <Save className="w-3 h-3" />
            Save Weights
          </button>
        </div>
      </div>

      {/* Weight Sliders */}
      <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
        <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4">
          Algorithm Pillars
        </h3>
        <div className="space-y-4">
          <WeightSlider
            label="Relationship"
            icon={Users}
            value={weights.relationship}
            onChange={(v) => setWeights(prev => ({ ...prev, relationship: v }))}
            description="Following, DMs, roasts, views — Instagram's #1 signal"
          />
          <WeightSlider
            label="Interest"
            icon={Flame}
            value={weights.interest}
            onChange={(v) => setWeights(prev => ({ ...prev, interest: v }))}
            description="Platform affinity from your upvotes and roasts"
          />
          <WeightSlider
            label="Timeliness"
            icon={Clock}
            value={weights.timeliness}
            onChange={(v) => setWeights(prev => ({ ...prev, timeliness: v }))}
            description="Exponential decay — fresh content boost"
          />
          <WeightSlider
            label="Engagement"
            icon={TrendingUp}
            value={weights.engagement}
            onChange={(v) => setWeights(prev => ({ ...prev, engagement: v }))}
            description="Log-scaled virality (roasts + upvotes + reactions)"
          />
          <WeightSlider
            label="Velocity"
            icon={Zap}
            value={weights.velocity}
            onChange={(v) => setWeights(prev => ({ ...prev, velocity: v }))}
            description="Trending speed — roasts/upvotes in last 3 hours"
          />
        </div>
      </div>

      {/* Real Interaction Stats */}
      <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
        <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4">
          Real Interaction Stats
        </h3>

        {loadingStats ? (
          <div className="text-center py-8">
            <div className="text-xs font-mono text-zinc-500 animate-pulse">Loading stats...</div>
          </div>
        ) : interactionStats ? (
          <div className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3 text-center">
                <div className="text-lg font-black text-white">{interactionStats.totalInteractions}</div>
                <div className="text-[10px] text-zinc-500 font-mono uppercase">Total Interactions</div>
              </div>
              <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3 text-center">
                <div className="text-lg font-black text-white">{interactionStats.uniqueUsers}</div>
                <div className="text-[10px] text-zinc-500 font-mono uppercase">Unique Users</div>
              </div>
              <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3 text-center">
                <div className="text-lg font-black text-white">{profiles.length}</div>
                <div className="text-[10px] text-zinc-500 font-mono uppercase">Total Profiles</div>
              </div>
              <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3 text-center">
                <div className="text-lg font-black text-white">{roasts.length}</div>
                <div className="text-[10px] text-zinc-500 font-mono uppercase">Total Roasts</div>
              </div>
            </div>

            {/* Action Distribution */}
            {interactionStats.topActions.length > 0 && (
              <div>
                <h4 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2">
                  Action Distribution
                </h4>
                <div className="space-y-2">
                  {interactionStats.topActions.map(([action, count]: [string, number]) => {
                    const pct = interactionStats.totalInteractions > 0
                      ? ((count / interactionStats.totalInteractions) * 100).toFixed(1)
                      : '0';
                    return (
                      <div key={action} className="flex items-center gap-2">
                        <span className="text-xs font-mono text-zinc-300 w-20 truncate">{action}</span>
                        <div className="flex-1 h-2 bg-[#222] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#ff4d00] rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 w-12 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Platform Distribution */}
            {interactionStats.topPlatforms.length > 0 && (
              <div>
                <h4 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2">
                  Platform Distribution
                </h4>
                <div className="space-y-2">
                  {interactionStats.topPlatforms.map(([platform, count]: [string, number]) => {
                    const max = interactionStats.topPlatforms[0][1];
                    const width = max > 0 ? ((count / max) * 100) : 0;
                    return (
                      <div key={platform} className="flex items-center gap-2">
                        <span className="text-xs font-mono text-zinc-300 w-20 truncate">{platform}</span>
                        <div className="flex-1 h-2 bg-[#222] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 w-12 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-xs text-zinc-500 font-mono">No interaction data yet. Users need to interact with the feed.</p>
          </div>
        )}
      </div>

      {/* Top Profiles by Score */}
      <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
        <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4">
          Top 10 Profiles by Algorithm Score
        </h3>
        <div className="space-y-2">
          {topScoredProfiles.map((profile, index) => (
            <div
              key={profile.id}
              className="flex items-center justify-between bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-500 w-6">#{index + 1}</span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${profile.avatar_color || 'bg-[#ff4d00] text-black'}`}>
                  {profile.avatar_letter}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">@{profile.username}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">{profile.platform}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="text-right">
                  <div className="text-white font-bold">{profile.roast_count || 0}</div>
                  <div className="text-[10px] text-zinc-500">roasts</div>
                </div>
                <div className="text-right">
                  <div className="text-white font-bold">{profile.total_upvotes || 0}</div>
                  <div className="text-[10px] text-zinc-500">upvotes</div>
                </div>
                <div className="text-right">
                  <div className="text-[#ff4d00] font-black">{profile.score}</div>
                  <div className="text-[10px] text-zinc-500">score</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Favorite Platforms Distribution */}
      <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
        <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4">
          Profile Platform Distribution
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(
            profiles.reduce((acc, p) => {
              acc[p.platform] = (acc[p.platform] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          )
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .map(([platform, count]) => {
              const numCount = count as number;
              const pct = profiles.length > 0 ? ((numCount / profiles.length) * 100).toFixed(1) : '0';
              return (
                <div key={platform} className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3">
                  <div className="text-sm font-black text-white">{numCount}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">{platform}</div>
                  <div className="text-[10px] text-[#ff4d00] font-mono">{pct}%</div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
