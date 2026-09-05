'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Flame, ArrowRight, Eye, X } from 'lucide-react';
import { isFirstVisit, markFirstVisit, hasSeenHero, markHeroSeen, trackActivationEvent } from '@/lib/onboarding';
import { t } from '@/lib/lang';
import { useExperiment } from '@/components/ExperimentVariant';

/**
 * HeroBanner — First-time visitor hero section.
 * Shows a clear value proposition and primary CTA.
 * Dismissible. Only shown once per browser.
 */
export default function HeroBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only show for first-time visitors who haven't seen the hero
    if (typeof window !== 'undefined') {
      const firstTime = isFirstVisit();
      const seen = hasSeenHero();
      
      if (firstTime || !seen) {
        setVisible(true);
        markFirstVisit();
        trackActivationEvent('hero_shown');
      }
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
    markHeroSeen();
    trackActivationEvent('hero_dismissed');
  };

  const handleCtaClick = () => {
    markHeroSeen();
    trackActivationEvent('hero_cta_clicked', { cta: 'put_me_on_hot_seat' });
  };

  const handleExploreClick = () => {
    markHeroSeen();
    trackActivationEvent('hero_cta_clicked', { cta: 'explore' });
  };

  if (!visible || dismissed) return null;

  return (
    <div className="relative bg-gradient-to-br from-[#1a0a00] via-[#111] to-[#0a0a0a] border-2 border-[#ff4d00]/30 rounded-3xl p-6 sm:p-8 space-y-5 shadow-[0_0_40px_rgba(255,77,0,0.12)] overflow-hidden">
      {/* Dismiss Button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-[#1a1a1a] transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Fire Emoji */}
      <div className="text-center">
        <span className="text-5xl" role="img" aria-label="fire">🔥</span>
      </div>

      {/* Headline */}
      <div className="text-center space-y-2">
        <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider leading-tight">
          {t('hero_headline')}
        </h2>
        <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
          {t('hero_subtitle')}
        </p>
      </div>

      {/* How It Works — 3 Steps */}
      <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
        <div className="text-center space-y-1.5">
          <div className="w-10 h-10 rounded-full bg-[#ff4d00]/10 border border-[#ff4d00]/30 flex items-center justify-center mx-auto">
            <span className="text-lg">📸</span>
          </div>
          <p className="text-[10px] font-mono font-bold text-zinc-300 uppercase">{t('hero_step1_title')}</p>
          <p className="text-[10px] text-zinc-500">{t('hero_step1_desc')}</p>
        </div>
        <div className="text-center space-y-1.5">
          <div className="w-10 h-10 rounded-full bg-[#ff4d00]/10 border border-[#ff4d00]/30 flex items-center justify-center mx-auto">
            <span className="text-lg"> roast</span>
          </div>
          <p className="text-[10px] font-mono font-bold text-zinc-300 uppercase">{t('hero_step2_title')}</p>
          <p className="text-[10px] text-zinc-500">{t('hero_step2_desc')}</p>
        </div>
        <div className="text-center space-y-1.5">
          <div className="w-10 h-10 rounded-full bg-[#ff4d00]/10 border border-[#ff4d00]/30 flex items-center justify-center mx-auto">
            <span className="text-lg">🔥</span>
          </div>
          <p className="text-[10px] font-mono font-bold text-zinc-300 uppercase">{t('hero_step3_title')}</p>
          <p className="text-[10px] text-zinc-500">{t('hero_step3_desc')}</p>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Link
          href="/hot-seat"
          onClick={handleCtaClick}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-black text-sm rounded-xl transition-all shadow-[0_0_25px_rgba(255,77,0,0.4)] uppercase tracking-wider w-full sm:w-auto justify-center"
        >
          <Flame className="w-4 h-4 fill-black" />
          {t('hero_cta_primary')}
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/discover"
          onClick={handleExploreClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#111] hover:bg-[#1a1a1a] border border-[#333] hover:border-[#ff4d00]/50 rounded-xl text-xs font-mono font-bold text-zinc-300 hover:text-white transition-all w-full sm:w-auto justify-center"
        >
          <Eye className="w-3.5 h-3.5 text-[#ff4d00]" />
          {t('hero_cta_secondary')}
        </Link>
      </div>
    </div>
  );
}

// ── CTA Variant Helper (for experiment) ──────────────────────
function CTAVariant({ experimentId }) {
  const { variant } = useExperiment(experimentId);
  // This component is used to track experiment exposure
  // The actual CTA text is controlled by the experiment service
  return null;
}
