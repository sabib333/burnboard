'use client';

import React from 'react';

/**
 * IconButton — Compact icon-only button for toolbars and tight spaces.
 * 
 * Usage:
 *   <IconButton icon={Bell} label="Notifications" />
 *   <IconButton icon={X} label="Close" variant="ghost" />
 */
export default function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  active = false,
  badge,
  className = '',
  ...props
}) {
  const baseStyles = 'relative inline-flex items-center justify-center rounded-xl transition-all duration-150 active:scale-90';

  const variants = {
    ghost: active
      ? 'bg-[#ff4d00]/10 text-[#ff4d00]'
      : 'bg-transparent hover:bg-[#1a1a1a] text-zinc-400 hover:text-white',
    solid: active
      ? 'bg-[#ff4d00] text-black'
      : 'bg-[#111] hover:bg-[#1a1a1a] text-zinc-400 hover:text-white border border-[#262626]',
    burn: 'bg-[#ff4d00]/10 hover:bg-[#ff4d00]/20 text-[#ff4d00] border border-[#ff4d00]/20',
  };

  const sizes = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant] || variants.ghost} ${sizes[size] || sizes.md} ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon className={size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'} />
      {badge != null && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[#ff4d00] text-black text-[10px] font-mono font-black rounded-full px-1 shadow-[0_0_8px_rgba(255,77,0,0.5)]">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
