'use client';

import React, { useState, useEffect } from 'react';
import { Coffee, X, Flame } from 'lucide-react';
import { track } from '../lib/analytics';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function SupportBar() {
  const [visible, setVisible] = useState(false);
  const [profileCount, setProfileCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const dismissed = sessionStorage.getItem('burnboard_support_bar_dismissed');
        if (dismissed) return;

        if (isSupabaseConfigured && supabase) {
          const { count } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true });
          setProfileCount(count || 0);
          if ((count || 0) > 5) {
            setVisible(true);
          }
        }
      } catch (e) {}
    };
    fetchCount();
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem('burnboard_support_bar_dismissed', 'true');
    } catch (e) {}
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
          <strong className="text-white">{profileCount} people already roasted.</strong> BURNBOARD is free & anonymous. Buy us a coffee to keep it brutal ☕
        </span>
        <button
          id="btn-buy-coffee-top"
          onClick={handleSupportClick}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-mono font-black text-[11px] rounded-lg transition-all shadow active:scale-95 ml-1"
        >
          <Coffee className="w-3 h-3" />
          <span>Support ☕</span>
        </button>
      </div>

      <button
        onClick={handleDismiss}
        className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
