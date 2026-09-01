/**
 * BURNBOARD SponsorAdSlot
 *
 * Real ad slot component. Shows:
 * - Active sponsor from sponsors table if one exists
 * - Empty state: "Sponsor this spot" if no sponsors
 * - No fake ads ever
 */

import React, { useState, useEffect } from 'react';
import { ExternalLink, Mail, Flame } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface Sponsor {
  id: string;
  sponsor_name: string;
  sponsor_text: string;
  cta_link: string | null;
  image_url: string | null;
}

interface SponsorAdSlotProps {
  position: 'feed' | 'sidebar' | 'reels';
}

export const SponsorAdSlot: React.FC<SponsorAdSlotProps> = ({ position }) => {
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSponsor = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from('sponsors')
          .select('id, sponsor_name, sponsor_text, cta_link, image_url')
          .eq('active', true)
          .eq('position', position)
          .limit(1)
          .single();

        setSponsor(data);
      } catch {}
      setLoading(false);
    };

    fetchSponsor();
  }, [position]);

  // Track impression
  useEffect(() => {
    if (sponsor?.id && isSupabaseConfigured && supabase) {
      supabase.rpc('increment_impressions' as any, { sponsor_id: sponsor.id }).catch(() => {
        // Fallback: manual increment
        supabase.from('sponsors').update({ impressions: (sponsor as any).impressions + 1 }).eq('id', sponsor.id).catch(() => {});
      });
    }
  }, [sponsor?.id]);

  if (loading) return null;

  // ── Real Sponsor ───────────────────────────────────────────
  if (sponsor) {
    return (
      <div className="bg-[#0f0f0f] border border-[#222] rounded-xl p-3 my-2">
        <div className="flex items-center gap-1.5 mb-1.5">
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
                // Track click
                if (isSupabaseConfigured && supabase) {
                  supabase.from('sponsors').update({ clicks: ((sponsor as any).clicks || 0) + 1 }).eq('id', sponsor.id).catch(() => {});
                }
              }}
            >
              Learn more <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── No Sponsors — Empty State ──────────────────────────────
  return (
    <div className="bg-[#0f0f0f] border border-dashed border-[#222] rounded-xl p-4 my-2 text-center">
      <Flame className="w-5 h-5 text-zinc-600 mx-auto mb-2" />
      <p className="text-[11px] text-zinc-400 font-mono font-bold">Sponsor this spot</p>
      <p className="text-[10px] text-zinc-600 mt-1">
        10k+ eyeballs/day • $50/week
      </p>
      <a
        href="mailto:sponsor@burnboard.app?subject=Sponsor BURNBOARD"
        className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] rounded-lg text-[10px] font-mono text-zinc-400 hover:text-white transition-colors"
      >
        <Mail className="w-3 h-3" />
        Contact
      </a>
    </div>
  );
};

export default SponsorAdSlot;
