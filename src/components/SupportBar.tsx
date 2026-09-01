import React, { useState, useEffect } from 'react';
import { Coffee, X, Flame, Sparkles } from 'lucide-react';
import { track } from '../lib/analytics';

export const SupportBar: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if user dismissed it during this session
    try {
      const dismissed = sessionStorage.getItem('burnboard_support_bar_dismissed');
      if (!dismissed) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem('burnboard_support_bar_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  const handleSupportClick = () => {
    track('share_clicked', { source: 'support_coffee_bar' });
    window.open('https://buymeacoffee.com', '_blank', 'noopener,noreferrer');
  };

  if (!visible) return null;

  return (
    <div
      id="support-bar"
      className="w-full bg-gradient-to-r from-[#1c0d02] via-[#2d1200] to-[#1c0d02] border-b border-[#ff4d00]/30 px-3 sm:px-4 py-2 text-xs text-white flex items-center justify-between gap-2 shadow-lg relative z-40 transition-all"
    >
      <div className="flex items-center gap-2 max-w-4xl mx-auto flex-1 justify-center text-center">
        <span className="hidden sm:inline-flex p-1 bg-[#ff4d00]/20 rounded-md text-[#ff4d00]">
          <Flame className="w-3.5 h-3.5 fill-[#ff4d00]" />
        </span>
        <span className="font-mono text-zinc-300">
          <strong className="text-white">BURNBOARD</strong> is 100% free & anonymous.{' '}
          <span className="text-zinc-400 hidden md:inline">No ads, no data mining.</span>
        </span>
        <button
          id="btn-buy-coffee-top"
          onClick={handleSupportClick}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-mono font-black text-[11px] rounded-lg transition-all shadow hover:shadow-orange-500/20 active:scale-95 ml-1"
        >
          <Coffee className="w-3 h-3" />
          <span>Buy us a coffee ☕</span>
        </button>
      </div>

      <button
        id="btn-dismiss-support-bar"
        onClick={handleDismiss}
        title="Dismiss for this session"
        className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
