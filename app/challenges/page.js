'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Flame, Plus, ArrowUpRight, Swords, Users, BellRing, X } from 'lucide-react';
import { ChallengeCard } from '@/components/challenges';
import { track } from '@/lib/analytics';

/**
 * /challenges — Challenge discovery hub.
 * Only real challenges are shown; empty sections are never fabricated.
 */

function SectionHeader({ icon, title, href, actionLabel }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden="true">{icon}</span>
        <h2 className="text-sm font-black text-white uppercase tracking-wider font-mono">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="text-[11px] font-mono text-[#ff4d00] hover:text-white transition-colors flex items-center gap-1">
          {actionLabel || 'View all'} <ArrowUpRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

function SectionEmpty({ text, sub }) {
  return (
    <div className="bg-[#111] border border-dashed border-[#333] rounded-2xl p-6 text-center">
      <p className="text-xs text-zinc-500">{text}</p>
      {sub && <p className="text-[11px] text-zinc-600 font-mono mt-1">{sub}</p>}
    </div>
  );
}

async function fetchChallenges(scope) {
  const res = await fetch(`/api/challenges?scope=${scope}&limit=12`);
  if (!res.ok) throw new Error(`Failed to load ${scope}`);
  return res.json();
}

export default function ChallengesHubPage() {
  const [sections, setSections] = useState({
    active: null,
    newest: null,
    trending: null,
    mine: null,
    invites: null,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [active, newest, trending, mine, invites] = await Promise.all([
        fetchChallenges('active').catch(() => ({ challenges: [] })),
        fetchChallenges('newest').catch(() => ({ challenges: [] })),
        fetchChallenges('trending').catch(() => ({ challenges: [] })),
        fetchChallenges('mine').catch(() => ({ challenges: [] })),
        fetchChallenges('invites').catch(() => ({ challenges: [] })),
      ]);
      setSections({ active, newest, trending, mine, invites });
    } catch (err) {
      setError('Failed to load challenges');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Fire-and-forget discovery analytics
  useEffect(() => {
    if (!loading) track('challenges_hub_viewed', {});
  }, [loading]);

  const handleDeclineInvite = async (slug) => {
    try {
      const res = await fetch(`/api/challenges/${slug}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline' }),
      });
      if (res.ok) {
        const invites = await fetchChallenges('invites');
        setSections(prev => ({ ...prev, invites }));
      }
    } catch {}
  };

  const mineList = sections.mine?.challenges || [];
  const inviteList = sections.invites?.challenges || [];
  const showMine = mineList.length > 0 || (sections.mine && sections.mine.total > 0);
  const showInvites = inviteList.length > 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="space-y-4 py-4 border-b border-[#222]">
          <div className="flex items-center justify-between">
            <Link href="/home" className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs transition-colors">
              <Flame className="w-4 h-4 text-[#ff4d00] fill-[#ff4d00]" />
              <span>BURNBOARD</span>
            </Link>
            <Link
              href="/challenges/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-bold text-[11px] rounded-xl transition-all shadow-[0_0_15px_rgba(255,77,0,0.3)]"
              aria-label="Create a new challenge"
            >
              <Plus className="w-3.5 h-3.5" />
              NEW CHALLENGE
            </Link>
          </div>

          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-[#ff4d00]">
              <Swords className="w-6 h-6" aria-hidden="true" />
              <h1 className="text-xl font-black uppercase tracking-wider font-mono">CHALLENGES</h1>
            </div>
            <p className="text-xs text-zinc-400 font-mono max-w-md mx-auto">
              Do something, don&apos;t just scroll. Join a challenge, drop your take, and see who lands the hardest.
            </p>
          </div>
        </header>

        {error && (
          <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-4 text-center text-sm text-red-400 font-mono">
            {error} — <button onClick={loadAll} className="underline hover:text-white">Retry</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-[#111] border border-[#222] rounded-2xl p-5 animate-pulse space-y-3">
                <div className="w-1/3 h-4 bg-[#222] rounded" />
                <div className="w-3/4 h-4 bg-[#1a1a1a] rounded" />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-10">
            {/* Invitations for you */}
            {showInvites && (
              <section className="space-y-4" aria-label="Challenge invitations for you">
                <SectionHeader icon="🔔" title="Invitations for you" />
                <div className="space-y-3">
                  {inviteList.map(challenge => (
                    <div key={challenge.id} className="bg-gradient-to-r from-[#1a1205] to-[#111] border border-[#ff4d00]/30 rounded-2xl p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                          <BellRing className="w-3 h-3 text-[#ff4d00]" />
                          @{challenge.creator?.username || 'Someone'} invited you
                        </p>
                        <Link href={`/challenges/${challenge.slug}`} className="block text-sm font-bold text-white hover:text-[#ff4d00] transition-colors mt-0.5 truncate">
                          {challenge.title}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleDeclineInvite(challenge.slug)}
                          className="px-3 py-2 rounded-xl border border-[#333] text-[11px] font-mono text-zinc-400 hover:text-white hover:border-red-500/50 transition-all flex items-center gap-1.5"
                          aria-label={`Decline invitation to ${challenge.title}`}
                        >
                          <X className="w-3 h-3" /> Decline
                        </button>
                        <Link
                          href={`/challenges/${challenge.slug}`}
                          className="px-3 py-2 rounded-xl bg-[#ff4d00] text-black text-[11px] font-mono font-bold hover:bg-[#ff6622] transition-all"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Your challenges */}
            {showMine && (
              <section className="space-y-4" aria-label="Your challenges">
                <SectionHeader icon="⚡" title="Your challenges" href="/challenges?view=mine" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {mineList.map(challenge => (
                    <ChallengeCard key={challenge.id} challenge={challenge} />
                  ))}
                </div>
              </section>
            )}

            {/* Ending soon (real active challenges, soonest first) */}
            <section className="space-y-4" aria-label="Ending soon challenges">
              <SectionHeader icon="⏳" title="Ending soon" href="/challenges?view=active" />
              {sections.active?.challenges?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sections.active.challenges.map(challenge => (
                    <ChallengeCard key={challenge.id} challenge={challenge} />
                  ))}
                </div>
              ) : (
                <SectionEmpty text="No active challenges right now." sub="Be the first to start one." />
              )}
            </section>

            {/* Trending (real participation velocity + freshness) */}
            <section className="space-y-4" aria-label="Trending challenges">
              <SectionHeader icon="📈" title="Trending now" />
              {sections.trending?.challenges?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sections.trending.challenges.map(challenge => (
                    <ChallengeCard key={challenge.id} challenge={challenge} />
                  ))}
                </div>
              ) : (
                <SectionEmpty text="Nothing trending yet." sub="Real momentum starts with the first entry." />
              )}
            </section>

            {/* Newest */}
            <section className="space-y-4" aria-label="New challenges">
              <SectionHeader icon="🆕" title="New challenges" />
              {sections.newest?.challenges?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sections.newest.challenges.map(challenge => (
                    <ChallengeCard key={challenge.id} challenge={challenge} />
                  ))}
                </div>
              ) : (
                <SectionEmpty text="No challenges yet." sub="Create the first one and invite someone." />
              )}
            </section>

            {/* Create CTA */}
            <div className="text-center pt-4 pb-8 border-t border-[#222] space-y-4">
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider flex items-center justify-center gap-2">
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                Participation creates involvement. Start something.
              </p>
              <Link
                href="/challenges/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-black text-sm rounded-xl transition-all shadow-[0_0_25px_rgba(255,77,0,0.3)] uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" />
                Create a challenge
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
