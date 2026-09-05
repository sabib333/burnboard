'use client';

import React from 'react';

/**
 * Button — Primary interaction element.
 * 
 * Variants: primary (burn orange), secondary (ghost), danger, success
 * Sizes: sm, md, lg
 * 
 * Usage:
 *   <Button variant="primary" size="md">Action</Button>
 *   <Button variant="secondary" loading>Processing</Button>
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon: Icon,
  iconRight: IconRight,
  className = '',
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100';

  const variants = {
    primary: 'bg-[#ff4d00] hover:bg-[#ff6622] text-black shadow-[0_0_15px_rgba(255,77,0,0.3)] hover:shadow-[0_0_20px_rgba(255,77,0,0.4)]',
    secondary: 'bg-[#111] hover:bg-[#1a1a1a] border border-[#333] hover:border-[#ff4d00]/50 text-zinc-300 hover:text-white',
    danger: 'bg-red-600 hover:bg-red-500 text-white',
    success: 'bg-green-600 hover:bg-green-500 text-white',
    ghost: 'bg-transparent hover:bg-[#1a1a1a] text-zinc-400 hover:text-white',
    burn: 'bg-[#ff4d00]/10 hover:bg-[#ff4d00]/20 text-[#ff4d00] border border-[#ff4d00]/30 hover:border-[#ff4d00]/50',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-[11px]',
    md: 'px-4 py-2.5 text-xs',
    lg: 'px-6 py-3 text-sm',
    xl: 'px-8 py-4 text-base',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${fullWidth ? 'w-full' : ''} font-mono ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      {children}
      {IconRight && <IconRight className="w-4 h-4" />}
    </button>
  );
}
