'use client';

import React from 'react';

/**
 * Card — Surface container for content grouping.
 * 
 * Variants: default, elevated, outlined, burn (featured highlight)
 * 
 * Usage:
 *   <Card>Content here</Card>
 *   <Card variant="burn">Featured content</Card>
 *   <Card variant="elevated" padding="lg">Spacious card</Card>
 */
export default function Card({
  children,
  variant = 'default',
  padding = 'md',
  hoverable = false,
  interactive = false,
  className = '',
  ...props
}) {
  const baseStyles = 'rounded-2xl transition-all duration-200';

  const variants = {
    default: 'bg-[#111] border border-[#222]',
    elevated: 'bg-[#1a1a1a] border border-[#262626] shadow-lg',
    outlined: 'bg-transparent border border-[#333]',
    burn: 'bg-[#111] border-2 border-[#ff4d00]/40 shadow-[0_0_20px_rgba(255,77,0,0.15)]',
    ghost: 'bg-transparent',
  };

  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4 sm:p-5',
    lg: 'p-6 sm:p-8',
  };

  const hoverStyles = hoverable ? 'hover:border-[#333] hover:shadow-lg cursor-pointer' : '';
  const interactiveStyles = interactive ? 'hover:border-[#ff4d00]/40 hover:shadow-[0_0_15px_rgba(255,77,0,0.1)] cursor-pointer active:scale-[0.99]' : '';

  return (
    <div
      className={`${baseStyles} ${variants[variant] || variants.default} ${paddings[padding] || paddings.md} ${hoverStyles} ${interactiveStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
