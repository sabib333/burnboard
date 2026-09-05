'use client';

import React from 'react';

/**
 * Skeleton — Content placeholder during loading.
 * 
 * Usage:
 *   <Skeleton className="w-32 h-4" />
 *   <Skeleton variant="circle" className="w-10 h-10" />
 *   <Skeleton variant="rect" className="h-48 w-full" />
 */
export default function Skeleton({
  variant = 'text',
  className = '',
  ...props
}) {
  const baseStyles = 'animate-pulse bg-[#222] rounded';

  const variants = {
    text: 'h-3 rounded',
    title: 'h-5 rounded w-3/4',
    circle: 'rounded-full',
    rect: 'rounded-2xl',
    card: 'rounded-2xl h-40',
  };

  return (
    <div
      className={`${baseStyles} ${variants[variant] || ''} ${className}`}
      {...props}
    />
  );
}

/**
 * CardSkeleton — Pre-built card loading placeholder.
 */
export function CardSkeleton() {
  return (
    <div className="bg-[#111] border border-[#222] rounded-2xl p-4 sm:p-5 space-y-4 animate-pulse">
      <div className="flex items-start gap-3">
        <Skeleton variant="circle" className="w-10 h-10 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="w-32 h-4" />
          <Skeleton className="w-20 h-3" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="w-full h-3" />
        <Skeleton className="w-4/5 h-3" />
      </div>
    </div>
  );
}

/**
 * ListSkeleton — Pre-built list loading placeholder.
 */
export function ListSkeleton({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
