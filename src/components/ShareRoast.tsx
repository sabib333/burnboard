/**
 * BURNBOARD ShareRoast
 *
 * Share roast to:
 * - Twitter/X intent (pre-filled tweet)
 * - LinkedIn share
 * - Copy link to clipboard
 * - Download OG card image (via /api/og)
 */

import React, { useState } from 'react';
import { Share2, Download, Copy, Check, ExternalLink } from 'lucide-react';
import { type Roast, type Profile } from '../types';

interface ShareRoastProps {
  roast: Roast;
  profile?: Profile;
  onShowToast: (text: string, subtext?: string) => void;
}

export const ShareRoast: React.FC<ShareRoastProps> = ({ roast, profile, onShowToast }) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const shareText = `"${roast.roast_text}" — roasted on BURNBOARD 🔥`;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://burnboard.app';

  // Twitter/X Intent
  const handleTwitterShare = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'width=550,height=420');
  };

  // LinkedIn Share
  const handleLinkedInShare = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'width=550,height=420');
  };

  // Copy Link
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      onShowToast('Copied to clipboard! 📋');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onShowToast('Failed to copy', 'Try again');
    }
  };

  // Download OG Card
  const handleDownloadCard = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams({
        username: profile?.username || 'Anonymous',
        platform: profile?.platform || 'Unknown',
        roast: roast.roast_text,
        upvotes: String(roast.upvotes || 0),
      });

      const response = await fetch(`/api/og?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to generate card');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `burnboard-${profile?.username || 'roast'}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onShowToast('Card downloaded! 🔥', 'Share it on social media');
    } catch (err) {
      console.warn('[ShareRoast] Download failed:', err);
      onShowToast('Download failed', 'Try again later');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleTwitterShare}
        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#141414] hover:bg-[#1f1f1f] text-zinc-400 hover:text-white border border-[#262626] rounded-lg text-[10px] font-mono transition-colors"
        title="Share on X/Twitter"
      >
        <span>𝕏</span>
        <span className="hidden sm:inline">Tweet</span>
      </button>

      <button
        onClick={handleLinkedInShare}
        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#141414] hover:bg-[#1f1f1f] text-zinc-400 hover:text-sky-400 border border-[#262626] rounded-lg text-[10px] font-mono transition-colors"
        title="Share on LinkedIn"
      >
        <ExternalLink className="w-3 h-3" />
        <span className="hidden sm:inline">LinkedIn</span>
      </button>

      <button
        onClick={handleCopyLink}
        className={`flex items-center gap-1 px-2.5 py-1.5 border border-[#262626] rounded-lg text-[10px] font-mono transition-colors ${
          copied
            ? 'bg-green-900/30 text-green-400 border-green-500/30'
            : 'bg-[#141414] hover:bg-[#1f1f1f] text-zinc-400 hover:text-white'
        }`}
        title="Copy link"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
      </button>

      <button
        onClick={handleDownloadCard}
        disabled={downloading}
        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#ff4d00]/20 hover:bg-[#ff4d00] text-[#ff4d00] hover:text-black border border-[#ff4d00]/30 rounded-lg text-[10px] font-mono transition-colors disabled:opacity-50"
        title="Download OG card"
      >
        <Download className="w-3 h-3" />
        <span className="hidden sm:inline">{downloading ? 'Loading...' : 'Card'}</span>
      </button>
    </div>
  );
};

export default ShareRoast;
