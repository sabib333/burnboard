'use client';

import React, { useState, useEffect } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { isHintDismissed, dismissHint, trackActivationEvent } from '@/lib/onboarding';

/**
 * OnboardingHint — Contextual hint shown to first-time users.
 * Dismissible. Only shown once per hint ID.
 * 
 * Props:
 *   - id: Unique hint identifier (required)
 *   - children: Hint content
 *   - position: 'top' | 'bottom' (default: 'bottom')
 */
export default function OnboardingHint({ id, children, position = 'bottom' }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && id) {
      const dismissed = isHintDismissed(id);
      if (!dismissed) {
        // Small delay to not overwhelm on page load
        const timer = setTimeout(() => setVisible(true), 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [id]);

  const handleDismiss = () => {
    setVisible(false);
    dismissHint(id);
    trackActivationEvent('hint_dismissed', { hint_id: id });
  };

  if (!visible) return null;

  return (
    <div className={`relative bg-[#111] border border-[#ff4d00]/30 rounded-xl p-3 flex items-start gap-2.5 shadow-[0_0_15px_rgba(255,77,0,0.08)] ${
      position === 'top' ? 'mb-3' : 'mt-3'
    }`}>
      <Lightbulb className="w-4 h-4 text-[#ff4d00] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-zinc-300 leading-relaxed">
          {children}
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-1 rounded text-zinc-500 hover:text-white transition-colors"
        aria-label="Dismiss hint"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
