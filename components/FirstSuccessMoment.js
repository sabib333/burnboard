'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Flame, Share2, Swords, Trophy, ArrowRight, X } from 'lucide-react';
import { trackActivationEvent, markFirstShareOpened, markFirstChallengeCreated } from '@/lib/onboarding';
import { trackGrowthEvent } from '@/lib/experiments';

/**
 * FirstSuccessMoment — Celebration overlay for meaningful first-time events.
 * Shows briefly, then auto-dismisses. User can also dismiss manually.
 * 
 * Props:
 *   - type: 'hot_seat_created' | 'first_roast' | 'first_share' | 'burn_report'
 *   - data: Object with context-specific data (hotSeatId, roastText, etc.)
 *   - onDismiss: Callback when dismissed
 */
export default function FirstSuccessMoment({ type, data = {}, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (type) {
      setVisible(true);
      trackActivationEvent(`success_moment_${type}`, data);
      
      // Auto-dismiss after 8 seconds
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [type]);

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  const handleShareClick = () => {
    markFirstShareOpened();
    trackActivationEvent('first_share_cta_clicked', { type, ...data });
    trackGrowthEvent('share_initiated', { type, ...data });
  };

  const handleChallengeClick = () => {
    markFirstChallengeCreated();
    trackActivationEvent('first_challenge_cta_clicked', { type, ...data });
    trackGrowthEvent('challenge_created', { type, ...data });
  };

  if (!visible || !type) return null;

  const config = {
    hot_seat_created: {
      emoji: '🔥',
      title: "YOU'RE ON THE HOT SEAT",
      subtitle: 'Share it. Let the internet do the rest.',
      bgClass: 'from-[#1a0a00] via-[#111] to-[#0a0a0a]',
      borderClass: 'border-[#ff4d00]/40',
    },
    first_roast: {
      emoji: '🎉',
      title: 'FIRST ROAST DROPPED',
      subtitle: 'You just fired your first shot. Welcome to the heat.',
      bgClass: 'from-[#0a1a00] via-[#111] to-[#0a0a0a]',
      borderClass: 'border-green-500/40',
    },
    burn_report: {
      emoji: '📊',
      title: 'YOUR BURN REPORT IS READY',
      subtitle: "Based on how the community engaged with your Hot Seat.",
      bgClass: 'from-[#1a1400] via-[#111] to-[#0a0a0a]',
      borderClass: 'border-amber-500/40',
    },
  }[type] || {
    emoji: '🔥',
    title: 'SOMETHING AWESOME HAPPENED',
    subtitle: 'Check it out.',
    bgClass: 'from-[#1a0a00] via-[#111] to-[#0a0a0a]',
    borderClass: 'border-[#ff4d00]/40',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`relative bg-gradient-to-br ${config.bgClass} border-2 ${config.borderClass} rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-4 shadow-[0_0_60px_rgba(255,77,0,0.2)] animate-in`}>
        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-[#1a1a1a] transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Emoji */}
        <div className="text-center">
          <span className="text-5xl">{config.emoji}</span>
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <h3 className="text-lg font-black text-white uppercase tracking-wider">
            {config.title}
          </h3>
          <p className="text-xs text-zinc-400">{config.subtitle}</p>
        </div>

        {/* Context-specific content */}
        {type === 'hot_seat_created' && data.hotSeatId && (
          <div className="space-y-2">
            <Link
              href={`/hot-seat/${data.hotSeatId}`}
              onClick={handleDismiss}
              className="block w-full py-3 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-bold text-xs uppercase tracking-wider rounded-xl text-center transition-all shadow-[0_0_20px_rgba(255,77,0,0.4)]"
            >
              VIEW MY HOT SEAT
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/hot-seat/${data.hotSeatId}/share`}
                onClick={handleShareClick}
                className="py-2.5 bg-[#111] hover:bg-[#1a1a1a] border border-[#333] hover:border-[#ff4d00]/50 rounded-xl text-[11px] font-mono font-bold text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3 h-3 text-[#ff4d00]" />
                SHARE
              </Link>
              <button
                onClick={handleChallengeClick}
                className="py-2.5 bg-[#111] hover:bg-[#1a1a1a] border border-[#333] hover:border-blue-500/50 rounded-xl text-[11px] font-mono font-bold text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
              >
                <Swords className="w-3 h-3 text-blue-400" />
                CHALLENGE
              </button>
            </div>
          </div>
        )}

        {type === 'first_roast' && (
          <div className="space-y-2">
            <p className="text-center text-[11px] text-zinc-500 font-mono">
              Keep roasting to climb the leaderboard!
            </p>
            <Link
              href="/discover"
              onClick={handleDismiss}
              className="block w-full py-3 bg-[#111] hover:bg-[#1a1a1a] border border-[#333] hover:border-[#ff4d00]/50 rounded-xl text-xs font-mono font-bold text-zinc-300 hover:text-white transition-all text-center"
            >
              DISCOVER MORE HOT SEATS →
            </Link>
          </div>
        )}

        {type === 'burn_report' && data.hotSeatId && (
          <div className="space-y-2">
            <Link
              href={`/hot-seat/${data.hotSeatId}/share`}
              onClick={handleShareClick}
              className="block w-full py-3 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-bold text-xs uppercase tracking-wider rounded-xl text-center transition-all shadow-[0_0_20px_rgba(255,77,0,0.4)]"
            >
              <Share2 className="w-4 h-4 inline mr-1.5" />
              SHARE YOUR RESULT
            </Link>
            <button
              onClick={handleChallengeClick}
              className="block w-full py-2.5 bg-[#111] hover:bg-[#1a1a1a] border border-[#333] hover:border-blue-500/50 rounded-xl text-[11px] font-mono font-bold text-zinc-300 hover:text-white transition-all text-center"
            >
              <Swords className="w-3 h-3 inline mr-1.5 text-blue-400" />
              CHALLENGE A FRIEND
            </button>
          </div>
        )}

        {/* Auto-dismiss timer */}
        <div className="text-center">
          <span className="text-[10px] text-zinc-600 font-mono">Auto-closes in a few seconds</span>
        </div>
      </div>
    </div>
  );
}
