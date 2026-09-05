'use client';

import React from 'react';

/**
 * Avatar — User identity visual element.
 * 
 * Supports: image URL, initials fallback, color variants, size scaling.
 * 
 * Usage:
 *   <Avatar username="johndoe" size="md" />
 *   <Avatar src="/avatar.jpg" username="jane" size="lg" />
 *   <Avatar username="anon" color="#ff4d00" size="sm" />
 */
const SIZES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-20 h-20 text-2xl',
};

const COLORS = [
  'bg-[#ff4d00] text-black',
  'bg-blue-600 text-white',
  'bg-emerald-600 text-white',
  'bg-purple-600 text-white',
  'bg-pink-600 text-white',
  'bg-amber-500 text-black',
  'bg-cyan-600 text-white',
  'bg-rose-600 text-white',
];

function getColorFromName(name) {
  if (!name) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/[\s._-]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function Avatar({
  src,
  username,
  size = 'md',
  color,
  showRing = false,
  online = false,
  className = '',
}) {
  const sizeClass = SIZES[size] || SIZES.md;
  const colorClass = color || getColorFromName(username);
  const initials = getInitials(username);

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center font-black ${
          showRing ? 'ring-2 ring-[#ff4d00] ring-offset-2 ring-offset-[#0a0a0a]' : ''
        }`}
      >
        {src ? (
          <img
            src={src}
            alt={username || 'Avatar'}
            className="w-full h-full rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#111] rounded-full" />
      )}
    </div>
  );
}
