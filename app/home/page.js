'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Flame, TrendingUp, Clock, Loader2, Zap, Trophy, RefreshCw, UserPlus } from 'lucide-react';
import { FeedCard } from '@/components/feed';
import InterestPicker from '@/components/feed/InterestPicker';
import ForYouRails from '@/components/feed/ForYouRails';
import PeopleYouMayLike from '@/components/feed/PeopleYouMayLike';
import { CardSkeleton } from '@/components/ui/Skeleton';
import TodayOnBurnBoard from '@/components/feed/TodayOnBurnBoard';
import TrendingSidebar from '@/components/feed/TrendingSidebar';
import { track } from '@/lib/analytics';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * /home — BurnBoard Social Feed
 * 
 * The main discovery feed with tabs:
 *   - For You: Algorithmically ranked content
 *   - Trending: Engagement-weighted content
 * 
 * Features:
 *   - Infinite scroll with cursor-based pagination
 *   - Real reactions backed by server data
 *   - Loading skeletons
 *   - Empty states
 *   - Error handling with retry
 */

const FEED_TABS = [
  { key: 'following', label: 'Following', icon: UserPlus },
  { key: 'for_you', label: 'For You', icon: Flame },
  { key: 'trending', label: 'Trending', icon: TrendingUp },
];

const TRENDING_WINDOWS = [
  { key: 'now', label: 'Now', icon: Zap },
  { key: 'today', label: 'Today', icon: Clock },
  { key: 'week', label: 'Week', icon: TrendingUp },
];

export default function SocialHomePage() {
  const [activeTab, setActiveTab] = useState('for_you');
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [trendingWindow, setTrendingWindow] = useState('today');
  const [signedIn, setSignedIn] = useState(false);
  const [feedMeta, setFeedMeta] = useState({ personalized: false, coldStart: false, followingEmpty: false });
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);

  // Resolve auth state so signed-in users get the Following tab + feedback
  // controls (the API is the enforcement point; the UI only reveals intent).
  useEffect(() => {
    let cancelled = false;
    if (!isSupabaseConfigured || !supabase) return undefined;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setSignedIn(!!data?.user);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Track feed view
  useEffect(() => {
    track('feed_viewed', { tab: activeTab });
  }, [activeTab]);

  // Fetch feed items
  const fetchFeed = useCallback(async (isRefresh = false) => {
    if (loadingMore && !isRefresh) return;

    try {
      if (isRefresh) {
        setLoading(true);
        setItems([]);
        setCursor(null);
        setHasMore(true);
      } else if (cursor) {
        setLoadingMore(true);
      }

      const params = new URLSearchParams({
        tab: activeTab,
        limit: '20',
      });

      if (cursor && !isRefresh) {
        params.set('cursor', cursor);
      }

      if (activeTab === 'trending') {
        params.set('window', trendingWindow);
      }

      const res = await fetch(`/api/feed?${params}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to load feed');

      if (isRefresh || !cursor) {
        setItems(data.items || []);
      } else {
        setItems(prev => [...prev, ...(data.items || [])]);
      }

      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
      setError(null);
      // Following is chronologically empty whenever there is nothing to show.
      const followingEmpty = activeTab === 'following' && !(data.items || []).length;
      setFeedMeta({
        personalized: !!data.personalized,
        coldStart: !!data.coldStart,
        followingEmpty,
      });

      // Track impressions
      if (data.items?.length) {
        track('feed_loaded', {
          tab: activeTab,
          count: data.items.length,
          hasMore: !!data.nextCursor,
        });
      }
    } catch (err) {
      console.error('[Feed] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeTab, cursor, trendingWindow, loadingMore]);

  // Initial load and tab change
  useEffect(() => {
    fetchFeed(true);
  }, [activeTab, trendingWindow]);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchFeed(false);
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, loadingMore, fetchFeed]);

  // Handle tab change
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    track('feed_tab_changed', { tab });
  }, []);

  // Handle reaction
  const handleReaction = useCallback((item, type) => {
    track('reaction_added', { itemId: item.id, type });
  }, []);

  // Handle upvote
  const handleUpvote = useCallback((item) => {
    track('upvote_added', { itemId: item.id });
  }, []);

  // Handle share
  const handleShare = useCallback((item) => {
    track('content_shared', { itemId: item.id, type: item.type });
  }, []);

  // Handle report
  const handleReport = useCallback((item) => {
    track('content_reported', { itemId: item.id });
  }, []);

  // ── Negative feedback (real, affects future ranking) ─────────
  const applyFeedback = useCallback(async (item, action) => {
    const contentType = item.type === 'roast' ? 'roast' : 'social_post';
    try {
      const res = await fetch('/api/feed/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_type: contentType,
          content_id: item.id,
          action,
        }),
      });
      if (!res.ok) throw new Error('feedback failed');
      // Hidden content should not keep occupying the feed this session.
      setItems(prev => prev.filter(x => !(x.id === item.id && x.type === item.type)));
      track(action === 'not_interested' ? 'not_interested' : 'content_hidden', { itemId: item.id, type: item.type });
    } catch (err) {
      console.error('[Feed] Feedback error:', err);
    }
  }, []);

  const handleNotInterested = useCallback((item) => applyFeedback(item, 'not_interested'), [applyFeedback]);
  const handleHide = useCallback((item) => applyFeedback(item, 'hide'), [applyFeedback]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-6xl mx-auto flex">
        {/* ═══ Main Feed Column ═══ */}
        <div className="flex-1 min-w-0 max-w-2xl mx-auto lg:mx-0 lg:max-w-none px-4 sm:px-6 py-6 space-y-5">
          {/* Header */}
          <header className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-6 h-6 text-[#ff4d00] fill-[#ff4d00]" />
                <h1 className="text-lg font-black text-white uppercase tracking-wider font-mono">
                  FEED
                </h1>
              </div>
              <button
                onClick={() => fetchFeed(true)}
                disabled={loading}
                className="p-2 rounded-xl hover:bg-[#1a1a1a] transition-colors text-zinc-400 hover:text-white"
                aria-label="Refresh feed"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Feed Tabs — Following is only for signed-in users and stays
                distinctly chronological (never silently algorithmic). */}
            <div className="flex items-center gap-1 bg-[#111] p-1 rounded-xl border border-[#222]">
              {FEED_TABS.filter(tab => tab.key !== 'following' || signedIn).map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleTabChange(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-mono font-bold transition-all ${
                      activeTab === tab.key
                        ? 'bg-[#ff4d00] text-black'
                        : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Trending Window Tabs (only when on trending tab) */}
            {activeTab === 'trending' && (
              <div className="flex items-center gap-1 bg-[#111] p-1 rounded-xl border border-[#222]">
                {TRENDING_WINDOWS.map(w => {
                  const Icon = w.icon;
                  return (
                    <button
                      key={w.key}
                      onClick={() => setTrendingWindow(w.key)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-mono font-bold transition-all ${
                        trendingWindow === w.key
                          ? 'bg-[#1a1a1a] text-white border border-[#333]'
                          : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {w.label}
                    </button>
                  );
                })}
              </div>
            )}
          </header>

          {/* ═══ Feed Content ═══ */}
          
          {/* Loading State */}
          {loading && (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-6 text-center space-y-3">
              <p className="text-sm text-red-400 font-mono">{error}</p>
              <button
                onClick={() => fetchFeed(true)}
                className="text-xs font-mono text-[#ff4d00] hover:text-white transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && items.length === 0 && (
            activeTab === 'following' && signedIn && feedMeta.followingEmpty ? (
              <div className="bg-[#111] border border-dashed border-[#333] rounded-2xl p-10 text-center space-y-4">
                <div className="text-5xl">👋</div>
                <h2 className="text-lg font-black text-white uppercase tracking-wider">
                  YOUR FOLLOWING FEED IS QUIET
                </h2>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Following shows posts from people you follow — in order, no algorithms.
                  Follow some people and their fresh burns will land here.
                </p>
                <Link
                  href="/discover"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff4d00] text-black font-black text-sm rounded-xl hover:bg-[#ff6622] transition-all shadow-[0_0_25px_rgba(255,77,0,0.3)] uppercase tracking-wider"
                >
                  <UserPlus className="w-4 h-4" />
                  DISCOVER PEOPLE
                </Link>
              </div>
            ) : (
              <div className="bg-[#111] border border-dashed border-[#333] rounded-2xl p-10 text-center space-y-4">
                <div className="text-5xl">🔥</div>
                <h2 className="text-lg font-black text-white uppercase tracking-wider">
                  THE ARENA IS QUIET
                </h2>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Be the first to start something. Put yourself or someone else on the Hot Seat.
                </p>
                <Link
                  href="/hot-seat"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff4d00] text-black font-black text-sm rounded-xl hover:bg-[#ff6622] transition-all shadow-[0_0_25px_rgba(255,77,0,0.3)] uppercase tracking-wider"
                >
                  🔥 START THE FIRE
                </Link>
              </div>
            )
          )}

          {/* Feed Items */}
          {!loading && items.length > 0 && (
            <div className="space-y-4">
              {/* Today on BurnBoard (only on For You tab, at top) */}
              {activeTab === 'for_you' && <TodayOnBurnBoard />}

              {/* Discovery rails: challenges & communities for this viewer */}
              {activeTab === 'for_you' && signedIn && feedMeta.personalized && (
                <ForYouRails />
              )}

              {/* Cold-start interest picker — real explicit preferences */}
              {activeTab === 'for_you' && signedIn && feedMeta.personalized && feedMeta.coldStart && (
                <InterestPicker onApplied={() => fetchFeed(true)} />
              )}

              {items.map(item => (
                <FeedCard
                  key={item.id}
                  item={item}
                  onReaction={handleReaction}
                  onUpvote={handleUpvote}
                  onShare={handleShare}
                  onReport={handleReport}
                  onNotInterested={signedIn ? handleNotInterested : null}
                  onHide={signedIn ? handleHide : null}
                />
              ))}
            </div>
          )}

          {/* Load More Trigger */}
          {hasMore && !loading && (
            <div ref={loadMoreRef} className="py-8 flex justify-center">
              {loadingMore && (
                <div className="flex items-center gap-2 text-zinc-400">
                  <Loader2 className="w-4 h-4 animate-spin text-[#ff4d00]" />
                  <span className="text-xs font-mono">Loading more...</span>
                </div>
              )}
            </div>
          )}

          {/* End of Feed */}
          {!hasMore && !loading && items.length > 0 && (
            <div className="text-center py-8 border-t border-[#222]">
              <p className="text-xs text-zinc-500 font-mono">
                🔥 You&apos;ve seen it all. Come back later for more burns.
              </p>
            </div>
          )}
        </div>

        {/* ═══ Desktop Right Sidebar ═══ */}
        <aside className="hidden xl:block w-80 shrink-0 pl-8 pr-4 py-6 space-y-6">
          {/* Personalized creator discovery (signed-in viewers only) */}
          <PeopleYouMayLike signedIn={signedIn} />
          <TrendingSidebar />
        </aside>
      </div>
    </div>
  );
}
