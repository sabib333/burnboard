'use client';

import React from 'react';
import { Flame } from 'lucide-react';

/**
 * LoadingSpinner — Loading indicator with BurnBoard branding.
 * 
 * Usage:
 *   <LoadingSpinner />
 *   <LoadingSpinner text="Loading roasts..." size="lg" />
 */
export default function LoadingSpinner({
  text,
  size = 'md',
  className = '',
}) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Flame className={`${sizes[size] || sizes.md} text-[#ff4d00] animate-pulse`} />
      {text && (
        <p className="text-xs font-mono text-zinc-400 animate-pulse">{text}</p>
      )}
    </div>
  );
}
