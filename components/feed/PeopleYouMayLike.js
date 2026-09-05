'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import FollowButton from '@/components/social/FollowButton';

/**
 * PeopleYouMayLike — desktop sidebar creator discovery rail.
 *
 * Personalized for the signed-in viewer via /api/recommendations/creators
 * (shared memberships, friend-of-friend, genuine engagement affinity).
 * Renders nothing when signed out or when there is nothing to suggest.
 * Following removes the row immediately — real, database-backed.
 */

function formatCount(n) {
  if (!n && n !== 0) return '';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function PeopleYouMayLike({ signedIn }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(signedIn);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!signedIn) {
      setHidden(true);
      return;
    }
    let cancelled = false;
    const fetchSuggestions = async () => {
      try {
        const res = await fetch('/api/recommendations/creators?limit=6');
        if (!res.ok) throw new Error('unavailable');
        const data = await res.json();
        if (!cancelled) {
          setItems(data.items || []);
          if (!(data.items || []).length) setHidden(true);
        }
      } catch {
        if (!cancelled) setHidden(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchSuggestions();
    return () => { cancelled = true; };
  }, [signedIn]);

  const handleFollowChange = useCallback((username) => (isFollowing) => {
    if (isFollowing) {
      setItems(prev => prev.filter(p => p.username !== username));
    }
  }, []);

  if (hidden) return null;

  return (
    <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#222] flex items-center gap-2">
        <Users className="w-4 h-4 text-[#ff4d00]" />
        <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
          People you may like
        </h3>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-[#222]" />
              <div className="flex-1 space-y-1.5">
                <div className="w-20 h-2.5 bg-[#222] rounded" />
                <div className="w-32 h-2 bg-[#1a1a1a] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-[#1a1a1a]">
          {items.map(person => (
            <div key={person.id} className="px-4 py-3 flex items-center gap-3">
              <Link href={`/u/${person.username}`} className="shrink-0">
                <Avatar username={person.username} size="sm" src={person.avatarUrl} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/u/${person.username}`}
                  className="text-xs font-bold text-white hover:text-[#ff4d00] transition-colors truncate block"
                >
                  @{person.username}
                </Link>
                <p className="text-[10px] font-mono text-zinc-500 truncate">
                  {person.reason?.text || 'Worth checking out'}
                  {person.followerCount > 0 && (
                    <span className="text-zinc-600"> · {formatCount(person.followerCount)} followers</span>
                  )}
                </p>
              </div>
              <FollowButton
                targetUserId={person.id}
                initialIsFollowing={false}
                initialFollowerCount={person.followerCount || 0}
                label={person.mutual ? 'Follow back' : 'Follow'}
                size="sm"
                variant="secondary"
                onFollowChange={handleFollowChange(person.username)}
                className="shrink-0"
              />
            </div>
          ))}
        </div>
      )}

      <Link
        href="/discover"
        className="block px-4 py-3 border-t border-[#222] text-center text-[11px] font-mono text-[#ff4d00] hover:text-white transition-colors"
      >
        Discover more people →
      </Link>
    </div>
  );
}
