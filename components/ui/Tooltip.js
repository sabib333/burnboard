'use client';

import React, { useState } from 'react';

/**
 * Tooltip — Hover information bubble.
 * 
 * Usage:
 *   <Tooltip text="Upvote this roast">
 *     <IconButton icon={ArrowBigUp} />
 *   </Tooltip>
 */
export default function Tooltip({
  children,
  text,
  position = 'top',
  className = '',
}) {
  const [show, setShow] = useState(false);

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && text && (
        <div className={`absolute ${positions[position]} z-50 px-2.5 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-[10px] font-mono text-zinc-300 whitespace-nowrap shadow-lg animate-fade-in pointer-events-none`}>
          {text}
        </div>
      )}
    </div>
  );
}
