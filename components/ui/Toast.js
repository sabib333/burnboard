'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Flame, AlertTriangle } from 'lucide-react';

/**
 * Toast — Temporary notification overlay.
 * 
 * Usage:
 *   const { toast, showToast } = useToast();
 *   return (
 *     <>
 *       {toast && <Toast {...toast} onClose={hideToast} />}
 *       <Button onClick={() => showToast('Saved!', 'success')}>Save</Button>
 *     </>
 *   );
 */

const ICONS = {
  success: Check,
  error: X,
  info: Flame,
  warning: AlertTriangle,
};

const STYLES = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-[#ff4d00] text-black',
  warning: 'bg-amber-500 text-black',
};

export function useToast(duration = 3000) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((text, type = 'info') => {
    setToast({ text, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(hideToast, duration);
      return () => clearTimeout(timer);
    }
  }, [toast, duration, hideToast]);

  return { toast, showToast, hideToast };
}

export default function Toast({ text, type = 'info', onClose, className = '' }) {
  const Icon = ICONS[type] || Flame;
  const style = STYLES[type] || STYLES.info;

  return (
    <div className={`fixed bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold shadow-lg animate-slide-up ${style} ${className}`}>
      <Icon className="w-4 h-4" />
      <span>{text}</span>
      {onClose && (
        <button onClick={onClose} className="ml-1 hover:opacity-70 transition-opacity">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
