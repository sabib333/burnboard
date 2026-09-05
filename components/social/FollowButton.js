'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { getParticipantId } from '@/components/feed/ReactionBar';
import { track } from '@/lib/analytics';

/**
 * FollowButton — Follow/Unfollow button with optimistic UI.
 * 
 * Props:
 *   - targetUserId: string (required)
 *   - initialIsFollowing: boolean
 *   - initialFollowerCount: number
 *   - size: 'sm' | 'md' | 'lg'
 *   - variant: 'primary' | 'secondary'
 *   - onFollowChange: callback when follow state changes
 *   - label: optional custom text for the follow action (e.g. "Follow back"
 *     for mutual suggestions). Defaults to "Follow".
 */
export default function FollowButton({
  targetUserId,
  initialIsFollowing = false,
  initialFollowerCount = 0,
  size = 'md',
  variant = 'primary',
  onFollowChange,
  className = '',
  label = 'Follow',
}) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [loading, setLoading] = useState(false);

  // Sync with prop changes
  useEffect(() => {
    setIsFollowing(initialIsFollowing);
  }, [initialIsFollowing]);

  useEffect(() => {
    setFollowerCount(initialFollowerCount);
  }, [initialFollowerCount]);

  const handleToggle = useCallback(async () => {
    if (loading) return;

    const viewerId = getParticipantId();
    if (!viewerId || viewerId === targetUserId) return;

    const previousState = isFollowing;
    const previousCount = followerCount;

    // Optimistic update
    setIsFollowing(!isFollowing);
    setFollowerCount(prev => isFollowing ? prev - 1 : prev + 1);
    setLoading(true);

    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: targetUserId,
          action: isFollowing ? 'unfollow' : 'follow',
          viewer_id: viewerId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setIsFollowing(data.isFollowing);
        setFollowerCount(data.followerCount);
        onFollowChange?.(data.isFollowing, data.followerCount);

        track(data.isFollowing ? 'follow_succeeded' : 'unfollow_succeeded', {
          targetUserId,
          followerCount: data.followerCount,
        });
      } else {
        // Rollback
        setIsFollowing(previousState);
        setFollowerCount(previousCount);
      }
    } catch {
      // Rollback
      setIsFollowing(previousState);
      setFollowerCount(previousCount);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, isFollowing, followerCount, loading, onFollowChange]);

  // Don't show button for own profile
  const viewerId = typeof window !== 'undefined' ? localStorage.getItem('burnboard_participant_id') : null;
  if (viewerId === targetUserId) return null;

  const sizes = {
    sm: 'px-3 py-1.5 text-[10px]',
    md: 'px-4 py-2 text-xs',
    lg: 'px-5 py-2.5 text-sm',
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-1.5 font-bold rounded-xl transition-all duration-150 active:scale-95 disabled:opacity-50 ${
        sizes[size]
      } ${
        isFollowing
          ? 'bg-[#1a1a1a] border border-[#333] text-zinc-300 hover:border-red-500/50 hover:text-red-400'
          : variant === 'primary'
            ? 'bg-[#ff4d00] hover:bg-[#ff6622] text-black shadow-[0_0_12px_rgba(255,77,0,0.3)]'
            : 'bg-[#1a1a1a] border border-[#333] text-white hover:border-[#ff4d00]/50'
      } font-mono ${className}`}
      aria-label={isFollowing ? 'Unfollow' : label}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : isFollowing ? (
        <>
          <UserMinus className="w-3.5 h-3.5" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="w-3.5 h-3.5" />
          {label}
        </>
      )}
    </button>
  );
}
