import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import useSWR from 'swr';
import { Flame, Search, Sparkles, Filter, Plus, TrendingUp, Clock, Skull, ChevronDown, Loader2, Trophy, Share2, CornerDownRight, Command, Users, Compass, Zap } from 'lucide-react';
import { Profile, Roast } from '../types';
import { ProfileCard } from '../components/ProfileCard';
import { AdSlot } from '../components/AdSlot';
import { DataStore } from '../lib/dataStore';
import { useAuth } from '../lib/auth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { FollowButton } from '../components/FollowButton';
import {
  calculateScore,
  buildUserSignals,
  calculateVelocity,
  rerankFeed,
  getScoreExplanation,
  type FeedCandidate,
  type UserSignals,
  type ScoreBreakdown,
} from '../lib/feedAlgorithm';
import {
  recordInteraction,
  fetchUserInteractions,
} from '../lib/interactions';

interface FeedViewProps {
  profiles: Profile[];
  roasts: Roast[];
  selectedCategory: string;
  onOpenProfile: (profileId: string) => void;
  onOpenSubmit: () => void;
  onUpvoteRoast: (roastId: string) => void;
  onReactRoast: (roastId: string, type: 'haha' | 'brutal' | 'cry') => void;
  onSubmitRoast: (profileId: string, roastText: string, anonId: string) => Promise<void>;
  onShareRoast: (roast: Roast) => void;
  onReportRoast: (roastId: string) => void;
  onTriggerWarning: (message: string, subtext?: string) => void;
  onLoadMore?: () => Promise<void>;
}

export const FeedView: React.FC<FeedViewProps> = ({
  profiles,
  roasts,
  selectedCategory,
  onOpenProfile,
  onOpenSubmit,
  onUpvoteRoast,
  onReactRoast,
  onSubmitRoast,
  onShareRoast,
  onReportRoast,
  onTriggerWarning,
  onLoadMore
}) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'trending' | 'fresh' | 'brutal'>('trending');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [feedMode, setFeedMode] = useState<'foryou' | 'following' | 'trending' | 'fresh'>('foryou');
  const [followingUserIds, setFollowingUserIds] = useState<string[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [recentFeedUserIds, setRecentFeedUserIds] = useState<string[]>([]);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // Refs for IntersectionObserver (view tracking)
  const observerRef = useRef<IntersectionObserver | null>(null);
  const viewTrackedRef = useRef<Set<string>>(new Set());

  // ── Fetch Following List ────────────────────────────────────
  const { data: followingData, mutate: mutateFollowing } = useSWR(
    user ? `feed-following:${user.id}` : null,
    async () => {
      if (!user || !isSupabaseConfigured || !supabase) return [];
      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      return (data || []).map((f: any) => f.following_id);
    },
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  useEffect(() => {
    if (followingData) setFollowingUserIds(followingData);
  }, [followingData]);

  // ── Fetch User Interactions (for feed algorithm) ────────────
  const { data: interactions = [] } = useSWR(
    isSupabaseConfigured ? `feed-interactions:${user?.id || 'anon'}` : null,
    async () => {
      return fetchUserInteractions(user?.id || null, 100);
    },
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      dedupingInterval: 10000,
    }
  );

  // ── Build User Signals from interactions ─────────────────────
  const userSignals: UserSignals = useMemo(() => {
    return buildUserSignals(interactions, followingUserIds, recentFeedUserIds);
  }, [interactions, followingUserIds, recentFeedUserIds]);

  // ── Suggested users (when Following tab is empty) ───────────
  const { data: suggestedData, mutate: mutateSuggested } = useSWR(
    user && feedMode === 'following' && followingUserIds.length === 0
      ? `feed-suggested:${user.id}`
      : null,
    async () => {
      if (!user || !isSupabaseConfigured || !supabase) return [];
      const excludeIds = [user.id, ...followingUserIds].filter(Boolean);
      const { data } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url, bio, karma')
        .not('id', 'in', `(${excludeIds.join(',') || user.id})`)
        .order('karma', { ascending: false })
        .limit(5);
      return (data as any[]) || [];
    },
    {
      refreshInterval: 60000,
      revalidateOnFocus: true,
      dedupingInterval: 10000,
    }
  );

  useEffect(() => {
    if (suggestedData) setSuggestedUsers(suggestedData);
  }, [suggestedData]);

  // ── Compute daily winner from loaded roasts ──────────────────
  const sortedRoasts = [...roasts].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
  const topRoast = sortedRoasts[0];
  const dailyWinner = topRoast ? {
    id: `daily-${new Date().toISOString().slice(0, 10)}`,
    profile_id: topRoast.profile_id,
    roast_id: topRoast.id,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    roast_text: topRoast.roast_text,
    username: profiles.find(p => p.id === topRoast.profile_id)?.username || 'Top Victim',
    upvotes: topRoast.upvotes,
  } : null;
  const dailyTargetProfile = dailyWinner ? (profiles.find(p => p.id === dailyWinner.profile_id) || profiles[0]) : profiles[0];
  const dailyRoast = dailyWinner ? (roasts.find(r => r.id === dailyWinner.roast_id) || roasts[0]) : roasts[0];

  // ── Filter profiles by category and search ───────────────────
  const filteredProfiles = profiles.filter(p => {
    const matchesCategory =
      selectedCategory === 'ALL' ||
      p.platform.toLowerCase() === selectedCategory.toLowerCase() ||
      (selectedCategory === 'X' && p.platform === 'X');

    const matchesSearch =
      !searchQuery.trim() ||
      p.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.bio.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.platform.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  // ── Instagram-Grade Feed Scoring ─────────────────────────────
  const scoredProfiles = useMemo(() => {
    // Calculate velocity for each profile
    const candidates: FeedCandidate[] = filteredProfiles.map(profile => {
      const velocity = calculateVelocity(roasts, profile.id);
      const profileRoasts = roasts.filter(r => r.profile_id === profile.id);
      const totalBrutal = profileRoasts.reduce((sum, r) => sum + (r.reaction_brutal || 0), 0);
      const totalHaha = profileRoasts.reduce((sum, r) => sum + (r.reaction_haha || 0), 0);
      const totalCry = profileRoasts.reduce((sum, r) => sum + (r.reaction_cry || 0), 0);

      return {
        ...profile,
        roasts: profileRoasts,
        reaction_brutal: totalBrutal,
        reaction_haha: totalHaha,
        reaction_cry: totalCry,
        recent_roasts_3h: velocity.recent_roasts_3h,
        recent_upvotes_3h: velocity.recent_upvotes_3h,
        is_following_you: false, // Will be set below
        user_karma: 0,
      } as FeedCandidate;
    });

    // Mark who is following the current user
    candidates.forEach(c => {
      if (c.user_id && followingUserIds.includes(c.user_id)) {
        c.is_following_you = true;
      }
    });

    // Score each candidate based on feed mode
    return candidates.map(profile => {
      let scoreResult: { score: number; breakdown: ScoreBreakdown };

      if (feedMode === 'fresh') {
        // Fresh tab: Pure timeliness, no algorithm
        const ageHours = (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60);
        scoreResult = {
          score: Math.exp(-ageHours / 24) * 100 + Math.random() * 2,
          breakdown: {
            relationship: 0,
            interest: 0,
            timeliness: 100,
            engagement: 0,
            velocity: 0,
            karmaBoost: 0,
            diversityPenalty: 0,
            total: 0,
          },
        };
        scoreResult.breakdown.total = scoreResult.score;
      } else if (feedMode === 'trending') {
        // Trending tab: velocity + engagement only
        const engagementRaw = (profile.roast_count || 0) * 2 + (profile.total_upvotes || 0);
        const engagement = Math.log10(engagementRaw + 1) * 50;
        const velocity = (profile.recent_roasts_3h || 0) * 30 + (profile.recent_upvotes_3h || 0) * 20;
        scoreResult = {
          score: engagement + velocity + Math.random() * 5,
          breakdown: {
            relationship: 0,
            interest: 0,
            timeliness: 0,
            engagement,
            velocity,
            karmaBoost: 0,
            diversityPenalty: 0,
            total: 0,
          },
        };
        scoreResult.breakdown.total = scoreResult.score;
      } else {
        // For You: Full Instagram algorithm
        scoreResult = calculateScore(profile, userSignals);
      }

      return {
        score: scoreResult.score,
        profile,
        breakdown: scoreResult.breakdown,
      };
    });
  }, [filteredProfiles, roasts, feedMode, userSignals, followingUserIds]);

  // ── Apply Following filter ──────────────────────────────────
  const followedScored = useMemo(() => {
    if (feedMode === 'following') {
      return scoredProfiles.filter(s => followingUserIds.includes(s.profile.user_id || ''));
    }
    return scoredProfiles;
  }, [scoredProfiles, feedMode, followingUserIds]);

  // ── Sort and Re-rank ───────────────────────────────────────
  const sortedProfiles = useMemo(() => {
    // Sort by score descending
    const sorted = [...followedScored].sort((a, b) => {
      // Featured always on top
      if (a.profile.featured && !b.profile.featured) return -1;
      if (!a.profile.featured && b.profile.featured) return 1;
      return b.score - a.score;
    });

    // Apply Instagram-style diversity re-ranking
    return rerankFeed(sorted);
  }, [followedScored]);

  // ── Track profile views via IntersectionObserver ─────────────
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const cardId = entry.target.getAttribute('data-profile-id');
            if (cardId && !viewTrackedRef.current.has(cardId)) {
              viewTrackedRef.current.add(cardId);

              const profile = profiles.find(p => p.id === cardId);
              if (profile) {
                recordInteraction({
                  userId: user?.id,
                  targetProfileId: profile.id,
                  targetUserId: profile.user_id,
                  action: 'view',
                  platform: profile.platform,
                });
              }
            }
          }
        });
      },
      { threshold: 0.5, rootMargin: '100px' }
    );

    // Observe all feed cards
    const cards = document.querySelectorAll('[data-profile-id]');
    cards.forEach(card => observerRef.current!.observe(card));

    return () => observerRef.current?.disconnect();
  }, [sortedProfiles, profiles, user]);

  // ── Update recentFeedUserIds for diversity tracking ──────────
  useEffect(() => {
    const userIds = sortedProfiles
      .slice(0, 20)
      .map(s => s.profile.user_id || s.profile.id);
    setRecentFeedUserIds(userIds);
  }, [sortedProfiles]);

  // ── Load More ───────────────────────────────────────────────
  const handleLoadMoreClick = async () => {
    if (isLoadingMore || !onLoadMore) return;
    setIsLoadingMore(true);
    try {
      await onLoadMore();
    } finally {
      setIsLoadingMore(false);
    }
  };

  // ── Track upvote interaction ────────────────────────────────
  const handleUpvote = useCallback(async (roastId: string) => {
    onUpvoteRoast(roastId);
    const roast = roasts.find(r => r.id === roastId);
    if (roast) {
      const profile = profiles.find(p => p.id === roast.profile_id);
      recordInteraction({
        userId: user?.id,
        targetProfileId: roast.profile_id,
        targetUserId: profile?.user_id,
        action: 'upvote',
        platform: profile?.platform,
      });
    }
  }, [onUpvoteRoast, roasts, profiles, user]);

  // ── Get tab count for each mode (matches actual rendered list) ────
  const tabCounts = useMemo(() => {
    const following = followedScored.length;
    return {
      foryou: sortedProfiles.length,
      following,
      trending: sortedProfiles.length,
      fresh: sortedProfiles.length,
    };
  }, [sortedProfiles, followedScored]);

  return (
    <div className="space-y-5">
      {/* Roast of the Day Hero Banner */}
      {dailyRoast && (
        <div className="relative overflow-hidden bg-gradient-to-r from-[#1c1200] via-[#141414] to-[#0f0f0f] border-2 border-amber-500/60 rounded-2xl p-4 sm:p-5 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm">
                <Trophy className="w-4 h-4 text-amber-400" />
              </span>
              <span className="text-xs font-mono font-black text-amber-400 uppercase tracking-widest">
                Roast of the Day 👑
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
              <Flame className="w-3.5 h-3.5 text-[#ff4d00]" />
              <span className="text-white font-bold">{dailyWinner.upvotes || dailyRoast.upvotes}</span>
              <span>votes</span>
            </div>
          </div>

          <p className="text-sm sm:text-base font-medium text-white italic font-mono leading-relaxed pl-2 border-l-2 border-amber-500/80 my-2.5">
            "{dailyWinner.roast_text || dailyRoast.roast_text}"
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-mono border-t border-amber-500/20">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Target:</span>
              <button
                onClick={() => onOpenProfile(dailyTargetProfile.id)}
                className="font-bold text-amber-300 hover:text-white hover:underline transition-all"
              >
                @{dailyWinner.username || dailyTargetProfile.username}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onShareRoast(dailyRoast)}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black font-bold rounded-lg transition-all"
              >
                <Share2 className="w-3 h-3" />
                <span>Share Burn</span>
              </button>
              <button
                onClick={() => onOpenProfile(dailyTargetProfile.id)}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-[#222] hover:bg-[#333] text-white font-bold rounded-lg transition-all"
              >
                <span>View Hot Seat</span>
                <CornerDownRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instagram-Style Feed Tabs: For You | Following | Trending | Fresh */}
      <div className="flex items-center gap-1 bg-[#111] border border-[#222] rounded-xl p-1">
        <button
          onClick={() => setFeedMode('foryou')}
          className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1 ${
            feedMode === 'foryou'
              ? 'bg-[#ff4d00] text-black'
              : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
          }`}
        >
          🔥 For You
          {feedMode === 'foryou' && (
            <span className="text-[10px] opacity-70">({tabCounts.foryou})</span>
          )}
        </button>
        <button
          onClick={() => setFeedMode('following')}
          className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1 ${
            feedMode === 'following'
              ? 'bg-[#ff4d00] text-black'
              : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
          }`}
        >
          👥 Following
          {feedMode === 'following' && followingUserIds.length > 0 && (
            <span className="text-[10px] opacity-70">({tabCounts.following})</span>
          )}
        </button>
        <button
          onClick={() => setFeedMode('trending')}
          className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1 ${
            feedMode === 'trending'
              ? 'bg-[#ff4d00] text-black'
              : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
          }`}
        >
          <TrendingUp className="w-3 h-3" />
          Trending
        </button>
        <button
          onClick={() => setFeedMode('fresh')}
          className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1 ${
            feedMode === 'fresh'
              ? 'bg-[#ff4d00] text-black'
              : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
          }`}
        >
          <Clock className="w-3 h-3" />
          Fresh
        </button>
      </div>

      {/* Search & Platform Filter */}
      <div className="bg-[#111] border border-[#222] rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shadow-xl">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="search-feed"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search targets by handle, bio or platform..."
            className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#ff4d00]"
          />
        </div>

        {/* Sort sub-tabs (for For You mode) */}
        {feedMode === 'foryou' && (
          <div className="flex items-center gap-1 self-end sm:self-auto bg-[#0a0a0a] p-1 rounded-xl border border-[#262626]">
            <button
              id="sort-trending"
              onClick={() => setSortBy('trending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                sortBy === 'trending'
                  ? 'bg-[#ff4d00] text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Trending</span>
            </button>

            <button
              id="sort-fresh"
              onClick={() => setSortBy('fresh')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                sortBy === 'fresh'
                  ? 'bg-[#ff4d00] text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Fresh</span>
            </button>

            <button
              id="sort-brutal"
              onClick={() => setSortBy('brutal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                sortBy === 'brutal'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Skull className="w-3.5 h-3.5" />
              <span>Brutal</span>
            </button>
          </div>
        )}
      </div>

      {/* Feed Cards Stream */}
      <div className="space-y-6">
        {sortedProfiles.map((scoredItem, index) => {
          const { profile, breakdown } = scoredItem;
          const profileRoasts = roasts.filter(r => r.profile_id === profile.id);
          const showAd = (index + 1) % 5 === 0;
          const explanation = getScoreExplanation(breakdown, profile, userSignals);

          return (
            <React.Fragment key={profile.id}>
              <div
                data-profile-id={profile.id}
                className="relative"
                onMouseEnter={() => setHoveredCard(profile.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {/* Score breakdown tooltip (Instagram-style "Why this?") */}
                {hoveredCard === profile.id && feedMode === 'foryou' && (
                  <div className="absolute -top-8 right-0 z-20 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-1.5 text-[10px] font-mono text-zinc-300 shadow-xl whitespace-nowrap animate-in fade-in">
                    <span className="text-[#ff4d00] font-bold">Why this?</span> {explanation}
                  </div>
                )}

                <ProfileCard
                  profile={profile}
                  roasts={profileRoasts}
                  onOpenProfile={onOpenProfile}
                  onUpvoteRoast={handleUpvote}
                  onReactRoast={onReactRoast}
                  onSubmitRoast={onSubmitRoast}
                  onShareRoast={onShareRoast}
                  onReportRoast={onReportRoast}
                  onTriggerWarning={onTriggerWarning}
                />
              </div>
              {showAd && <AdSlot slotIndex={Math.floor((index + 1) / 5)} />}
            </React.Fragment>
          );
        })}

        {/* Load More Burns Button (Infinite Scroll Feel) */}
        {sortedProfiles.length > 0 && onLoadMore && (
          <div className="pt-2 text-center">
            <button
              id="btn-load-more-burns"
              onClick={handleLoadMoreClick}
              disabled={isLoadingMore}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#141414] hover:bg-[#1f1f1f] text-white hover:text-[#ff4d00] border border-[#2a2a2a] hover:border-[#ff4d00]/40 rounded-2xl font-mono font-black text-xs uppercase tracking-wider transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-60"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#ff4d00]" />
                  <span>Loading More Burns...</span>
                </>
              ) : (
                <>
                  <Flame className="w-4 h-4 text-[#ff4d00] fill-[#ff4d00]" />
                  <span>Load More Burns</span>
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Empty State */}
        {sortedProfiles.length === 0 && (
          <div className="bg-[#111] border border-dashed border-[#333] rounded-2xl p-10 text-center space-y-4">
            {feedMode === 'following' ? (
              <>
                <div className="w-14 h-14 rounded-full bg-[#1c1c1c] mx-auto flex items-center justify-center text-2xl">
                  👥
                </div>
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">
                    Follow people to see their roasts here
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
                    When you follow someone, their roasts appear in your Following feed.
                  </p>
                </div>
                {/* Suggested Users */}
                {suggestedUsers.length > 0 && (
                  <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 mt-4">
                    <h4 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-3">
                      Suggested for you
                    </h4>
                    <div className="space-y-2">
                      {suggestedUsers.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[#1a1a1a]">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff4d00] to-amber-500 text-black font-black text-xs flex items-center justify-center">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">@{u.username}</div>
                              {u.bio && <div className="text-[10px] text-zinc-500 truncate max-w-[140px]">{u.bio}</div>}
                            </div>
                          </div>
                          <FollowButton followingId={u.id} size="sm" showCount onMutate={() => { mutateFollowing(); mutateSuggested(); }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : feedMode === 'trending' ? (
              <>
                <div className="w-14 h-14 rounded-full bg-[#1c1c1c] mx-auto flex items-center justify-center text-2xl">
                  📈
                </div>
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">
                    No trending targets yet
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
                    Roast some targets to get the trending algorithm going!
                  </p>
                </div>
                <button
                  onClick={onOpenSubmit}
                  className="px-4 py-2 bg-[#ff4d00] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider hover:bg-[#ff6622] transition-colors"
                >
                  Add Target
                </button>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-[#1c1c1c] mx-auto flex items-center justify-center text-2xl">
                  🔥
                </div>
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">
                    No targets found
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
                    {searchQuery
                      ? `No profiles matching "${searchQuery}". Put them in the hot seat yourself!`
                      : `No roastees in this category yet. Be the pioneer.`}
                  </p>
                </div>
                <button
                  onClick={onOpenSubmit}
                  className="px-4 py-2 bg-[#ff4d00] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider hover:bg-[#ff6622] transition-colors"
                >
                  Add Target
                </button>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
