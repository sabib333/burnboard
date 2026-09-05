'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Compass, Trophy, Users, Flame, Clock } from 'lucide-react';

/**
 * ForYouRails — Communities & Challenges discovery rails for the For You tab.
 *
 * Personalized for the signed-in viewer:
 *   - /api/recommendations/communities (topic/interest overlap + real activity)
 *   - /api/recommendations/challenges  (community/format relevance, real participation)
 *
 * All counts displayed are real. Renders nothing when signed out, on error,
 * or when there is genuinely nothing to suggest.
 */

const TYPE_META = {
  opinion: { icon: '💬', label: 'OPINION' },
  question: { icon: '❓', label: 'QUESTION' },
  poll: { icon: '🗳', label: 'POLL' },
  photo: { icon: '📸', label: 'PHOTO' },
  hot_take: { icon: '🌶', label: 'HOT TAKE' },
};

function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function endsLabel(endsAt) {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ending soon';
  const h = Math.floor(diff / (60 * 60 * 1000));
  if (h < 1) return 'Ends in <1h';
  if (h < 24) return `Ends in ${h}h`;
  return `Ends in ${Math.floor(h / 24)}d`;
}

function Section({ icon: Icon, title, children }) {
  return (
    <section aria-label={title}>
      <div className="flex items-center gap-2 px-1">
        <Icon className="w-4 h-4 text-[#ff4d00]" />
        <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
          {title}
        </h3>
      </div>
      <div className="mt-2.5 flex gap-3 overflow-x-auto pb-2 snap-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </section>
  );
}

function Card({ children, href, className = '' }) {
  return (
    <Link
      href={href}
      className={`snap-start shrink-0 w-60 max-w-[70vw] bg-[#141414] border border-[#262626] hover:border-[#ff4d00]/40 rounded-2xl p-3.5 transition-all hover:bg-[#181818] block ${className}`}
    >
      {children}
    </Link>
  );
}

function Reason({ reason }) {
  if (!reason?.text) return null;
  return <p className="text-[10px] font-mono text-zinc-500 mt-1.5 truncate">{reason.text}</p>;
}

export default function ForYouRails() {
  const [communities, setCommunities] = useState(null); // null = loading
  const [challenges, setChallenges] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      const [commRes, chalRes] = await Promise.allSettled([
        fetch('/api/recommendations/communities?limit=6'),
        fetch('/api/recommendations/challenges?limit=6'),
      ]);

      const resolve = (settled, fallback) => {
        if (settled.status !== 'fulfilled') return fallback;
        try {
          if (!settled.value.ok) return fallback;
          return settled.value.json();
        } catch {
          return fallback;
        }
      };

      const commData = resolve(commRes, { items: [] });
      const chalData = resolve(chalRes, { items: [] });

      if (!cancelled) {
        setCommunities(commData.items || []);
        setChallenges(chalData.items || []);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  const loading = communities === null || challenges === null;
  const hasAny = (!loading && (communities.length > 0 || challenges.length > 0));

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse" aria-hidden="true">
        <div className="h-4 w-44 bg-[#1f1f1f] rounded" />
        <div className="flex gap-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="w-60 h-24 bg-[#151515] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasAny) return null;

  return (
    <div className="space-y-5">
      {challenges.length > 0 && (
        <Section icon={Trophy} title="Challenges for you">
          {challenges.map(challenge => {
            const meta = TYPE_META[challenge.challengeType] || TYPE_META.opinion;
            const endLabel = endsLabel(challenge.endsAt);
            return (
              <Card key={challenge.id} href={`/challenges/${challenge.slug}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-black text-white bg-[#0a0a0a] border border-[#2a2a2a] px-2 py-0.5 rounded-full">
                    {meta.icon} {meta.label}
                  </span>
                  {challenge.participantCount > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 shrink-0">
                      <Users className="w-3 h-3" />
                      {formatCount(challenge.participantCount)}
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-white leading-snug mt-2 line-clamp-2">
                  {challenge.title}
                </p>
                <p className="text-[11px] font-mono text-zinc-500 mt-1 truncate">
                  {challenge.community ? `in ${challenge.community.name}` : 'Open to everyone'}
                  {endLabel && (
                    <>
                      <span className="mx-1 text-zinc-700">·</span>
                      <span className="text-zinc-400 inline-flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> {endLabel}
                      </span>
                    </>
                  )}
                </p>
                <Reason reason={challenge.reason} />
              </Card>
            );
          })}
        </Section>
      )}

      {communities.length > 0 && (
        <Section icon={Compass} title="Communities for you">
          {communities.map(community => (
            <Card key={community.id} href={`/c/${community.slug}`}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] border border-[#333] flex items-center justify-center text-base font-black shrink-0">
                  {community.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{community.name}</p>
                  <p className="text-[11px] font-mono text-zinc-500 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3 h-3" /> {formatCount(community.memberCount)}
                    </span>
                    {community.activity7d > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Flame className="w-3 h-3 text-[#ff4d00]" /> {community.activity7d}/7d
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {community.description && (
                <p className="text-[11px] text-zinc-400 leading-relaxed mt-2 line-clamp-2">
                  {community.description}
                </p>
              )}
              {(community.topics || []).length > 0 && (
                <div className="flex gap-1.5 mt-2">
                  {community.topics.slice(0, 2).map(topic => (
                    <span
                      key={topic}
                      className="text-[9px] font-mono font-bold text-[#ff4d00] bg-[#ff4d00]/10 border border-[#ff4d00]/20 px-1.5 py-0.5 rounded-full"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}
              <Reason reason={community.reason} />
            </Card>
          ))}
        </Section>
      )}

    </div>
  );
}
