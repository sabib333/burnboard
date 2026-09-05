'use client';

import React from 'react';

/**
 * Badge — Small label for status, counts, and categories.
 * 
 * Variants: burn, success, warning, error, info, neutral, platform-specific
 * 
 * Usage:
 *   <Badge variant="burn">🔥 Trending</Badge>
 *   <Badge variant="success">Active</Badge>
 *   <Badge variant="neutral" dot>Online</Badge>
 */
const VARIANTS = {
  burn: 'bg-[#ff4d00]/10 text-[#ff4d00] border-[#ff4d00]/30',
  success: 'bg-green-500/10 text-green-400 border-green-500/30',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  error: 'bg-red-500/10 text-red-400 border-red-500/30',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  neutral: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  pink: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  sky: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
};

export default function Badge({
  children,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  uppercase = true,
  mono = true,
  className = '',
}) {
  const sizes = {
    xs: 'px-1.5 py-0.5 text-[9px]',
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-[11px]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold ${VARIANTS[variant] || VARIANTS.neutral} ${sizes[size] || sizes.sm} ${uppercase ? 'uppercase' : ''} ${mono ? 'font-mono' : ''} tracking-wider ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${variant === 'success' ? 'bg-green-400' : variant === 'burn' ? 'bg-[#ff4d00]' : 'bg-current'}`} />
      )}
      {children}
    </span>
  );
}
