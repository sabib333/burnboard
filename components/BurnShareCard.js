'use client';

import React, { useRef, useCallback, useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, Share2, Link2, Check, Flame } from 'lucide-react';

// ── Burn Status Colors ──
function getScoreColor(score) {
  if (score >= 80) return '#ff4d00';
  if (score >= 60) return '#ef4444';
  if (score >= 35) return '#f97316';
  if (score >= 15) return '#f59e0b';
  return '#71717a';
}

// ── Variant A: Score Card ──
export function ScoreCard({ report, cardRef }) {
  const scoreColor = getScoreColor(report.burnScore);

  return (
    <div
      ref={cardRef}
      className="burn-share-card"
      style={{
        width: '1080px',
        height: '1080px',
        backgroundColor: '#0a0a0a',
        backgroundImage: 'radial-gradient(circle at 25px 25px, #1a1a1a 2%, transparent 0%), radial-gradient(circle at 75px 75px, #141414 2%, transparent 0%)',
        backgroundSize: '80px 80px',
        border: '16px solid #222222',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '75px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        color: '#f0f0f0',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Brand */}
      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '48px' }}>🔥</span>
          <span style={{ fontSize: '38px', fontWeight: 900, letterSpacing: '-1.5px', textTransform: 'uppercase', fontStyle: 'italic', color: '#ffffff' }}>
            BURN BOARD
          </span>
        </div>
        <div style={{
          backgroundColor: '#161616',
          border: '2px solid #333333',
          padding: '10px 24px',
          borderRadius: '999px',
          fontSize: '20px',
          fontWeight: 800,
          color: '#ff4d00',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          BURN REPORT
        </div>
      </div>

      {/* Center: Score */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', margin: 'auto 0' }}>
        <div style={{ fontSize: '32px', color: '#a1a1aa', fontWeight: 600 }}>
          {report.displayName} got roasted by the internet
        </div>
        <div style={{ fontSize: '28px', color: '#71717a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '3px' }}>
          BURN SCORE
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <span style={{ fontSize: '140px', fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
            {report.burnScore}
          </span>
          <span style={{ fontSize: '48px', fontWeight: 700, color: '#555555' }}>/100</span>
        </div>
        <div style={{
          fontSize: '36px',
          fontWeight: 900,
          color: scoreColor,
          textTransform: 'uppercase',
          letterSpacing: '2px',
          marginTop: '8px',
        }}>
          {report.burnStatus.emoji} {report.burnStatus.label}
        </div>
        <div style={{ fontSize: '24px', color: '#71717a', marginTop: '8px' }}>
          {report.roastCount} roasts received
        </div>
      </div>

      {/* Bottom CTA & Footer */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
        <div style={{
          backgroundColor: '#ff4d00',
          color: '#000000',
          padding: '16px 48px',
          borderRadius: '16px',
          fontSize: '24px',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          CAN YOU SURVIVE THE INTERNET?
        </div>
        <div style={{
          display: 'flex',
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '2px solid #222222',
          paddingTop: '28px',
          fontSize: '22px',
        }}>
          <div style={{ color: '#a1a1aa', fontWeight: 600 }}>Put yourself on the <span style={{ color: '#ffffff', fontWeight: 800 }}>Hot Seat</span></div>
          <div style={{ color: '#ff4d00', fontWeight: 900, letterSpacing: '0.5px' }}>burnboard.app</div>
        </div>
      </div>
    </div>
  );
}

// ── Variant B: Top Roast Card ──
export function RoastCard({ report, cardRef }) {
  if (!report.topRoast) return null;

  const fontSize = report.topRoast.text.length > 140 ? '42px' : report.topRoast.text.length > 80 ? '48px' : '54px';

  // Determine roast category
  let categoryLabel = 'Top Roast';
  let categoryEmoji = '🔥';
  const rc = report.topRoast.reactionCounts || {};
  if ((rc.fatal || 0) >= (rc.funny || 0) && (rc.fatal || 0) >= (rc.savage || 0) && rc.fatal > 0) {
    categoryLabel = 'Most Fatal';
    categoryEmoji = '💀';
  } else if ((rc.savage || 0) >= (rc.funny || 0) && rc.savage > 0) {
    categoryLabel = 'Most Savage';
    categoryEmoji = '🔥';
  } else if (rc.funny > 0) {
    categoryLabel = 'Funniest';
    categoryEmoji = '😂';
  }

  return (
    <div
      ref={cardRef}
      className="burn-share-card"
      style={{
        width: '1080px',
        height: '1080px',
        backgroundColor: '#0a0a0a',
        backgroundImage: 'radial-gradient(circle at 25px 25px, #1a1a1a 2%, transparent 0%), radial-gradient(circle at 75px 75px, #141414 2%, transparent 0%)',
        backgroundSize: '80px 80px',
        border: '16px solid #222222',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '75px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        color: '#f0f0f0',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Brand */}
      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '48px' }}>🔥</span>
          <span style={{ fontSize: '38px', fontWeight: 900, letterSpacing: '-1.5px', textTransform: 'uppercase', fontStyle: 'italic', color: '#ffffff' }}>
            BURN BOARD
          </span>
        </div>
        <div style={{
          backgroundColor: '#ff4d00',
          color: '#000000',
          padding: '10px 24px',
          borderRadius: '999px',
          fontSize: '20px',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          {categoryEmoji} {categoryLabel}
        </div>
      </div>

      {/* Center: The Roast */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px', margin: 'auto 0', maxWidth: '900px' }}>
        <div style={{ fontSize: '28px', color: '#a1a1aa', fontWeight: 600 }}>
          THE INTERNET SAID:
        </div>
        <div style={{
          fontSize,
          fontWeight: 800,
          lineHeight: 1.3,
          color: '#ffffff',
          textAlign: 'center',
          letterSpacing: '-0.5px',
        }}>
          &ldquo;{report.topRoast.text}&rdquo;
        </div>
        <div style={{ fontSize: '22px', color: '#71717a' }}>
          — {report.displayName}&apos;s Hot Seat
        </div>
      </div>

      {/* Bottom Stats & Footer */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
        <div style={{ display: 'flex', gap: '32px', fontSize: '22px', color: '#a1a1aa' }}>
          <span>🔥 Score: <span style={{ color: '#ff4d00', fontWeight: 900 }}>{report.burnScore}/100</span></span>
          <span>•</span>
          <span>{report.roastCount} roasts</span>
        </div>
        <div style={{
          display: 'flex',
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '2px solid #222222',
          paddingTop: '28px',
          fontSize: '22px',
        }}>
          <div style={{ color: '#a1a1aa', fontWeight: 600 }}>Can you survive the <span style={{ color: '#ffffff', fontWeight: 800 }}>internet</span>?</div>
          <div style={{ color: '#ff4d00', fontWeight: 900, letterSpacing: '0.5px' }}>burnboard.app</div>
        </div>
      </div>
    </div>
  );
}

// ── Variant C: Summary Card ──
export function SummaryCard({ report, cardRef }) {
  const scoreColor = getScoreColor(report.burnScore);

  return (
    <div
      ref={cardRef}
      className="burn-share-card"
      style={{
        width: '1080px',
        height: '1080px',
        backgroundColor: '#0a0a0a',
        backgroundImage: 'radial-gradient(circle at 25px 25px, #1a1a1a 2%, transparent 0%), radial-gradient(circle at 75px 75px, #141414 2%, transparent 0%)',
        backgroundSize: '80px 80px',
        border: '16px solid #222222',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '75px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        color: '#f0f0f0',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Brand */}
      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '48px' }}>🔥</span>
          <span style={{ fontSize: '38px', fontWeight: 900, letterSpacing: '-1.5px', textTransform: 'uppercase', fontStyle: 'italic', color: '#ffffff' }}>
            BURN BOARD
          </span>
        </div>
        <div style={{
          backgroundColor: '#161616',
          border: '2px solid #333333',
          padding: '10px 24px',
          borderRadius: '999px',
          fontSize: '20px',
          fontWeight: 800,
          color: '#ff4d00',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          BURN REPORT
        </div>
      </div>

      {/* Center: Summary */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', margin: 'auto 0', width: '100%' }}>
        {/* Score Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '20px', color: '#71717a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>Score</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '72px', fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{report.burnScore}</span>
              <span style={{ fontSize: '28px', fontWeight: 700, color: '#555555' }}>/100</span>
            </div>
          </div>
          <div style={{ width: '2px', height: '80px', backgroundColor: '#333333' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '20px', color: '#71717a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>Status</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: scoreColor }}>{report.burnStatus.emoji} {report.burnStatus.label}</div>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'flex', gap: '40px', fontSize: '22px', color: '#a1a1aa' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#ffffff' }}>{report.roastCount}</div>
            <div style={{ fontSize: '18px', color: '#71717a' }}>Roasts</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#ffffff' }}>{report.totalReactions}</div>
            <div style={{ fontSize: '18px', color: '#71717a' }}>Reactions</div>
          </div>
        </div>

        {/* Top Roast */}
        {report.topRoast && (
          <div style={{ marginTop: '12px', padding: '24px', backgroundColor: '#111111', border: '2px solid #333333', borderRadius: '20px', width: '100%' }}>
            <div style={{ fontSize: '16px', color: '#71717a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px' }}>
              🔥 TOP ROAST
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, lineHeight: 1.35, color: '#ffffff' }}>
              &ldquo;{report.topRoast.text.length > 200 ? report.topRoast.text.slice(0, 197) + '...' : report.topRoast.text}&rdquo;
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA & Footer */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
        <div style={{
          backgroundColor: '#ff4d00',
          color: '#000000',
          padding: '14px 40px',
          borderRadius: '14px',
          fontSize: '22px',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          CAN YOU SURVIVE THE INTERNET?
        </div>
        <div style={{
          display: 'flex',
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '2px solid #222222',
          paddingTop: '24px',
          fontSize: '22px',
        }}>
          <div style={{ color: '#a1a1aa', fontWeight: 600 }}>{report.displayName}&apos;s <span style={{ color: '#ffffff', fontWeight: 800 }}>Burn Report</span></div>
          <div style={{ color: '#ff4d00', fontWeight: 900, letterSpacing: '0.5px' }}>burnboard.app</div>
        </div>
      </div>
    </div>
  );
}

// ── Download Card as PNG ──
async function downloadCard(cardRef, filename) {
  if (!cardRef.current) return;
  try {
    const dataUrl = await toPng(cardRef.current, {
      width: 1080,
      height: 1080,
      pixelRatio: 1,
      backgroundColor: '#0a0a0a',
    });
    const link = document.createElement('a');
    link.download = filename || 'burnboard-share.png';
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('[ShareCard] Download failed:', err);
    throw err;
  }
}

// ── Share Actions Component ──
export function ShareActions({ report, variant, cardRef }) {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://burnboard.app';
  const shareUrl = `${baseUrl}${report.shareUrl}`;
  const shareTitle = `🔥 I got a Burn Score of ${report.burnScore}/100 on BURN BOARD!`;
  const shareText = `My Burn Score is ${report.burnScore}/100 — ${report.burnStatus.label}! Can you survive the internet?`;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const variantLabel = variant === 'score' ? 'score' : variant === 'roast' ? 'roast' : 'summary';
      await downloadCard(cardRef, `burnboard-${variantLabel}-${report.hotSeatId}.png`);
      setToast('Card downloaded! 🔥');
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast('Download failed — try again');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDownloading(false);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
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

  const handleCopyLink = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      }
      setCopied(true);
      setToast('Link copied! 🔥');
      setTimeout(() => { setCopied(false); setToast(null); }, 3000);
    } catch {
      setToast('Copy failed — try again');
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <>
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#ff4d00] text-black px-4 py-2 rounded-xl text-xs font-mono font-bold shadow-lg animate-bounce">
          {toast}
        </div>
      )}
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={handleNativeShare}
          className="flex items-center gap-2 px-5 py-3 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(255,77,0,0.4)]"
          aria-label="Share result"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
        <button
          onClick={handleCopyLink}
          className={`flex items-center gap-2 px-5 py-3 font-bold text-xs uppercase tracking-wider rounded-xl transition-all border ${
            copied
              ? 'bg-green-600/10 border-green-500/30 text-green-400'
              : 'bg-[#111] hover:bg-[#1a1a1a] border-[#333] hover:border-[#ff4d00]/50 text-white'
          }`}
          aria-label="Copy share link"
        >
          {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 px-5 py-3 bg-[#111] hover:bg-[#1a1a1a] border border-[#333] hover:border-[#ff4d00]/50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
          aria-label="Download share card"
        >
          <Download className="w-4 h-4" />
          {downloading ? 'Saving...' : 'Download Card'}
        </button>
      </div>
    </>
  );
}

// ── Main BurnShareCard Component ──
export default function BurnShareCard({ report }) {
  const [selectedVariant, setSelectedVariant] = useState('summary');
  const scoreCardRef = useRef(null);
  const roastCardRef = useRef(null);
  const summaryCardRef = useRef(null);

  const getActiveRef = useCallback(() => {
    if (selectedVariant === 'score') return scoreCardRef;
    if (selectedVariant === 'roast') return roastCardRef;
    return summaryCardRef;
  }, [selectedVariant]);

  const variants = [
    { id: 'score', label: 'Score Card', icon: '🔥' },
    { id: 'roast', label: 'Top Roast', icon: '💀' },
    { id: 'summary', label: 'Summary', icon: '📊' },
  ];

  return (
    <div className="space-y-6">
      {/* Variant Selector */}
      <div className="flex items-center justify-center gap-2">
        {variants.map(v => {
          // Hide roast variant if no top roast
          if (v.id === 'roast' && !report.topRoast) return null;
          return (
            <button
              key={v.id}
              onClick={() => setSelectedVariant(v.id)}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                selectedVariant === v.id
                  ? 'bg-[#ff4d00] text-black'
                  : 'bg-[#111] text-zinc-400 border border-[#333] hover:border-[#ff4d00]/50 hover:text-white'
              }`}
            >
              {v.icon} {v.label}
            </button>
          );
        })}
      </div>

      {/* Card Preview (scaled for viewport) */}
      <div className="flex justify-center overflow-hidden rounded-2xl border border-[#222]">
        <div
          className="relative origin-top-left"
          style={{
            width: '1080px',
            height: '1080px',
            transform: 'scale(var(--card-scale, 0.45))',
            transformOrigin: 'top center',
          }}
        >
          {/* Hidden cards for download (off-screen, full size) */}
          <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
            {selectedVariant === 'score' && <ScoreCard report={report} cardRef={scoreCardRef} />}
            {selectedVariant === 'roast' && report.topRoast && <RoastCard report={report} cardRef={roastCardRef} />}
            {selectedVariant === 'summary' && <SummaryCard report={report} cardRef={summaryCardRef} />}
          </div>
          {/* Visible scaled preview */}
          {selectedVariant === 'score' && <ScoreCard report={report} cardRef={React.createRef()} />}
          {selectedVariant === 'roast' && report.topRoast && <RoastCard report={report} cardRef={React.createRef()} />}
          {selectedVariant === 'summary' && <SummaryCard report={report} cardRef={React.createRef()} />}
        </div>
      </div>

      {/* Share Actions */}
      <ShareActions
        report={report}
        variant={selectedVariant}
        cardRef={getActiveRef()}
      />

      <style jsx>{`
        @media (max-width: 640px) {
          :global(.burn-share-card) {
            --card-scale: 0.3 !important;
          }
        }
        @media (min-width: 641px) and (max-width: 1024px) {
          :global(.burn-share-card) {
            --card-scale: 0.55 !important;
          }
        }
      `}</style>
    </div>
  );
}
