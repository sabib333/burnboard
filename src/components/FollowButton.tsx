import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { notifyFollow, getUnreadCount } from '../lib/notify';

interface FollowButtonProps {
  followingId: string;
  onFollowChange?: (isFollowing: boolean) => void;
  /** Called after follow/unfollow to trigger SWR revalidation */
  onMutate?: () => void;
  size?: 'sm' | 'md';
  showCount?: boolean;
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  followingId,
  onFollowChange,
  onMutate,
  size = 'md',
  showCount = false,
}) => {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  // Check follow status on mount — uses cached counts (not COUNT query)
  useEffect(() => {
    if (!user || !isSupabaseConfigured || !supabase) return;

    const checkFollowStatus = async () => {
      try {
        const { isFollowing: alreadyFollowing } = await import('../lib/follows').then(m =>
          m.isFollowing(user.id, followingId).then(f => ({ isFollowing: f }))
        );
        setIsFollowing(alreadyFollowing);

        // Read follower count from cached column (O(1), not COUNT)
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('follower_count')
          .eq('id', followingId)
          .maybeSingle();
        setFollowerCount(profile?.follower_count || 0);
      } catch {}
    };

    checkFollowStatus();
  }, [user, followingId]);

  const handleToggle = useCallback(async () => {
    if (!user || !isSupabaseConfigured || !supabase || loading) return;
    if (user.id === followingId) return;

    setLoading(true);
    try {
      if (isFollowing) {
        // Unfollow — uses cached columns for counter
        const { unfollowUser } = await import('../lib/follows');
        await unfollowUser(user.id, followingId);

        setIsFollowing(false);
        setFollowerCount(prev => Math.max(0, prev - 1));
        onFollowChange?.(false);
        onMutate?.();
      } else {
        // Follow — uses RPC for atomic counter increment
        const { followUser } = await import('../lib/follows');
        await followUser(user.id, followingId);

        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
        onFollowChange?.(true);
        onMutate?.();

        // Create notification
        const { data: myProfile } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        if (myProfile) {
          await notifyFollow(followingId, myProfile.username);
        }

        try { navigator.vibrate?.(50); } catch {}
      }
    } catch (err) {
      console.warn('Follow toggle failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user, followingId, isFollowing, loading, onFollowChange]);

  // Don't show for own profile or if not logged in
  if (!user || user.id === followingId) return null;

  const isSmall = size === 'sm';

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-1.5 font-bold rounded-xl transition-all disabled:opacity-50 ${
        isSmall ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-xs'
      } ${
        isFollowing
          ? 'bg-[#222] text-zinc-300 border border-[#333] hover:border-red-500/50 hover:text-red-400'
          : 'bg-white text-black hover:bg-zinc-200 shadow-sm'
      }`}
    >
      {loading ? (
        <Loader2 className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} animate-spin`} />
      ) : isFollowing ? (
        <UserMinus className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
      ) : (
        <UserPlus className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
      )}
      <span>{isFollowing ? 'Following' : 'Follow'}</span>
    </button>
  );
};
