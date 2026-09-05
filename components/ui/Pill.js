'use client';

import React from 'react';

/**
 * Pill — Compact inline label, filter chip, or tag.
 * 
 * Usage:
 *   <Pill>🔥 ROAST</Pill>
 *   <Pill variant="burn" active onClick={handler}>Savage</Pill>
 *   <Pill icon={<Flame />} removable onRemove={handler}>Trending</Pill>
 */
export default function Pill({
  children,
  variant = 'neutral',
  size = 'sm',
  active = false,
  removable = false,
  onRemove,
  icon,
  onClick,
  className = '',
}) {
  const baseStyles = 'inline-flex items-center gap-1 rounded-lg border font-mono font-bold transition-all';

  const variants = {
    neutral: active
      ? 'bg-[#1a1a1a] text-white border-[#444]'
      : 'bg-[#0a0a0a] text-zinc-400 border-[#262626] hover:border-[#3a3a3a] hover:text-white',
    burn: active
      ? 'bg-[#ff4d00] text-black border-[#ff4d00]'
      : 'bg-[#ff4d00]/10 text-[#ff4d00] border-[#ff4d00]/30 hover:bg-[#ff4d00]/20',
    platform: 'bg-[#1a1a1a] text-zinc-300 border-[#333]',
  };

  const sizes = {
    xs: 'px-1.5 py-0.5 text-[9px]',
    sm: 'px-2 py-1 text-[10px]',
    md: 'px-3 py-1.5 text-[11px]',
  };

  const Component = onClick ? 'button' : 'span';

  return (
    <Component
      className={`${baseStyles} ${variants[variant] || variants.neutral} ${sizes[size] || sizes.sm} ${onClick ? 'cursor-pointer active:scale-95' : ''} ${className}`}
      onClick={onClick}
    >
      {icon}
      {children}
      {removable && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          className="ml-0.5 hover:text-white transition-colors"
          aria-label="Remove"
        >
          ×
        </button>
      )}
    </Component>
  );
}
