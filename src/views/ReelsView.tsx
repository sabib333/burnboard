/**
 * BURNBOARD ReelsView
 *
 * Instagram Reels-style vertical snap-scroll feed.
 * - Shows top 20 profiles sorted by algorithm score
 * - Each "reel" is a full-height card
 * - Right-side action buttons: upvote, reaction, share, remix
 * - Swipe/scroll to navigate between profiles
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Flame, ArrowBigUp, Share2, MessageSquare, Skull, Zap, Trophy, TrendingUp, ChevronDown, Loader2 } from 'lucide-react';
import { Profile, Roast } from '../types';

function timeAgo(dateString: string): string {
  if (!dateString) return '';
  const now = Date.now();
  const past = new Date(dateString).getTime();
  const diff = Math.max(0, Math.floor((now - past) / 1000));
  if (diff < 60) return 'just now';
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface ReelsViewProps {
  profiles: Profile[];
  roasts: Roast[];
  onOpenProfile: (profileId: string) => void;
  onUpvoteRoast: (roastId: string) => void;
  onReactRoast: (roastId: string, type: 'haha' | 'brutal' | 'cry') => void;
  onShareRoast: (roast: Roast) => void;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export const ReelsView: React.FC<ReelsViewProps> = ({
  profiles,
  roasts,
  onOpenProfile,
  onUpvoteRoast,
  onReactRoast,
  onShareRoast,
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [upvotedRoasts, setUpvotedRoasts] = useState<Set<string>>(new Set());
  const [reactedRoasts, setReactedRoasts] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Top 20 profiles by roast count + upvotes
  const topProfiles = useMemo(() => {
    return [...profiles]
      .sort((a, b) => {
        const scoreA = (a.roast_count || 0) * 2 + (a.total_upvotes || 0);
        const scoreB = (b.roast_count || 0) * 2 + (b.total_upvotes || 0);
        return scoreB - scoreA;
      })
      .slice(0, 20);
  }, [profiles]);

  const handleUpvote = useCallback((roastId: string) => {
    if (upvotedRoasts.has(roastId)) return;
    setUpvotedRoasts(prev => new Set(prev).add(roastId));
    onUpvoteRoast(roastId);
  }, [upvotedRoasts, onUpvoteRoast]);

  const handleReact = useCallback((roastId: string, type: 'haha' | 'brutal' | 'cry') => {
    const key = `${roastId}_${type}`;
    if (reactedRoasts.has(key)) return;
    setReactedRoasts(prev => new Set(prev).add(key));
    onReactRoast(roastId, type);
  }, [reactedRoasts, onReactRoast]);

  // Handle snap scroll to update current index
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const scrollTop = el.scrollTop;
    const height = el.clientHeight;
    const newIndex = Math.round(scrollTop / height);
    if (newIndex !== currentIdx && newIndex >= 0 && newIndex < topProfiles.length) {
      setCurrentIdx(newIndex);
    }
  }, [currentIdx, topProfiles.length]);

  if (topProfiles.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center space-y-4 p-8">
          <div className="text-5xl">🔥</div>
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">
            No profiles to show
          </h2>
          <p className="text-xs text-zinc-400 max-w-sm">
            Submit some targets to start roasting in Reels mode!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-[calc(100vh-8rem)] overflow-y-scroll snap-y snap-mandatory scroll-smooth"
    >
      {topProfiles.map((profile, idx) => {
        const profileRoasts = roasts.filter(r => r.profile_id === profile.id);
        const topRoast = profileRoasts.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))[0];
        const isCurrent = idx === currentIdx;

        const getPlatformBg = (platform: string) => {
          switch (platform?.toLowerCase()) {
            case 'x': case 'twitter': return 'from-blue-600/30 to-blue-900/10';
            case 'linkedin': return 'from-sky-600/30 to-sky-900/10';
            case 'github': return 'from-emerald-600/30 to-emerald-900/10';
            case 'instagram': return 'from-pink-600/30 to-pink-900/10';
            default: return 'from-[#ff4d00]/30 to-orange-900/10';
          }
        };

        return (
          <div
            key={profile.id}
            className={`snap-start h-[calc(100vh-8rem)] flex items-center justify-center bg-gradient-to-b ${getPlatformBg(profile.platform)}`}
          >
            <div className="w-full max-w-md mx-4">
              {/* Main Card */}
              <div className="bg-[#111] border border-[#222] rounded-3xl overflow-hidden shadow-2xl">
                {/* Profile Header */}
                <div className="p-5 pb-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-black shrink-0 shadow-lg ${
                        profile.avatar_color || 'bg-[#ff4d00] text-black'
                      }`}
                    >
                      {profile.avatar_letter}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-base truncate">
                          @{profile.username}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider bg-[#222] text-zinc-300 border-[#333]">
                          {profile.platform}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-xs mt-1 line-clamp-2">
                        {profile.bio}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs font-mono text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Flame className="w-3 h-3 text-[#ff4d00]" />
                          <span className="text-zinc-300 font-bold">{formatCount(profile.roast_count || 0)}</span>
                          roasts
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="text-zinc-300 font-bold">▲ {formatCount(profile.total_upvotes || 0)}</span>
                          upvotes
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Roast or Empty State */}
                <div className="px-5 pb-4">
                  {topRoast ? (
                    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] text-[#ff4d00] font-mono font-bold">
                          🔥 Top Burn
                        </span>
                        <span className="text-[10px] text-zinc-600 font-mono">
                          {timeAgo(topRoast.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-100 leading-relaxed font-normal select-text">
                        &ldquo;{topRoast.roast_text}&rdquo;
                      </p>
                      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-[#1a1a1a]">
                        <button
                          onClick={() => handleUpvote(topRoast.id)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                            upvotedRoasts.has(topRoast.id)
                              ? 'bg-[#ff4d00] text-black'
                              : 'bg-[#141414] text-zinc-400 hover:text-white border border-[#262626]'
                          }`}
                        >
                          <ArrowBigUp className="w-3.5 h-3.5" />
                          {formatCount(topRoast.upvotes || 0)}
                        </button>
                        <button
                          onClick={() => handleReact(topRoast.id, 'haha')}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all ${
                            reactedRoasts.has(`${topRoast.id}_haha`)
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-[#141414] text-zinc-400 hover:text-white border border-[#262626]'
                          }`}
                        >
                          😂 {topRoast.reaction_haha || 0}
                        </button>
                        <button
                          onClick={() => handleReact(topRoast.id, 'brutal')}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all ${
                            reactedRoasts.has(`${topRoast.id}_brutal`)
                              ? 'bg-[#ff4d00]/20 text-[#ff4d00]'
                              : 'bg-[#141414] text-zinc-400 hover:text-white border border-[#262626]'
                          }`}
                        >
                          💀 {topRoast.reaction_brutal || 0}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#0a0a0a] rounded-2xl p-6 text-center border border-dashed border-[#222]">
                      <p className="text-xs text-zinc-500 font-mono">
                        No burns yet — be the first to roast 🔥
                      </p>
                    </div>
                  )}
                </div>

                {/* Bottom Action Bar */}
                <div className="px-5 pb-5 flex items-center justify-between">
                  <button
                    onClick={() => onOpenProfile(profile.id)}
                    className="text-xs text-[#ff4d00] font-mono font-bold hover:underline"
                  >
                    View All Burns →
                  </button>
                  <div className="flex items-center gap-2">
                    {topRoast && (
                      <button
                        onClick={() => onShareRoast(topRoast)}
                        className="p-2 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] text-zinc-400 hover:text-white border border-[#262626] transition-colors"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Scroll indicator */}
              {idx < topProfiles.length - 1 && (
                <div className="flex justify-center mt-3">
                  <ChevronDown className="w-5 h-5 text-zinc-600 animate-bounce" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ReelsView;
