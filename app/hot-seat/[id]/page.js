'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Flame, ArrowLeft, Send, Loader2, Shield, MessageSquare, TrendingUp, Clock, Skull, Sparkles, Download } from 'lucide-react';
import { getOrCreateAnonId } from '@/src/lib/presence';
import FriendChallenge from '@/components/FriendChallenge';
import ErrorBoundary from '@/components/ErrorBoundary';
import { hasSubmittedFirstRoast, markFirstRoastSubmitted, trackActivationEvent } from '@/lib/onboarding';
import { trackGrowthEvent } from '@/lib/experiments';

const CATEGORIES = {
  photo: { label: 'My Photo', emoji: '📸' },
  vibe: { label: 'My Vibe', emoji: '✨' },
  bio: { label: 'My Bio', emoji: '📝' },
  outfit: { label: 'My Outfit', emoji: '👕' },
  idea: { label: 'My Idea', emoji: '💡' },
  dating_profile: { label: 'My Dating Profile', emoji: '💘' },
  music_taste: { label: 'My Music Taste', emoji: '🎵' },
  hot_take: { label: 'My Hot Take', emoji: '🔥' },
};

const HEAT_LEVELS = {
  light: { label: 'Light', emoji: '🙂', color: 'text-green-400' },
  savage: { label: 'Savage', emoji: '🔥', color: 'text-[#ff4d00]' },
  brutal: { label: 'Brutal', emoji: '💀', color: 'text-red-400' },
};

const REACTION_CONFIG = {
  funny: { emoji: '😂', label: 'Funny', activeClass: 'border-yellow-500/60 bg-yellow-500/15 text-yellow-400' },
  savage: { emoji: '🔥', label: 'Savage', activeClass: 'border-[#ff4d00]/60 bg-[#ff4d00]/15 text-[#ff4d00]' },
  fatal: { emoji: '💀', label: 'Fatal', activeClass: 'border-red-500/60 bg-red-500/15 text-red-400' },
};

// ── Engagement score weights (configurable, isolated) ──────
const SCORE_WEIGHTS = { funny: 3, savage: 2, fatal: 4 };

function getEngagementScore(counts) {
  if (!counts) return 0;
  return (
    (counts.funny || 0) * SCORE_WEIGHTS.funny +
    (counts.savage || 0) * SCORE_WEIGHTS.savage +
    (counts.fatal || 0) * SCORE_WEIGHTS.fatal
  );
}

function getTopBadge(counts) {
  if (!counts || counts.total === 0) return null;
  const score = getEngagementScore(counts);
  if (score >= 20) return { emoji: '💀', label: 'Maximum Damage', class: 'text-red-400 bg-red-500/10 border-red-500/30' };
  if (counts.funny >= 10) return { emoji: '😂', label: 'Crowd Favorite', class: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' };
  if (counts.savage >= 8) return { emoji: '🔥', label: 'Trending Roast', class: 'text-[#ff4d00] bg-[#ff4d00]/10 border-[#ff4d00]/30' };
  if (score >= 10) return { emoji: '⚡', label: 'Rising', class: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
  return null;
}

function timeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diff = Math.max(0, Math.floor((now - past) / 1000));
  if (diff < 60) return 'now';
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── RoastCard Component ────────────────────────────────────
// ── Canvas Roast Card Generator (1080×1080) ───────────────
async function generateRoastCardImage({ roastText, anonId, hotSeatTitle, hotSeatDisplayName }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = '#181818';
  for (let x = 40; x < 1080; x += 60) {
    for (let y = 40; y < 1080; y += 60) {
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Border
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, 1064, 1064);

  // Top brand
  ctx.font = 'italic 900 42px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('🔥 BURN BOARD', 70, 120);

  // Category pill
  ctx.fillStyle = '#ff4d00';
  ctx.beginPath();
  ctx.roundRect(780, 75, 180, 56, 28);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 20px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🔥 ROAST', 870, 110);
  ctx.textAlign = 'start';

  // Author line
  ctx.font = '600 26px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#ff4d00';
  ctx.fillText(anonId || 'Anonymous', 70, 290);
  const authorWidth = ctx.measureText(anonId || 'Anonymous').width;
  ctx.fillStyle = '#71717a';
  ctx.fillText(' • on Hot Seat', 70 + authorWidth, 290);

  // Roast text (word-wrap)
  ctx.font = '800 48px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  const words = `"${roastText}"`.split(' ');
  let line = '';
  let y = 400;
  const maxWidth = 940;
  const lineHeight = 66;
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && i > 0) {
      ctx.fillText(line, 70, y);
      line = words[i] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 70, y);

  // Footer divider
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(70, 920);
  ctx.lineTo(1010, 920);
  ctx.stroke();

  // Footer text
  ctx.font = '700 24px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#a1a1aa';
  ctx.fillText(hotSeatTitle || 'Hot Seat', 70, 975);
  ctx.textAlign = 'right';
  ctx.font = '900 24px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('🔥 BURN BOARD  |  ', 980, 975);
  ctx.fillStyle = '#ff4d00';
  ctx.fillText('burnboard.app', 1010, 975);
  ctx.textAlign = 'start';

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to convert canvas to blob'));
    }, 'image/png');
  });
}

function RoastCard({ roast, reactionCounts, myReaction, onReact, showBadge, hotSeatTitle, hotSeatDisplayName }) {
  const [animating, setAnimating] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const badge = showBadge ? getTopBadge(reactionCounts) : null;

  const handleReact = (type) => {
    setAnimating(type);
    setTimeout(() => setAnimating(null), 400);
    onReact(roast.id, type);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await generateRoastCardImage({
        roastText: roast.roast_text,
        anonId: roast.anon_id,
        hotSeatTitle,
        hotSeatDisplayName,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `burnboard-roast-${roast.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error('[RoastCard] Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`bg-[#111] border hover:border-[#333] p-4 rounded-2xl transition-all ${
      badge ? 'border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'border-[#222]'
    }`}>
      {/* Badge */}
      {badge && (
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border mb-3 ${badge.class}`}>
          <Sparkles className="w-2.5 h-2.5" />
          <span>{badge.emoji} {badge.label}</span>
        </div>
      )}

      {/* Author & Time */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#ff4d00] font-black font-mono flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff4d00]" />
          {roast.anon_id}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            title="Download 1080×1080 Roast Card"
            className="p-1.5 text-zinc-500 hover:text-[#ff4d00] rounded-lg hover:bg-[#1a1a1a] transition-colors disabled:opacity-50"
            aria-label="Download roast card"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-zinc-600 font-mono">{timeAgo(roast.created_at)}</span>
        </div>
      </div>

      {/* Roast Text */}
      <p className="text-sm text-zinc-100 leading-relaxed select-text mb-3">
        &ldquo;{roast.roast_text}&rdquo;
      </p>

      {/* Reactions Bar */}
      <div className="flex items-center gap-2 pt-3 border-t border-[#1a1a1a]">
        {Object.entries(REACTION_CONFIG).map(([type, config]) => {
          const count = reactionCounts?.[type] || 0;
          const isActive = myReaction === type;
          const isAnimating = animating === type;

          return (
            <button
              key={type}
              onClick={() => handleReact(type)}
              aria-label={`${config.label} (${count})`}
              aria-pressed={isActive}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono font-bold transition-all duration-150 active:scale-90 ${
                isActive
                  ? config.activeClass
                  : 'bg-[#0a0a0a] text-zinc-400 border-[#262626] hover:border-[#3a3a3a] hover:text-white'
              } ${isAnimating ? 'scale-125' : ''}`}
            >
              <span className="text-sm leading-none">{config.emoji}</span>
              {count > 0 && (
                <span className={`text-[11px] ${isActive ? 'font-black' : 'text-zinc-300'}`}>
                  {formatCount(count)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function HotSeatPublicPage() {
  const params = useParams();
  const { id } = params;

  const [hotSeat, setHotSeat] = useState(null);
  const [roasts, setRoasts] = useState([]);
  const [reactionCounts, setReactionCounts] = useState({});
  const [myReactions, setMyReactions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roastText, setRoastText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [toast, setToast] = useState(null);
  const [sortBy, setSortBy] = useState('top');
  const textareaRef = useRef(null);

  // Get participant identity
  const getParticipantId = useCallback(() => {
    return getOrCreateAnonId();
  }, []);

  // ── Fetch hot seat data ─────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const fetchHotSeat = async () => {
      try {
        const res = await fetch(`/api/hot-seat/${id}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Hot seat not found');
          return;
        }

        setHotSeat(data.hot_seat);
        setRoasts(data.roasts || []);
        if (data.reactionCounts) {
          setReactionCounts(data.reactionCounts);
        }
      } catch (err) {
        setError('Failed to load hot seat');
      } finally {
        setLoading(false);
      }
    };

    fetchHotSeat();
  }, [id]);

  // ── Fetch reactions ─────────────────────────────────────
  const fetchReactions = useCallback(async () => {
    if (!id || !roasts.length) return;

    try {
      const participantId = getParticipantId();
      const res = await fetch(`/api/hot-seat/${id}/reactions?participant_id=${encodeURIComponent(participantId)}`);
      const data = await res.json();

      if (res.ok) {
        setReactionCounts(data.reactions || {});
        setMyReactions(data.participantReactions || {});
      }
    } catch {}
  }, [id, roasts.length, getParticipantId]);

  useEffect(() => {
    fetchReactions();
  }, [fetchReactions]);

  // ── Poll for new roasts + reactions every 15 seconds ────
  useEffect(() => {
    if (!id || !hotSeat) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/hot-seat/${id}`);
        const data = await res.json();
        if (res.ok && data.roasts) {
          setRoasts(data.roasts);
        }
        // Re-fetch reactions
        const participantId = getParticipantId();
        const rRes = await fetch(`/api/hot-seat/${id}/reactions?participant_id=${encodeURIComponent(participantId)}`);
        const rData = await rRes.json();
        if (rRes.ok) {
          setReactionCounts(rData.reactions || {});
          setMyReactions(rData.participantReactions || {});
        }
      } catch {}
    }, 15000);

    return () => clearInterval(interval);
  }, [id, hotSeat, getParticipantId]);

  // ── Submit roast ────────────────────────────────────────
  const handleSubmitRoast = async () => {
    if (!roastText.trim() || isSubmitting) return;

    setSubmitError('');
    setIsSubmitting(true);

    try {
      const anonId = getParticipantId();
      const res = await fetch(`/api/hot-seat/${id}/roast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roast_text: roastText.trim(),
          anon_id: anonId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || 'Failed to submit roast');
        return;
      }

      setRoasts(prev => [data.roast, ...prev]);
      setRoastText('');
      setSubmitted(true);
      
      // Track first roast submission for activation
      const isFirstRoast = !hasSubmittedFirstRoast();
      if (isFirstRoast) {
        markFirstRoastSubmitted();
        trackActivationEvent('first_roast_submitted', { hot_seat_id: id });
        trackGrowthEvent('first_roast_submitted', { hot_seat_id: id });
        showToast('🎉 First roast dropped! Welcome to the heat.');
      } else {
        showToast('🔥 Roast submitted!');
        trackGrowthEvent('roast_submitted', { hot_seat_id: id });
      }
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) {
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Handle reaction ─────────────────────────────────────
  const handleReact = useCallback(async (roastId, reactionType) => {
    const participantId = getParticipantId();
    const previousMyReactions = { ...myReactions };
    const previousCounts = { ...reactionCounts };

    // Optimistic update
    setMyReactions(prev => {
      const current = prev[roastId];
      if (current === reactionType) {
        // Toggle off
        const next = { ...prev };
        delete next[roastId];
        return next;
      }
      return { ...prev, [roastId]: reactionType };
    });

    setReactionCounts(prev => {
      const counts = { ...(prev[roastId] || { funny: 0, savage: 0, fatal: 0, total: 0 }) };
      const current = previousMyReactions[roastId];

      // Remove old reaction count
      if (current) {
        counts[current] = Math.max(0, (counts[current] || 0) - 1);
        counts.total = Math.max(0, (counts.total || 0) - 1);
      }

      // Add new reaction count (unless toggling off)
      if (current !== reactionType) {
        counts[reactionType] = (counts[reactionType] || 0) + 1;
        counts.total = (counts.total || 0) + 1;
      }

      return { ...prev, [roastId]: counts };
    });

    try {
      const res = await fetch(`/api/hot-seat/${id}/roast/${roastId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reaction_type: reactionType,
          participant_id: participantId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Rollback on error
        setMyReactions(previousMyReactions);
        setReactionCounts(previousCounts);
        return;
      }

      // Use server counts for accuracy
      if (data.counts) {
        setReactionCounts(prev => ({ ...prev, [roastId]: data.counts }));
      }

      if (data.action === 'removed') {
        setMyReactions(prev => {
          const next = { ...prev };
          delete next[roastId];
          return next;
        });
      } else {
        setMyReactions(prev => ({ ...prev, [roastId]: data.reaction_type }));
      }
    } catch {
      // Rollback on error
      setMyReactions(previousMyReactions);
      setReactionCounts(previousCounts);
    }
  }, [id, myReactions, reactionCounts, getParticipantId]);

  // ── Sort roasts ─────────────────────────────────────────
  const sortedRoasts = useMemo(() => {
    const sorted = [...roasts];

    switch (sortBy) {
      case 'top':
        return sorted.sort((a, b) => {
          const scoreA = getEngagementScore(reactionCounts[a.id]);
          const scoreB = getEngagementScore(reactionCounts[b.id]);
          if (scoreB !== scoreA) return scoreB - scoreA;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      case 'newest':
        return sorted.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      case 'funniest':
        return sorted.sort((a, b) => {
          const aCount = reactionCounts[a.id]?.funny || 0;
          const bCount = reactionCounts[b.id]?.funny || 0;
          if (bCount !== aCount) return bCount - aCount;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      case 'fatal':
        return sorted.sort((a, b) => {
          const aCount = reactionCounts[a.id]?.fatal || 0;
          const bCount = reactionCounts[b.id]?.fatal || 0;
          if (bCount !== aCount) return bCount - aCount;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      default:
        return sorted;
    }
  }, [roasts, sortBy, reactionCounts]);

  // ── Toast ───────────────────────────────────────────────
  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 3000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmitRoast();
    }
  };

  const cat = hotSeat ? CATEGORIES[hotSeat.category] : null;
  const heat = hotSeat ? HEAT_LEVELS[hotSeat.heat_level] : null;

  // ── Loading State ────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Flame className="w-8 h-8 text-[#ff4d00] animate-pulse mx-auto" />
          <p className="text-xs font-mono text-zinc-400">Loading Hot Seat...</p>
        </div>
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-4xl">🏃‍♂️💨</div>
          <h1 className="text-xl font-bold text-white">Hot Seat Not Found</h1>
          <p className="text-xs text-zinc-400 max-w-sm">{error}</p>
          <Link
            href="/hot-seat"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ff4d00] text-black font-bold text-xs rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" />
            Create Your Own
          </Link>
        </div>
      </div>
    );
  }

  // ── Closed State ─────────────────────────────────────────
  if (hotSeat?.status === 'closed') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
        <div className="max-w-lg mx-auto space-y-6 pt-8">
          <div className="text-center space-y-4">
            <div className="text-4xl">❄️</div>
            <h1 className="text-xl font-bold text-white">Hot Seat Closed</h1>
            <p className="text-xs text-zinc-400">This Hot Seat is no longer accepting roasts.</p>
          </div>

          {roasts.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-mono text-zinc-500 text-center">{roasts.length} roasts received</p>
              {roasts.map(r => (
                <RoastCard
                  key={r.id}
                  roast={r}
                  reactionCounts={reactionCounts[r.id]}
                  myReaction={myReactions[r.id]}
                  onReact={handleReact}
                  showBadge={true}
                  hotSeatTitle={hotSeat.title}
                  hotSeatDisplayName={hotSeat.display_name}
                />
              ))}
            </div>
          )}

          <div className="text-center space-y-3">
            {roasts.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={`/hot-seat/${id}/share`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-bold text-xs rounded-xl transition-all shadow-[0_0_20px_rgba(255,77,0,0.4)]"
                >
                  🔥 View Burn Report & Share
                </Link>
                <FriendChallenge
                  sourceHotSeatId={id}
                  displayName={hotSeat?.display_name || 'Someone'}
                  variant="button"
                />
              </div>
            )}
            <div>
              <Link
                href="/hot-seat"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#111] hover:bg-[#1a1a1a] border border-[#333] rounded-xl text-xs font-mono font-bold text-zinc-300 hover:text-white transition-all"
              >
                Create Your Own Hot Seat 🔥
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Public View ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#ff4d00] text-black px-4 py-2 rounded-xl text-xs font-mono font-bold shadow-lg animate-bounce">
          {toast}
        </div>
      )}

      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222] pb-4">
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>BURNBOARD</span>
          </Link>
          <div className="flex items-center gap-2 text-[#ff4d00] font-mono font-black text-sm">
            <Flame className="w-4 h-4 fill-[#ff4d00]" />
            <span>HOT SEAT</span>
          </div>
        </div>

        {/* Hot Seat Card */}
        <div className="bg-gradient-to-br from-[#1a0a00] via-[#111] to-[#0a0a0a] border-2 border-[#ff4d00]/40 rounded-3xl p-5 sm:p-6 space-y-4 shadow-[0_0_40px_rgba(255,77,0,0.15)]">
          <div className="text-center space-y-2">
            <p className="text-xs font-mono text-[#ff4d00] font-bold uppercase tracking-wider">
              {hotSeat.display_name} is on the Hot Seat
            </p>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {hotSeat.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 bg-[#1a1a1a] rounded-lg border border-[#333] text-zinc-300">
              {cat?.emoji} {cat?.label || hotSeat.category}
            </span>
            <span className={`px-2.5 py-1 bg-[#1a1a1a] rounded-lg border border-[#333] ${heat?.color || 'text-zinc-300'}`}>
              {heat?.emoji} {heat?.label || hotSeat.heat_level}
            </span>
            <span className="px-2.5 py-1 bg-[#1a1a1a] rounded-lg border border-[#333] text-zinc-300">
              🔥 {hotSeat.roast_count || 0} roasts
            </span>
          </div>

          {hotSeat.context && (
            <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-3">
              <p className="text-xs text-zinc-300 leading-relaxed">{hotSeat.context}</p>
            </div>
          )}
        </div>

        {/* Roast Submission */}
        <div className="bg-[#111] border border-[#222] rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#ff4d00]" />
            <h2 className="text-sm font-bold text-white">Fire Your Shot</h2>
          </div>

          <p className="text-[11px] text-zinc-400">
            Keep it funny. Keep it creative. Don&apos;t make it personal.
          </p>

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={roastText}
              onChange={(e) => setRoastText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write your roast here..."
              rows={3}
              maxLength={280}
              className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#ff4d00] focus:ring-1 focus:ring-[#ff4d00]/30 resize-none"
            />
            <div className="flex justify-between items-center mt-1.5">
              <span className="text-[10px] font-mono text-zinc-500">
                {280 - roastText.length} chars left
              </span>
              <span className="text-[10px] font-mono text-zinc-600">
                Ctrl+Enter to submit
              </span>
            </div>
          </div>

          {submitError && (
            <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-2.5 text-xs text-red-400 font-mono">
              {submitError}
            </div>
          )}

          <button
            onClick={handleSubmitRoast}
            disabled={!roastText.trim() || isSubmitting}
            className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              submitted
                ? 'bg-green-600 text-white'
                : 'bg-[#ff4d00] hover:bg-[#ff6622] text-black shadow-[0_0_20px_rgba(255,77,0,0.4)]'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : submitted ? (
              <>✓ Roast Submitted!</>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Fire Your Roast
              </>
            )}
          </button>
        </div>

        {/* Sort Tabs + Roast Count */}
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
            Roasts ({roasts.length})
          </h3>

          {roasts.length > 0 && (
            <div className="flex items-center gap-1 bg-[#111] p-0.5 rounded-lg border border-[#262626]">
              {[
                { key: 'top', label: 'Top', icon: TrendingUp },
                { key: 'newest', label: 'New', icon: Clock },
                { key: 'funniest', label: '😂', icon: null },
                { key: 'fatal', label: '💀', icon: null },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold transition-all ${
                    sortBy === opt.key
                      ? 'bg-[#ff4d00] text-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {opt.icon ? (
                    <span className="flex items-center gap-1">
                      <opt.icon className="w-3 h-3" />
                      <span className="hidden sm:inline">{opt.label}</span>
                    </span>
                  ) : (
                    <span>{opt.label}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Roasts List */}
        <div className="space-y-3">
          {roasts.length === 0 && (
            <div className="bg-[#111] border border-dashed border-[#333] rounded-2xl p-8 text-center space-y-2">
              <div className="text-3xl">🦗</div>
              <p className="text-sm font-bold text-zinc-400">No roasts yet</p>
              <p className="text-xs text-zinc-500">Be the first to fire a shot!</p>
            </div>
          )}

          {sortedRoasts.map((roast) => (
            <RoastCard
              key={roast.id}
              roast={roast}
              reactionCounts={reactionCounts[roast.id]}
              myReaction={myReactions[roast.id]}
              onReact={handleReact}
              showBadge={sortBy === 'top'}
              hotSeatTitle={hotSeat.title}
              hotSeatDisplayName={hotSeat.display_name}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="text-center pt-4 border-t border-[#222] space-y-4">
          {roasts.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href={`/hot-seat/${id}/share`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#333] hover:border-[#ff4d00]/50 rounded-xl text-xs font-mono font-bold text-[#ff4d00] hover:text-white transition-all"
              >
                🔥 View Burn Report & Share
              </Link>
              <FriendChallenge
                sourceHotSeatId={id}
              displayName={hotSeat?.display_name || 'Someone'}
              variant="button"
            />
          </div>
          )}
          <div>
            <Link
              href="/hot-seat"
              className="text-xs text-zinc-500 hover:text-[#ff4d00] font-mono transition-colors"
            >
              Put yourself on the Hot Seat →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
