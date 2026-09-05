'use client';

/**
 * BURN BOARD — Smart Recommendations Component
 * 
 * Contextual next-best-action recommendations.
 * Privacy-conscious, dismissible, non-blocking.
 * 
 * Usage:
 * <SmartRecommendations pathname={pathname} />
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { X, ArrowRight, Flame, TrendingUp, Swords, Share2, Trophy, Globe } from 'lucide-react';
import { getNextBestActions, trackRecommendation, RECOMMENDATION_TYPE } from '@/lib/recommendations';
import { isHintDismissed, dismissHint } from '@/lib/onboarding';

// ── Recommendation Link Map ──────────────────────────────────
const LINK_MAP = {
  [RECOMMENDATION_TYPE.CREATE_HOT_SEAT]: '/hot-seat',
  [RECOMMENDATION_TYPE.SUBMIT_ROAST]: null, // Context-dependent
  [RECOMMENDATION_TYPE.VIEW_BURN_REPORT]: null, // Context-dependent
  [RECOMMENDATION_TYPE.START_BATTLE]: '/battle',
  [RECOMMENDATION_TYPE.SHARE_RESULT]: null, // Context-dependent
  [RECOMMENDATION_TYPE.EXPLORE_TRENDING]: '/discover',
  [RECOMMENDATION_TYPE.CHALLENGE_FRIEND]: null, // Opens challenge flow
  [RECOMMENDATION_TYPE.VIEW_LEADERBOARD]: '/leaderboards',
  [RECOMMENDATION_TYPE.DISCOVER_MORE]: '/discover',
};

// ── Icon Map ─────────────────────────────────────────────────
const ICON_MAP = {
  '🔥': Flame,
  '📈': TrendingUp,
  '⚔️': Swords,
  '📤': Share2,
  '📊': Trophy,
  '🎯': Flame,
  '🌍': Globe,
};

// ── Recommendation Card ──────────────────────────────────────
function RecommendationCard({ recommendation, onDismiss, onSelect }) {
  const IconComponent = ICON_MAP[recommendation.icon] || Flame;
  const link = LINK_MAP[recommendation.type];
  
  const handleClick = () => {
    trackRecommendation('selected', recommendation.type);
    onSelect?.(recommendation);
  };
  
  const handleDismiss = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const dismissKey = `dismiss_${recommendation.type}`;
    dismissHint(dismissKey);
    trackRecommendation('dismissed', recommendation.type);
    onDismiss?.(recommendation.type);
  };
  
  const content = (
    <div
      className="flex items-center gap-3 p-3 bg-[#111] border border-[#222] hover:border-[#ff4d00]/30 rounded-xl transition-all cursor-pointer group"
      onClick={handleClick}
    >
      <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center shrink-0">
        <IconComponent className="w-4 h-4 text-[#ff4d00]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white truncate">{recommendation.label}</p>
        <p className="text-[10px] text-zinc-500 truncate">{recommendation.description}</p>
      </div>
      <ArrowRight className="w-3 h-3 text-zinc-500 group-hover:text-[#ff4d00] transition-colors shrink-0" />
      <button
        onClick={handleDismiss}
        className="p-1 rounded text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
  
  if (link) {
    return (
      <Link href={link} className="block">
        {content}
      </Link>
    );
  }
  
  return content;
}

// ── Main Component ───────────────────────────────────────────
export default function SmartRecommendations({ pathname, maxVisible = 2 }) {
  const [recommendations, setRecommendations] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    
    // Get contextual recommendations
    const actions = getNextBestActions({ pathname });
    
    // Filter out dismissed recommendations
    const filtered = actions.filter(r => {
      const dismissKey = `dismiss_${r.type}`;
      return !isHintDismissed(dismissKey);
    });
    
    setRecommendations(filtered.slice(0, maxVisible));
    
    // Track shown recommendations
    for (const rec of filtered.slice(0, maxVisible)) {
      trackRecommendation('shown', rec.type);
    }
  }, [pathname, maxVisible]);
  
  const handleDismiss = useCallback((type) => {
    setDismissed(prev => new Set([...prev, type]));
    setRecommendations(prev => prev.filter(r => r.type !== type));
  }, []);
  
  const handleSelect = useCallback((recommendation) => {
    // Track completion when user navigates
    trackRecommendation('completed', recommendation.type);
  }, []);
  
  // Don't render until mounted (prevent hydration mismatch)
  if (!mounted) return null;
  
  // Filter out locally dismissed
  const visible = recommendations.filter(r => !dismissed.has(r.type));
  
  if (visible.length === 0) return null;
  
  return (
    <div className="space-y-2">
      {visible.map(rec => (
        <RecommendationCard
          key={rec.type}
          recommendation={rec}
          onDismiss={handleDismiss}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
}
