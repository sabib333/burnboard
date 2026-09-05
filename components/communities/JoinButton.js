'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, UserMinus, Loader2, UserCheck } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { track } from '@/lib/analytics';

/**
 * JoinButton — Join/Leave a community with optimistic UI.
 *
 * Membership is auth-based and server-validated; this button only submits
 * the action, it never grants anything itself.
 *
 * Props:
 *   - communityId: string
 *   - initialIsMember: boolean
 *   - initialMemberCount: number
 *   - isOwner: boolean (owners cannot leave — owner safety)
 *   - size: 'sm' | 'md' | 'lg'
 *   - onStateChange: (isMember, memberCount) => void
 */
export default function JoinButton({
  communityId,
  initialIsMember = false,
  initialMemberCount = 0,
  isOwner = false,
  size = 'md',
  onStateChange,
  className = '',
}) {
  const router = useRouter();
  const [isMember, setIsMember] = useState(initialIsMember);
  const [memberCount, setMemberCount] = useState(initialMemberCount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsMember(initialIsMember);
  }, [initialIsMember]);

  useEffect(() => {
    setMemberCount(initialMemberCount);
  }, [initialMemberCount]);

  const handleToggle = useCallback(async () => {
    if (loading) return;

    // Membership requires a real account
    if (!isSupabaseConfigured || !supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth');
      return;
    }

    const previousState = isMember;
    const previousCount = memberCount;

    // Optimistic update
    setIsMember(!isMember);
    setMemberCount(prev => (isMember ? Math.max(0, prev - 1) : prev + 1));
    setLoading(true);

    try {
      const res = await fetch(`/api/communities/${communityId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isMember ? 'leave' : 'join' }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const finalMember =
          data.action === 'joined' ? true : data.action === 'left' ? false : data.isMember;
        setIsMember(finalMember);
        if (typeof data.memberCount === 'number') {
          setMemberCount(data.memberCount);
        }
        onStateChange?.(finalMember, typeof data.memberCount === 'number' ? data.memberCount : memberCount);
        track(finalMember ? 'community_joined' : 'community_left', { communityId });
      } else {
        // Rollback
        setIsMember(previousState);
        setMemberCount(previousCount);
      }
    } catch {
      setIsMember(previousState);
      setMemberCount(previousCount);
    } finally {
      setLoading(false);
    }
  }, [communityId, isMember, memberCount, loading, onStateChange, router]);

  // Owners cannot leave (owner safety) — show a locked owner state instead
  if (isOwner) {
    return (
      <span
        className={`inline-flex items-center justify-center gap-1.5 font-bold rounded-xl font-mono bg-[#1a1a1a] border border-[#333] text-zinc-400 ${className}`}
        title="As the owner you manage this community"
      >
        <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
        Owner
      </span>
    );
  }

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
        isMember
          ? 'bg-[#1a1a1a] border border-[#333] text-zinc-300 hover:border-red-500/50 hover:text-red-400'
          : 'bg-[#ff4d00] hover:bg-[#ff6622] text-black shadow-[0_0_12px_rgba(255,77,0,0.3)]'
      } font-mono ${className}`}
      aria-label={isMember ? 'Leave community' : 'Join community'}
      aria-pressed={isMember}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
      ) : isMember ? (
        <>
          <UserMinus className="w-3.5 h-3.5" aria-hidden="true" />
          Joined
        </>
      ) : (
        <>
          <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
          Join
        </>
      )}
    </button>
  );
}