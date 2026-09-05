'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Mail, ShieldCheck } from 'lucide-react';
import { track } from '../lib/analytics';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function AdSlot({ slotIndex = 1 }) {
  const [isAdFree, setIsAdFree] = useState(false);
  const [roastCount, setRoastCount] = useState(0);
  const [profileCount, setProfileCount] = useState(0);

  useEffect(() => {
    try {
      const count = parseInt(localStorage.getItem('burnboard_user_roast_count') || '0', 10);
      setRoastCount(count);
      if (count >= 10) {
        setIsAdFree(true);
      }
    } catch (e) {}

    // Fetch real profile count
    if (isSupabaseConfigured && supabase) {
      supabase.from('profiles').select('id', { count: 'exact', head: true })
        .then(({ count }) => setProfileCount(count || 0))
        .catch(() => {});
    }

    // Ad impression (MP24, Section 87): real, disclosed inventory — recorded
    // once per mount, never fabricated.
    track('ad_impression', { slotIndex });
  }, [slotIndex]);

  if (isAdFree) {
    return (
      <div className="bg-[#121212] border border-[#222] rounded-2xl p-3.5 flex items-center justify-between text-xs text-zinc-400 font-mono">
        <div className="flex items-center gap-2 text-emerald-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-bold">Ad-Free Perks Unlocked ({roastCount} Roasts Submitted)</span>
        </div>
        <span className="text-[10px] text-zinc-500">Ad slot disabled 🔥</span>
      </div>
    );
  }

  const handleAdClick = () => {
    track('ad_clicked', { slotIndex });
    const email = 'sabibahamed74@gmail.com';
    const subject = encodeURIComponent(`Ad on BURNBOARD - ${profileCount} real users`);
    const body = encodeURIComponent(
      `Hi BURNBOARD Team,\n\nI would like to sponsor a slot on BURNBOARD ($10/week).\n\nCurrent real users: ${profileCount}\n\nMy Brand / Project:\nTarget Link:\nDesired Tagline:\n`
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return (
    <div
      id={`ad-slot-${slotIndex}`}
      onClick={handleAdClick}
      className="cursor-pointer group relative overflow-hidden bg-gradient-to-r from-[#141414] via-[#1a1410] to-[#141414] border-2 border-dashed border-[#ff4d00]/40 hover:border-[#ff4d00] rounded-2xl p-4 sm:p-5 transition-all duration-300 shadow-md hover:shadow-orange-500/10 active:scale-[0.99]"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#ff4d00]/20 text-[#ff4d00] font-mono text-[10px] font-black uppercase tracking-wider">
              Sponsored Slot
            </span>
            <span className="text-zinc-500 text-xs font-mono">Slot #{slotIndex}</span>
          </div>
          <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-[#ff4d00] transition-colors flex items-center gap-1.5">
            <span>Your Ad Here — $10 / week</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400 opacity-80" />
          </h4>
          <p className="text-xs text-zinc-400 font-sans max-w-md">
            {profileCount > 0
              ? `${profileCount} real profiles live on BurnBoard today. No fabricated reach — just real, disclosed placement.`
              : 'Be the first brand on BurnBoard. Real profile counts are shown here as the platform grows — never invented.'}
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
          <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ff4d00] group-hover:bg-[#ff6622] text-black font-mono font-black text-xs rounded-xl shadow transition-colors">
            <Mail className="w-3.5 h-3.5" />
            <span>Claim Slot</span>
          </span>
        </div>
      </div>
    </div>
  );
}
