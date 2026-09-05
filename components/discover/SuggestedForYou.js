'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import FollowButton from '@/components/social/FollowButton';

/**
 * SuggestedForYou — \"Suggested for you\" section on the Discover page.
 *
 * Lists people who already follow the viewer and whom the viewer hasn't
 * followed back yet (mutual-follow suggestions, via `/api/recommendations/
 * creators?mutual=1`). Renders nothing when signed out, on error, or when
 * there are no suggestions. Following someone removes the row immediately.
 */

function formatCount(n) {
  if (!n && n !== 0) return '';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function SuggestedForYou() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  // The recommendations endpoint requires a real Supabase session, so the
  // API response itself is the auth signal: anonymous visitors get a 401 and
  // this section hides itself (no localStorage participant spoofing).
  useEffect(() => {
    let cancelled = false;
    const fetchSuggestions = async () => {
      try {
        const res = await fetch('/api/recommendations/creators?limit=12&mutual=1');
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
  }, []);

  const handleFollowChange = useCallback((username) => (isFollowing) => {
    if (isFollowing) {
      setItems(prev => prev.filter(p => p.username !== username));
    }
  }, []);

  if (hidden) return null;

  return (
    <section className="space-y-4" aria-labelledby="suggested-for-you-title">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#ff4d00]" />
        <h2
          id="suggested-for-you-title"
          className="text-sm font-black text-white uppercase tracking-wider font-mono"
        >
          Suggested for you
        </h2>
        {!loading && items.length > 0 && (
          <span className="text-[10px] font-mono text-zinc-500 bg-[#1a1a1a] px-2 py-0.5 rounded-full border border-[#262626]">
            {items.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#111] border border-[#222] rounded-2xl p-4 flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-[#222]" />
              <div className="flex-1 space-y-2">
                <div className="w-24 h-3 bg-[#222] rounded" />
                <div className="w-32 h-2.5 bg-[#1a1a1a] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map(person => (
            <div
              key={person.id}
              className="bg-[#111] border border-[#222] hover:border-[#ff4d00]/40 rounded-2xl p-4 flex items-center gap-3 transition-all"
            >
              <Link href={`/u/${person.username}`} className="shrink-0">
                <Avatar username={person.username} size="md" src={person.avatarUrl} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/u/${person.username}`}
                  className="text-sm font-bold text-white hover:text-[#ff4d00] transition-colors truncate block"
                >
                  @{person.username}
                </Link>
                <p className="text-[10px] font-mono text-zinc-500 truncate">
                  {person.reason?.text || 'Follows you'}
                  {person.followerCount > 0 && (
                    <span className="text-zinc-600"> · {formatCount(person.followerCount)} followers</span>
                  )}
                </p>
              </div>
              <FollowButton
                targetUserId={person.id}
                initialIsFollowing={false}
                initialFollowerCount={person.followerCount || 0}
                label="Follow back"
                size="sm"
                variant="secondary"
                onFollowChange={handleFollowChange(person.username)}
                className="shrink-0"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}