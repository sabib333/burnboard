'use client';

import React, { useState, useCallback } from 'react';
import { Flame, Share2, Link2, Check, Loader2, Copy } from 'lucide-react';
import { getOrCreateAnonId } from '@/src/lib/presence';

export default function FriendChallenge({ 
  sourceHotSeatId, 
  sourceBurnScore, 
  displayName = 'Someone',
  variant = 'button' // 'button' | 'card'
}) {
  const [creating, setCreating] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://burnboard.app';
  const challengePath = '/friend-challenge';

  const showToast = useCallback((text) => {
    setToast(text);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleCreateChallenge = async () => {
    setCreating(true);
    try {
      const anonId = getOrCreateAnonId();
      const res = await fetch('/api/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_hot_seat_id: sourceHotSeatId,
          source_burn_score: sourceBurnScore,
          display_name: displayName,
          challenger_anon_id: anonId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Failed to create challenge');
        return;
      }

      setChallenge(data.challenge);
      setShowModal(true);
    } catch (err) {
      showToast('Failed to create challenge');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!challenge) return;      const challengeUrl = `${baseUrl}${challengePath}/${challenge.public_token}`;
      const shareText = `🔥 I challenge you to survive the internet! Can you handle the heat? Prove you can take a roast: ${challengeUrl}`;
    
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
      }
      setCopied(true);
      showToast('Challenge link copied! Share it with your friend 🔥');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showToast('Copy failed — try again');
    }
  };

  const handleNativeShare = async () => {
    if (!challenge) return;      const challengeUrl = `${baseUrl}${challengePath}/${challenge.public_token}`;
    
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: '🔥 You\'ve Been Challenged on BURN BOARD!',
          text: `I challenge you to survive the internet! Can you handle the heat?`,
          url: challengeUrl,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  // ── Button Variant ──
  if (variant === 'button') {
    return (
      <>
        {toast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#ff4d00] text-black px-4 py-2 rounded-xl text-xs font-mono font-bold shadow-lg animate-bounce">
            {toast}
          </div>
        )}
        
        <button
          onClick={handleCreateChallenge}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#333] hover:border-[#ff4d00]/50 rounded-xl text-xs font-mono font-bold text-[#ff4d00] hover:text-white transition-all disabled:opacity-50"
          aria-label="Challenge a friend"
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Flame className="w-4 h-4" />
          )}
          Challenge a Friend
        </button>

        {/* Challenge Modal */}
        {showModal && challenge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <div className="bg-[#111] border border-[#333] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="text-center space-y-2">
                <div className="text-3xl">🔥</div>
                <h3 className="text-lg font-bold text-white">Challenge Created!</h3>
                <p className="text-xs text-zinc-400">
                  Share this link with your friend to challenge them.
                </p>
              </div>

              <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-3">
                <p className="text-xs text-zinc-300 font-mono truncate">
                  {baseUrl}{challengePath}/{challenge.public_token}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCopyLink}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-[#1a1a1a] hover:bg-[#222] text-white border border-[#333]'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>

                <button
                  onClick={handleNativeShare}
                  className="flex-1 py-3 rounded-xl bg-[#ff4d00] hover:bg-[#ff6622] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,77,0,0.4)]"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 font-mono transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Card Variant ──
  if (variant === 'card') {
    return (
      <>
        {toast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#ff4d00] text-black px-4 py-2 rounded-xl text-xs font-mono font-bold shadow-lg animate-bounce">
            {toast}
          </div>
        )}
        
        <div className="bg-[#111] border border-[#222] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#ff4d00]/10 flex items-center justify-center">
              <Flame className="w-5 h-5 text-[#ff4d00]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Challenge a Friend</h3>
              <p className="text-[11px] text-zinc-400">
                Think you can do better? Challenge someone to beat your score.
              </p>
            </div>
          </div>

          <button
            onClick={handleCreateChallenge}
            disabled={creating}
            className="w-full py-3 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,77,0,0.4)] disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Flame className="w-4 h-4 fill-black" />
                Create Challenge Link
              </>
            )}
          </button>
        </div>

        {/* Challenge Modal */}
        {showModal && challenge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <div className="bg-[#111] border border-[#333] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="text-center space-y-2">
                <div className="text-3xl">🔥</div>
                <h3 className="text-lg font-bold text-white">Challenge Created!</h3>
                <p className="text-xs text-zinc-400">
                  Share this link with your friend to challenge them.
                </p>
              </div>

              <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-3">
                <p className="text-xs text-zinc-300 font-mono truncate">
                  {baseUrl}{challengePath}/{challenge.public_token}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCopyLink}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-[#1a1a1a] hover:bg-[#222] text-white border border-[#333]'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>

                <button
                  onClick={handleNativeShare}
                  className="flex-1 py-3 rounded-xl bg-[#ff4d00] hover:bg-[#ff6622] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,77,0,0.4)]"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 font-mono transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
