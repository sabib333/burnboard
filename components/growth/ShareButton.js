'use client';

import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { shareResource } from '@/lib/growth/share';

/**
 * ShareButton — universal, accessible share control.
 *
 * Uses the native share sheet when available, falls back to clipboard, and
 * records a REAL share event server-side. Labeled (not icon-only) so it stays
 * keyboard/screen-reader friendly; the success state is announced via aria.
 */
export default function ShareButton({
  resourceType,
  resourceId,
  url,
  title,
  text,
  variant = 'default',
  label = 'Share',
  idempotencyKey,
  className = '',
  onShared,
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const channel = await shareResource({ resourceType, resourceId, url, title, text, idempotencyKey });
      if (channel === 'clipboard' || channel === 'link') {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
      if (channel) onShared?.(channel);
    } catch {
      // Never crash the card — sharing is best-effort.
    } finally {
      setBusy(false);
    }
  };

  const styles = {
    default: 'bg-[#1a1a1a] border border-[#333] text-zinc-300 hover:text-white hover:border-[#ff4d00]/50',
    solid: 'bg-[#ff4d00] text-black font-bold hover:bg-[#ff6622]',
    ghost: 'bg-transparent text-zinc-400 hover:text-white hover:bg-[#1a1a1a]',
  }[variant] || styles.default;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={copied ? 'Link copied' : (label || 'Share')}
      title={label}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all disabled:opacity-50 ${styles} ${className}`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
      <span className={copied ? 'text-green-400' : ''}>{copied ? 'Copied!' : label}</span>
    </button>
  );
}