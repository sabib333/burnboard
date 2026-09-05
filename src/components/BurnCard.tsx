/**
 * BURNBOARD — BurnCard Component
 *
 * Renders a roast as a pixel-perfect shareable card.
 * Features:
 * - Download as PNG (via html-to-image)
 * - Share to Instagram Story (via Web Share API or deep link)
 * - Copy link to clipboard
 *
 * Uses html-to-image for client-side canvas rendering.
 */

import React, { useRef, useState, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { Download, Share2, Copy, Check, Instagram } from 'lucide-react';

interface BurnCardProps {
  roastText: string;
  username: string;
  platform?: string;
  anonId?: string;
  upvotes?: number;
  reactions?: { haha?: number; brutal?: number; cry?: number };
  onShowToast?: (text: string) => void;
}

export const BurnCard: React.FC<BurnCardProps> = ({
  roastText,
  username,
  platform = 'Social',
  anonId = 'Anonymous Burner',
  upvotes = 0,
  reactions,
  onShowToast,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const getPlatformColor = (p: string) => {
    switch (p?.toLowerCase()) {
      case 'x': case 'x / twitter': return { bg: '#0a0a1a', accent: '#1d9bf0', text: '#60a5fa' };
      case 'linkedin': return { bg: '#0a1628', accent: '#0077b5', text: '#60a5fa' };
      case 'github': return { bg: '#0a1a0a', accent: '#238636', text: '#4ade80' };
      case 'instagram': return { bg: '#1a0a14', accent: '#e1306c', text: '#f472b6' };
      case 'tiktok': return { bg: '#0a0a0a', accent: '#ff0050', text: '#ff2d55' };
      case 'reddit': return { bg: '#1a0a0a', accent: '#ff4500', text: '#fb923c' };
      default: return { bg: '#0a0a0a', accent: '#ff4d00', text: '#ff4d00' };
    }
  };

  const colors = getPlatformColor(platform);

  // ── Download as PNG ──────────────────────────────────────
  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setDownloading(true);

    try {
      const dataUrl = await toPng(cardRef.current, {
        width: 1080,
        height: 1080,
        pixelRatio: 2,
        backgroundColor: '#0a0a0a',
      });

      const link = document.createElement('a');
      link.download = `burnboard-${username}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      onShowToast?.('Card downloaded! 🔥');
    } catch (err) {
      console.error('[BurnCard] Download failed:', err);
      onShowToast?.('Download failed — try again');
    } finally {
      setDownloading(false);
    }
  }, [username, onShowToast]);

  // ── Share to Instagram Story ─────────────────────────────
  const handleInstagramShare = useCallback(async () => {
    if (!cardRef.current) return;

    try {
      const dataUrl = await toPng(cardRef.current, {
        width: 1080,
        height: 1080,
        pixelRatio: 2,
        backgroundColor: '#0a0a0a',
      });

      // Convert to blob for sharing
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `burnboard-${username}.png`, { type: 'image/png' });

      // Try Web Share API with file
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `🔥 ${username} got roasted`,
          text: `"${roastText}" — via BURNBOARD`,
          files: [file],
        });
        onShowToast?.('Shared! 🔥');
      } else {
        // Fallback: download the image (user can then share manually)
        handleDownload();
        onShowToast?.('Image saved — share it on Instagram!');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      handleDownload();
    }
  }, [username, roastText, handleDownload, onShowToast]);

  // ── Copy Link ────────────────────────────────────────────
  const handleCopyLink = useCallback(async () => {
    const text = `"${roastText}" — roasted on BURNBOARD 🔥\nhttps://burnxboard.xyz`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onShowToast?.('Copied to clipboard! 📋');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onShowToast?.('Failed to copy');
    }
  }, [roastText, onShowToast]);

  return (
    <div className="space-y-3">
      {/* ── The Card (rendered at 1080x1080 for export) ──── */}
      <div
        ref={cardRef}
        style={{
          width: 1080,
          height: 1080,
          backgroundColor: colors.bg,
          backgroundImage: 'radial-gradient(circle at 25px 25px, #1a1a1a 2%, transparent 0%), radial-gradient(circle at 75px 75px, #141414 2%, transparent 0%)',
          backgroundSize: '80px 80px',
          padding: 75,
          fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
          border: '16px solid #222222',
          color: '#f0f0f0',
          boxSizing: 'border-box' as const,
          display: 'flex',
          flexDirection: 'column' as const,
          justifyContent: 'space-between',
          position: 'relative' as const,
          overflow: 'hidden',
        }}
      >
        {/* Top Brand */}
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 48 }}>🔥</span>
            <span style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-1.5px', textTransform: 'uppercase', fontStyle: 'italic' }}>
              BURNBOARD
            </span>
          </div>
          <div style={{
            backgroundColor: colors.accent,
            color: '#000000',
            padding: '10px 24px',
            borderRadius: 999,
            fontSize: 20,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}>
            {platform}
          </div>
        </div>

        {/* Center: Roast Text */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 930, margin: 'auto 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: '#a1a1aa', fontSize: 26, fontWeight: 600 }}>
            <span style={{ color: '#ff4d00', fontWeight: 800 }}>{anonId}</span>
            <span>•</span>
            <span>roasted</span>
            <span style={{ color: '#ffffff', fontWeight: 800 }}>@{username}</span>
          </div>
          <div style={{
            fontSize: roastText.length > 120 ? 40 : roastText.length > 80 ? 44 : 52,
            fontWeight: 800,
            lineHeight: 1.3,
            letterSpacing: '-0.5px',
          }}>
            &ldquo;{roastText}&rdquo;
          </div>

          {/* Reaction Summary */}
          {reactions && (
            <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
              {reactions.haha ? <span style={{ fontSize: 28 }}>😂 {reactions.haha}</span> : null}
              {reactions.brutal ? <span style={{ fontSize: 28 }}>💀 {reactions.brutal}</span> : null}
              {reactions.cry ? <span style={{ fontSize: 28 }}>😭 {reactions.cry}</span> : null}
              {upvotes > 0 ? <span style={{ fontSize: 28, color: '#ff4d00' }}>🔥 {upvotes}</span> : null}
            </div>
          )}
        </div>

        {/* Bottom Footer */}
        <div style={{
          display: 'flex',
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '2px solid #222222',
          paddingTop: 28,
          fontSize: 22,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#a1a1aa', fontWeight: 700 }}>
            <span>Target:</span>
            <span style={{ color: '#ffffff', fontSize: 24, fontWeight: 900 }}>@{username}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 900 }}>🔥 BURNBOARD</span>
            <span style={{ color: '#555555' }}>|</span>
            <span style={{ color: '#ff4d00', fontWeight: 800 }}>burnxboard.xyz</span>
          </div>
        </div>
      </div>

      {/* ── Action Buttons ──────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(255,77,0,0.3)]"
        >
          <Download className="w-4 h-4" />
          {downloading ? 'Generating...' : 'Download PNG'}
        </button>

        <button
          onClick={handleInstagramShare}
          className="flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all hover:opacity-90"
        >
          <Instagram className="w-4 h-4" />
          <span className="hidden sm:inline">Story</span>
        </button>

        <button
          onClick={handleCopyLink}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider border transition-all ${
            copied
              ? 'bg-green-600 text-white border-green-500'
              : 'bg-[#111] text-zinc-300 border-[#333] hover:border-[#ff4d00]/50 hover:text-white'
          }`}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
};

export default BurnCard;
