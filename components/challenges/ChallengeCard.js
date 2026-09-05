'use client';

import React from 'react';
import Link from 'next/link';
import { Users, Clock, CheckCircle2, XCircle } from 'lucide-react';

/**
 * ChallengeCard — discovery card for real challenges.
 * Always renders real data (creator, participants, status) — never placeholders.
 */

export const CHALLENGE_TYPE_META_UI = {
  opinion: { icon: '💬', label: 'Opinion', color: 'text-blue-400' },
  question: { icon: '❓', label: 'Question', color: 'text-purple-400' },
  poll: { icon: '🗳', label: 'Poll', color: 'text-amber-400' },
  photo: { icon: '📸', label: 'Photo', color: 'text-pink-400' },
  hot_take: { icon: '🌶', label: 'Hot Take', color: 'text-red-400' },
};

function timeLeft(endsAt) {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'ended';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return `${Math.max(1, Math.floor(diff / (1000 * 60)))}m left`;
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}

function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function ChallengeCard({ challenge, compact = false }) {
  const meta = CHALLENGE_TYPE_META_UI[challenge.challenge_type] || CHALLENGE_TYPE_META_UI.opinion;
  const endsLabel = timeLeft(challenge.ends_at);
  const ended = challenge.status === 'ended';
  const cancelled = challenge.status === 'cancelled';
  const isActive = challenge.status === 'active';

  return (
    <Link href={`/challenges/${challenge.slug}`} className="block group">
      <article
        className={`bg-[#111] border rounded-2xl transition-all duration-200 group-hover:shadow-[0_0_20px_rgba(255,77,0,0.08)] ${
          cancelled
            ? 'border-[#262626] opacity-60'
            : ended
              ? 'border-[#2a2a2a]'
              : 'border-[#222] group-hover:border-[#ff4d00]/40'
        } ${compact ? 'p-4' : 'p-5'} h-full`}
        aria-label={`${challenge.title} — ${meta.label} challenge`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl" aria-hidden="true">{meta.icon}</span>
            <span className={`text-[10px] font-mono font-black uppercase tracking-wider ${meta.color}`}>
              {meta.label}
            </span>
          </div>
          {cancelled ? (
            <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 shrink-0">
              <XCircle className="w-3 h-3" /> Cancelled
            </span>
          ) : ended ? (
            <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 shrink-0">
              <CheckCircle2 className="w-3 h-3" /> Ended
            </span>
          ) : (
            endsLabel && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-[#ff4d00] shrink-0">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {endsLabel}
              </span>
            )
          )}
        </div>

        <h3 className={`font-bold text-white group-hover:text-[#ff4d00] transition-colors mt-2 leading-snug ${compact ? 'text-sm' : 'text-base'}`}>
          {challenge.title}
        </h3>

        {!compact && challenge.description && (
          <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed line-clamp-2">
            {challenge.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-3 text-[11px] font-mono text-zinc-500">
          {challenge.community && (
            <span className="px-2 py-0.5 rounded-md bg-[#1a1a1a] border border-[#262626] text-zinc-300 truncate max-w-[140px]">
              {challenge.community.name}
            </span>
          )}
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1a1a1a] border border-[#262626]">
            <Users className="w-3 h-3" aria-hidden="true" />
            {formatCount(challenge.participant_count || 0)}
          </span>
          {isActive && challenge.creator?.username && (
            <span className="truncate">by @{challenge.creator.username}</span>
          )}
        </div>
      </article>
    </Link>
  );
}
