'use client';

import React, { useState, useEffect } from 'react';
import BurnShareCard from '@/components/BurnShareCard';
import Link from 'next/link';
import { Flame, ArrowLeft, Loader2 } from 'lucide-react';
import FriendChallenge from '@/components/FriendChallenge';

export default function BurnShareCardClient({ hotSeatId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!hotSeatId) return;

    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/burn-report/${hotSeatId}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to load burn report');
          return;
        }

        setReport(data.report);
      } catch (err) {
        setError('Failed to load burn report');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [hotSeatId]);

  // ── Loading State ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Flame className="w-8 h-8 text-[#ff4d00] animate-pulse" />
        <p className="text-xs font-mono text-zinc-400">Loading burn report...</p>
      </div>
    );
  }

  // ── Error State ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="text-4xl">🔥</div>
        <h2 className="text-lg font-bold text-white">Report Not Available</h2>
        <p className="text-xs text-zinc-400 max-w-sm text-center">{error}</p>
        <Link
          href={`/hot-seat/${hotSeatId}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#111] hover:bg-[#1a1a1a] border border-[#333] rounded-xl text-xs font-mono font-bold text-zinc-300 hover:text-white transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          View Hot Seat
        </Link>
      </div>
    );
  }

  // ── Zero Roasts Fallback ──
  if (report && report.roastCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6">
        <div className="text-5xl">🕯️</div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-white">Not enough roasts yet</h2>
          <p className="text-xs text-zinc-400 max-w-sm">
            Share your Hot Seat link and get at least one roast to generate your Burn Report.
          </p>
        </div>
        <Link
          href={`/hot-seat/${hotSeatId}`}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(255,77,0,0.4)]"
        >
          🔥 Share Hot Seat Link
        </Link>
      </div>
    );
  }

  // ── Burn Report Display ──
  if (!report) return null;

  return (
    <div className="space-y-8">
      {/* Report Header */}
      <div className="text-center space-y-3">
        <p className="text-xs font-mono text-[#ff4d00] font-bold uppercase tracking-wider">
          {report.displayName}&apos;s Burn Report
        </p>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          {report.title}
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 bg-[#1a1a1a] rounded-lg border border-[#333] text-zinc-300">
            🔥 {report.roastCount} roasts
          </span>
          <span className="px-2.5 py-1 bg-[#1a1a1a] rounded-lg border border-[#333] text-zinc-300">
            💥 {report.totalReactions} reactions
          </span>
        </div>
      </div>

      {/* Share Card */}
      <BurnShareCard report={report} />

      {/* Challenge a Friend */}
      <FriendChallenge
        sourceHotSeatId={report.hotSeatId}
        sourceBurnScore={report.burnScore}
        displayName={report.displayName}
        variant="card"
      />
    </div>
  );
}
