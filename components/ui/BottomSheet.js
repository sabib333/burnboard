'use client';

import React, { useEffect, useCallback } from 'react';

/**
 * BottomSheet — Mobile-optimized slide-up overlay.
 * 
 * Usage:
 *   <BottomSheet open={isOpen} onClose={() => setIsOpen(false)} title="Options">
 *     <p>Content here</p>
 *   </BottomSheet>
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  closeOnOverlay = true,
  className = '',
}) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={closeOnOverlay ? onClose : undefined}
      />

      {/* Sheet */}
      <div className={`relative w-full max-h-[85vh] bg-[#111] border-t border-[#222] sm:border sm:rounded-2xl sm:max-w-md shadow-2xl animate-slide-up overflow-hidden ${className}`}>
        {/* Drag Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-zinc-600 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#222]">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">{title}</h3>
            <button
              onClick={onClose}
              className="text-xs font-mono text-[#ff4d00] hover:text-white transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-60px)] p-4 pb-safe">
          {children}
        </div>
      </div>
    </div>
  );
}
