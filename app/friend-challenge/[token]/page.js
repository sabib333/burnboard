'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Flame, ArrowLeft, Loader2, Trophy, FlameKindling } from 'lucide-react';
import { getOrCreateAnonId } from '@/src/lib/presence';

export default function FriendChallengePage() {
  const params = useParams();
  const router = useRouter();
  const { token } = params;

  const [challenge, setChallenge] = useState(null);
  const [sourceHotSeat, setSourceHotSeat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchChallenge = async () => {
      try {
        const res = await fetch(`/api/challenge/${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Challenge not found');
          return;
        }

        setChallenge(data.challenge);
        setSourceHotSeat(data.sourceHotSeat);

        // If challenge is already completed, show the completed hot seat
        if (data.challenge.status === 'completed' && data.acceptedHotSeat) {
          router.push(`/hot-seat/${data.acceptedHotSeat.id}`);
          return;
        }

        // If challenge is already accepted, show accept confirmation
        if (data.challenge.status === 'accepted') {
          setAccepted(true);
        }
      } catch (err) {
        setError('Failed to load challenge');
      } finally {
        setLoading(false);
      }
    };

    fetchChallenge();
  }, [token, router]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const anonId = getOrCreateAnonId();
      const res = await fetch(`/api/challenge/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted_by_anon_id: anonId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to accept challenge');
        return;
      }

      setAccepted(true);
      // Redirect to hot seat creation with challenge token for viral loop completion
      setTimeout(() => {
        router.push(`/hot-seat?challenge=${encodeURIComponent(token)}`);
      }, 1500);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Flame className="w-8 h-8 text-[#ff4d00] animate-pulse mx-auto" />
          <p className="text-xs font-mono text-zinc-400">Loading challenge...</p>
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-4xl">🏃‍♂️💨</div>
          <h1 className="text-xl font-bold text-white">Challenge Not Found</h1>
          <p className="text-xs text-zinc-400 max-w-sm">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ff4d00] text-black font-bold text-xs rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to BURN BOARD
          </Link>
        </div>
      </div>
    );
  }

  // ── Accepted State ──
  if (accepted) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
        <div className="text-center space-y-6">
          <div className="text-6xl animate-bounce">🔥</div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#ff4d00] uppercase tracking-tight">
            Challenge Accepted!
          </h1>
          <p className="text-sm text-zinc-400 max-w-sm">
            Get ready to prove you can survive the internet.
          </p>
          <p className="text-xs text-zinc-500 font-mono">
            Redirecting to Hot Seat creation...
          </p>
        </div>
      </div>
    );
  }

  if (!challenge) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222] pb-4">
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs transition-colors">
            <Flame className="w-4 h-4" />
            <span>BURN BOARD</span>
          </Link>
          <div className="flex items-center gap-2 text-[#ff4d00] font-mono font-black text-sm">
            <Flame className="w-4 h-4 fill-[#ff4d00]" />
            <span>CHALLENGE</span>
          </div>
        </div>

        {/* Challenge Card */}
        <div className="bg-gradient-to-br from-[#1a0a00] via-[#111] to-[#0a0a0a] border-2 border-[#ff4d00]/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_0_40px_rgba(255,77,0,0.15)]">
          <div className="text-center space-y-4">
            <div className="text-5xl">🔥</div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
              You&apos;ve Been Challenged
            </h1>
          </div>

          <div className="text-center space-y-3">
            <p className="text-sm text-zinc-300">
              <span className="font-bold text-[#ff4d00]">{challenge.challengerDisplayName}</span> thinks you can&apos;t survive the internet.
            </p>
            <p className="text-xs text-zinc-400">
              Prove them wrong. Get on the Hot Seat and let the internet roast you.
            </p>
          </div>

          {/* Source Hot Seat Info (if available) */}
          {sourceHotSeat && (
            <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 space-y-2">
              <p className="text-[10px] text-zinc-500 font-mono uppercase">Their Burn Report</p>
              <p className="text-sm font-bold text-white">{sourceHotSeat.title}</p>
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <span>{sourceHotSeat.roastCount || 0} roasts</span>
                {challenge.sourceBurnScore && (
                  <>
                    <span>•</span>
                    <span className="text-[#ff4d00] font-bold">Score: {challenge.sourceBurnScore}/100</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full py-4 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-bold text-sm uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,77,0,0.4)] disabled:opacity-50"
          >
            {accepting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Flame className="w-4 h-4 fill-black" />
                Accept the Challenge 🔥
              </>
            )}
          </button>

          {/* Secondary CTA */}
          <div className="text-center">
            <Link
              href="/"
              className="text-xs text-zinc-500 hover:text-zinc-300 font-mono transition-colors"
            >
              What is BURN BOARD?
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-4">
          <p className="text-[10px] text-zinc-600 font-mono">
            Challenge created {new Date(challenge.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
