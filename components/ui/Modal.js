'use client';

import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

/**
 * Modal — Desktop dialog overlay.
 * 
 * Usage:
 *   <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Settings">
 *     <p>Content here</p>
 *   </Modal>
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlay = true,
  showClose = true,
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

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={closeOnOverlay ? onClose : undefined}
      />

      {/* Dialog */}
      <div className={`relative w-full ${sizes[size] || sizes.md} bg-[#111] border border-[#222] rounded-2xl shadow-2xl animate-scale-in ${className}`}>
        {/* Header */}
        {(title || showClose) && (
          <div className="flex items-center justify-between p-4 border-b border-[#222]">
            {title && (
              <h3 className="text-sm font-black text-white uppercase tracking-wider">{title}</h3>
            )}
            {showClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors text-zinc-400 hover:text-white"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
