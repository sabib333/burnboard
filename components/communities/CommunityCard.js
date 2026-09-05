'use client';

import React from 'react';
import Link from 'next/link';
import { Users, Flame } from 'lucide-react';

/**
 * CommunityCard — Real community identity for discovery surfaces
 * (hub page, explore, search results).
 */

const COLORS = [
  'bg-[#ff4d00] text-black',
  'bg-blue-600 text-white',
  'bg-emerald-600 text-white',
  'bg-purple-600 text-white',
  'bg-pink-600 text-white',
  'bg-amber-500 text-black',
  'bg-cyan-600 text-white',
  'bg-rose-600 text-white',
];

function getColorFromName(name) {
  if (!name) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/[\s._-]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatCount(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function CommunityCard({ community, showJoinState = true }) {
  const isMember = showJoinState && community.viewer_membership?.isMember;
  const isOwner = community.viewer_membership?.role === 'owner';
  const initials = getInitials(community.name);
  const color = getColorFromName(community.name);

  return (
    <Link
      href={`/c/${community.slug}`}
      className="group bg-[#111] border border-[#222] hover:border-[#ff4d00]/40 rounded-2xl p-4 transition-all duration-200 hover:shadow-[0_0_20px_rgba(255,77,0,0.08)] block"
    >
      <div className="flex items-start gap-3">
        {community.avatar_url ? (
          <img
            src={community.avatar_url}
            alt={community.name}
            className="w-11 h-11 rounded-xl object-cover shrink-0"
            loading="lazy"
          />
        ) : (
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${color}`}>
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-bold text-white truncate group-hover:text-[#ff4d00] transition-colors">
              {community.name}
            </p>
            {isMember && (
              <span
                className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                  isOwner
                    ? 'bg-[#ff4d00]/15 text-[#ff4d00] border-[#ff4d00]/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {isOwner ? 'Owner' : 'Joined'}
              </span>
            )}
          </div>
          {community.description && (
            <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5 line-clamp-2">
              {community.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1a1a1a] text-[11px] font-mono text-zinc-500">
        <span className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{formatCount(community.member_count || 0)} members</span>
        </span>
        <span className="flex items-center gap-1 text-[#ff4d00] group-hover:text-white transition-colors font-bold">
          <Flame className="w-3 h-3" aria-hidden="true" />
          Visit
        </span>
      </div>
    </Link>
  );
}