/**
 * BURNBOARD AdSlot
 *
 * Real ad slot that:
 * - Checks sponsors table for active sponsor
 * - If sponsor exists: shows real sponsor content
 * - If no sponsor: shows "Sponsor this spot" with email CTA
 * - After 10 roasts: shows ad-free unlocked message
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, Mail, ShieldCheck, Flame, ExternalLink } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { track } from '../lib/analytics';

interface AdSlotProps {
  slotIndex?: number;
}

interface Sponsor {
  id: string;
  sponsor_name: string;
  sponsor_text: string;
  cta_link: string | null;
}

export const AdSlot: React.FC<AdSlotProps> = ({ slotIndex = 1 }) => {
  const [isAdFree, setIsAdFree] = useState(false);
  const [roastCount, setRoastCount] = useState(0);
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [checkedSponsor, setCheckedSponsor] = useState(false);

  useEffect(() => {
    try {
      const count = parseInt(localStorage.getItem('burnboard_user_roast_count') || '0', 10);
      setRoastCount(count);
      if (count >= 10) setIsAdFree(true);
    } catch {}
  }, []);

  // Check for real sponsors
  useEffect(() => {
    const checkSponsor = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setCheckedSponsor(true);
        return;
      }
      try {
        const { data } = await supabase
          .from('sponsors')
          .select('id, sponsor_name, sponsor_text, cta_link')
          .eq('active', true)
          .limit(1)
          .single();
        if (data) setSponsor(data);
      } catch {}
      setCheckedSponsor(true);
    };
    checkSponsor();
  }, []);

  if (isAdFree) {
    return (
      <div className="bg-[#121212] border border-[#222] rounded-2xl p-3.5 flex items-center justify-between text-xs text-zinc-400 font-mono">
        <div className="flex items-center gap-2 text-emerald-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-bold">Ad-Free Perks Unlocked ({roastCount} Roasts)</span>
        </div>
        <span className="text-[10px] text-zinc-500">Thank you for burning responsibly 🔥</span>
      </div>
    );
  }

  // ── Real Sponsor Active ──────────────────────────────────
  if (sponsor) {
    return (
      <div className="bg-[#0f0f0f] border border-[#222] rounded-2xl p-4 my-1">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">Sponsored</span>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed">{sponsor.sponsor_text}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] font-mono text-zinc-500">{sponsor.sponsor_name}</span>
          {sponsor.cta_link && (
            <a
              href={sponsor.cta_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-mono text-[#ff4d00] hover:underline"
              onClick={() => {
                if (isSupabaseConfigured && supabase) {
                  Promise.resolve(supabase.from('sponsors').update({ clicks: 0 }).eq('id', sponsor.id)).catch(() => {});
                }
                track('ad_clicked', { slotIndex, sponsorId: sponsor.id });
              }}
            >
              Learn more <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── No Sponsor — Claim Slot ──────────────────────────────
  const handleClaimClick = () => {
    track('ad_clicked', { slotIndex });
    const subject = encodeURIComponent('BURNBOARD Ad Placement Inquiry');
    const body = encodeURIComponent(
      'Hi BURNBOARD Team,\n\nI would like to sponsor a slot on BURNBOARD.\n\nMy Brand / Project:\nTarget Link:\nDesired Tagline:\n'
    );
    window.location.href = `mailto:sponsor@burnboard.app?subject=${subject}&body=${body}`;
  };

  return (
    <div
      id={`ad-slot-${slotIndex}`}
      onClick={handleClaimClick}
      className="cursor-pointer group relative overflow-hidden bg-gradient-to-r from-[#141414] via-[#1a1410] to-[#141414] border-2 border-dashed border-[#ff4d00]/40 hover:border-[#ff4d00] rounded-2xl p-4 sm:p-5 transition-all duration-300 shadow-md hover:shadow-orange-500/10 active:scale-[0.99]"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#ff4d00]/20 text-[#ff4d00] font-mono text-[10px] font-black uppercase tracking-wider">
              Sponsor this spot
            </span>
          </div>
          <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-[#ff4d00] transition-colors flex items-center gap-1.5">
            <span>10k+ eyeballs/day • $50/week</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400 opacity-80" />
          </h4>
          <p className="text-xs text-zinc-400 font-sans max-w-md">
            Reach thousands of tech founders, roasted creators, and comedy writers daily.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ff4d00] group-hover:bg-[#ff6622] text-black font-mono font-black text-xs rounded-xl shadow transition-colors shrink-0">
          <Mail className="w-3.5 h-3.5" />
          <span>Contact</span>
        </span>
      </div>
    </div>
  );
};
