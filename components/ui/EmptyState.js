'use client';

import React from 'react';

/**
 * EmptyState — Displayed when no content is available.
 * 
 * Usage:
 *   <EmptyState
 *     icon="🔥"
 *     title="No roasts yet"
 *     description="Be the first to fire a shot!"
 *     action={<Button onClick={handler}>Create Hot Seat</Button>}
 *   />
 */
export default function EmptyState({
  icon = '🔥',
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div className={`bg-[#111] border border-dashed border-[#333] rounded-2xl p-8 sm:p-10 text-center space-y-3 ${className}`}>
      <div className="text-4xl">{icon}</div>
      {title && (
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{title}</h3>
      )}
      {description && (
        <p className="text-xs text-zinc-500 max-w-sm mx-auto">{description}</p>
      )}
      {action && (
        <div className="pt-2">{action}</div>
      )}
    </div>
  );
}
