'use client';

import React from 'react';

/**
 * Divider — Visual section separator.
 * 
 * Usage:
 *   <Divider />
 *   <Divider label="OR" />
 *   <Divider label="Popular" />
 */
export default function Divider({
  label,
  className = '',
}) {
  if (label) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex-1 h-px bg-[#222]" />
        <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">{label}</span>
        <div className="flex-1 h-px bg-[#222]" />
      </div>
    );
  }

  return <div className={`h-px bg-[#222] ${className}`} />;
}
