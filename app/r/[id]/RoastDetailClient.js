'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowBigUp, Share2, Flame } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { ReactionSummary, getParticipantId } from '@/components/feed/ReactionBar';
import CommentThread from '@/components/comments/CommentThread';
import { track } from '@/lib/analytics';

/**
 * RoastDetailClient — Full roast detail with reactions and comments.
 */

function timeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diff = Math.max(0, Math.floor((now - past) / 1000));
  if (diff < 60) return 'just now';
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function getPlatformBadge(platform) {
  switch (platform?.toLowerCase()) {
    case 'x': case 'x / twitter': return { variant: 'info', label: 'X' };
    case 'linkedin': return { variant: 'sky', label: 'LinkedIn' };
    case 'github': return { variant: 'emerald', label: 'GitHub' };
    case 'instagram': return { variant: 'pink', label: 'Instagram' };
    default: return { variant: 'burn', label: platform || 'Roast' };
  }
}

export default function RoastDetailClient({ roast, relatedRoasts = [] }) {
  const [upvoted, setUpvoted] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(roast.upvotes || 0);
  const [shared, setShared] = useState(false);
  const [reactions, setReactions] = useState({});
  const [participantReaction, setParticipantReaction] = useState(null);

  const profile = roast.profiles;
  const platformBadge = profile?.platform ? getPlatformBadge(profile.platform) : null;

  // Fetch reaction state
  useEffect(() => {
    const fetchReactions = async () => {
      try {
        const participantId = getParticipantId();
        const res = await fetch(`/api/reactions?target_type=roast&target_id=${roast.id}&participant_id=${encodeURIComponent(participantId)}`);
        const data = await res.json();
        if (data.counts) setReactions(data.counts);
        if (data.participantReaction) setParticipantReaction(data.participantReaction);
      } catch {}
    };
    fetchReactions();
  }, [roast.id]);

  const handleUpvote = useCallback(() => {
    if (upvoted) return;
    setUpvoted(true);
    setUpvoteCount(prev => prev + 1);
    track('upvote_added', { itemId: roast.id, context: 'detail' });
  }, [upvoted, roast.id]);

  const handleShare = useCallback(async () => {
    const text = `"${roast.roast_text}" — via BurnBoard`;
    const url = typeof window !== 'undefined' ? window.location.href : '';

    if (navigator.share) {
      try {
        await navigator.share({ title: `🔥 Roast on BurnBoard`, text, url });
      } catch {}
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
    track('content_shared', { itemId: roast.id, context: 'detail' });
  }, [roast]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          href="/home"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed</span>
        </Link>

        {/* Main Roast Card */}
        <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden">
          {/* Author Header */}
          <div className="p-5 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-3">
              <Link href={profile?.username ? `/u/${profile.username}` : '#'}>
                <Avatar
                  username={profile?.username || roast.anon_id || '?'}
                  size="lg"
                  color={profile?.avatar_color}
                />
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={profile?.username ? `/u/${profile.username}` : '#'}
                    className="text-base font-bold text-white hover:text-[#ff4d00] transition-colors"
                  >
                    @{profile?.username || 'target'}
                  </Link>
                  {platformBadge && (
                    <Badge variant={platformBadge.variant} size="xs">
                      {platformBadge.label}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 mt-1">
                  <span>Roasted by</span>
                  <span className="text-[#ff4d00] font-bold">{roast.anon_id || 'Anonymous'}</span>
                  <span>·</span>
                  <time dateTime={roast.created_at}>{timeAgo(roast.created_at)}</time>
                </div>
              </div>
            </div>
          </div>

          {/* Roast Content */}
          <div className="p-5 sm:p-6">
            <p className="text-lg sm:text-xl text-white leading-relaxed font-medium select-text">
              &ldquo;{roast.roast_text}&rdquo;
            </p>
          </div>

          {/* Interaction Bar */}
          <div className="px-5 sm:px-6 pb-5 sm:pb-6">
            <div className="flex items-center justify-between pt-4 border-t border-[#1a1a1a]">
              {/* Upvote */}
              <button
                onClick={handleUpvote}
                disabled={upvoted}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-mono font-black transition-all duration-150 active:scale-90 ${
                  upvoted
                    ? 'bg-[#ff4d00] text-black border-[#ff4d00] shadow-[0_0_12px_rgba(255,77,0,0.4)]'
                    : 'bg-[#0a0a0a] text-zinc-400 border-[#262626] hover:text-white hover:border-[#3a3a3a]'
                }`}
              >
                <ArrowBigUp className={`w-5 h-5 ${upvoted ? 'fill-black text-black' : ''}`} />
                <span>{formatCount(upvoteCount)}</span>
              </button>

              {/* Reactions (7 types) */}
              <ReactionSummary
                itemId={roast.id}
                targetType="roast"
                reactions={reactions}
                participantReaction={participantReaction}
              />

              {/* Share */}
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-mono text-zinc-400 hover:text-[#ff4d00] hover:bg-[#1a1a1a] transition-all"
              >
                <Share2 className="w-4 h-4" />
                <span className="text-xs">{shared ? 'Copied!' : 'Share'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
          <CommentThread
            targetType="roast"
            targetId={roast.id}
          />
        </div>

        {/* Target Profile Card */}
        {profile && (
          <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
            <h3 className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider mb-3">
              TARGET
            </h3>
            <Link
              href={`/post/${profile.id}`}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#1a1a1a] transition-all group"
            >
              <Avatar
                username={profile.username}
                size="md"
                color={profile.avatar_color}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white group-hover:text-[#ff4d00] transition-colors">
                  @{profile.username}
                </p>
                {profile.bio && (
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">{profile.bio}</p>
                )}
              </div>
              <span className="text-[11px] font-mono text-zinc-500">
                🔥 {profile.roast_count || 0} roasts
              </span>
            </Link>
          </div>
        )}

        {/* Related Roasts */}
        {relatedRoasts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider">
              MORE ROASTS FOR @{profile?.username?.toUpperCase()}
            </h3>
            {relatedRoasts.map(r => (
              <Link
                key={r.id}
                href={`/r/${r.id}`}
                className="block bg-[#111] border border-[#222] hover:border-[#333] rounded-2xl p-4 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-[#ff4d00] font-black font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff4d00]" />
                    {r.anon_id || 'Anonymous'}
                  </span>
                  <span className="text-[10px] text-zinc-600 font-mono">{timeAgo(r.created_at)}</span>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed group-hover:text-white transition-colors line-clamp-2">
                  &ldquo;{r.roast_text}&rdquo;
                </p>
                <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-zinc-500">
                  <span>▲ {formatCount(r.upvotes || 0)}</span>
                  <span>🔥 {(r.reaction_haha || 0) + (r.reaction_brutal || 0) + (r.reaction_cry || 0)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
