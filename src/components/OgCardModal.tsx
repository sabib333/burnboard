import React, { useRef, useEffect, useState } from 'react';
import { X, Download, Copy, Check, Flame, Share2, Sparkles } from 'lucide-react';
import { Roast, Profile } from '../types';

interface OgCardModalProps {
  roast: Roast | null;
  profile: Profile | null;
  onClose: () => void;
  onShowToast: (text: string, subtext?: string) => void;
}

export const OgCardModal: React.FC<OgCardModalProps> = ({
  roast,
  profile,
  onClose,
  onShowToast
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!roast || !profile) return null;

  // Draw card on canvas for download
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1200;
    const height = 630;
    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Subtle grid/dot pattern
    ctx.fillStyle = '#161616';
    for (let x = 30; x < width; x += 40) {
      for (let y = 30; y < height; y += 40) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Border
    ctx.strokeStyle = '#262626';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // Flame corner accent
    ctx.strokeStyle = '#ff4d00';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(20, 100);
    ctx.lineTo(20, 20);
    ctx.lineTo(100, 20);
    ctx.stroke();

    // Top Header: BURNBOARD Brand
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px sans-serif';
    ctx.fillText('🔥 BURNBOARD', 60, 90);

    ctx.fillStyle = '#ff4d00';
    ctx.font = '700 16px sans-serif';
    ctx.fillText('NO AI • 100% HUMAN ROASTS', 60, 120);

    // Platform pill
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.roundRect(width - 220, 55, 160, 48, 24);
    ctx.fill();
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ff4d00';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(profile.platform.toUpperCase(), width - 140, 86);
    ctx.textAlign = 'left';

    // Target User info
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '600 24px sans-serif';
    ctx.fillText(`Target: @${profile.username}`, 60, 200);

    ctx.fillStyle = '#ff4d00';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`[${roast.anon_id}]`, 60, 235);

    // Roast Text - Word wrap
    ctx.fillStyle = '#ffffff';
    const fontSize = roast.roast_text.length > 120 ? 38 : 46;
    ctx.font = `bold ${fontSize}px sans-serif`;

    const maxWidth = width - 130;
    const lineHeight = fontSize * 1.3;
    const words = `"${roast.roast_text}"`.split(' ');
    let line = '';
    let y = 310;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, 60, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 60, y);

    // Footer divider & stats
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, height - 90);
    ctx.lineTo(width - 60, height - 90);
    ctx.stroke();

    ctx.fillStyle = '#71717a';
    ctx.font = '600 20px sans-serif';
    ctx.fillText('burnboard.co — Get Roasted By Real Humans', 60, height - 48);

    ctx.fillStyle = '#ff4d00';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`💀 ▲ ${roast.upvotes} UPVOTES`, width - 60, height - 48);
    ctx.textAlign = 'left';
  }, [roast, profile]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `burnboard-roast-${profile.username}.png`;
    a.click();
    onShowToast('Viral Card Downloaded', 'Ready to post on X, Reddit, or Instagram stories');
  };

  const handleCopyText = () => {
    const textToCopy = `"${roast.roast_text}" — Roasted on BURNBOARD 🔥 (Target: @${profile.username})`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShowToast('Roast Text Copied', 'Paste anywhere to share');
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/#post/${profile.id}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    onShowToast('Direct Link Copied', 'Shareable thread URL ready');
  };

  return (
    <div
      id="modal-og-card"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#111] border border-[#262626] rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#222]">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#ff4d00]" />
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              Viral Roast Card (Vercel OG)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visual Card Preview */}
        <div className="my-5 rounded-xl overflow-hidden border border-[#333] shadow-2xl bg-[#0a0a0a] relative group">
          <canvas
            ref={canvasRef}
            className="w-full h-auto block rounded-xl aspect-[1200/630]"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="px-3 py-2 bg-[#1a1a1a] hover:bg-[#222] text-xs font-mono font-bold text-zinc-300 hover:text-white rounded-xl border border-[#333] transition-all flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied Text!' : 'Copy Roast'}</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="px-3 py-2 bg-[#1a1a1a] hover:bg-[#222] text-xs font-mono font-bold text-zinc-300 hover:text-white rounded-xl border border-[#333] transition-all flex items-center gap-2"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedLink ? 'Link Copied!' : 'Share Link'}</span>
            </button>
          </div>

          <button
            onClick={handleDownload}
            className="px-5 py-2.5 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-extrabold rounded-xl transition-all flex items-center gap-2 text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(255,77,0,0.4)] active:scale-95"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>Download PNG (1200x630)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
