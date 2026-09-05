import React, { useState } from 'react';
import { ArrowLeft, Flame, Sparkles, Filter, TrendingUp, ExternalLink, Skull, ShieldCheck } from 'lucide-react';
import { Profile, Roast } from '../types';
import { ProfileCard } from '../components/ProfileCard';
import { AdSlot } from '../components/AdSlot';
import { track } from '../lib/analytics';

interface PlatformSeoViewProps {
  platform: string;
  profiles: Profile[];
  roasts: Roast[];
  onBack: () => void;
  onSelectProfile: (id: string) => void;
  onOpenSubmit: () => void;
  onUpvoteRoast: (roastId: string) => void;
  onReactRoast: (roastId: string, reaction: 'haha' | 'brutal' | 'cry') => void;
  onSubmitRoast: (profileId: string, text: string, anonId: string, savageLevel?: string) => Promise<void>;
  onShareRoast: (roast: Roast) => void;
  onReportRoast: (roastId: string) => void;
  onTriggerWarning: (message: string, subtext?: string) => void;
}

const PLATFORM_INFO: Record<string, {
  name: string;
  title: string;
  subtitle: string;
  keywords: string[];
  description: string;
}> = {
  linkedin: {
    name: 'LinkedIn',
    title: 'Best LinkedIn Roasts — BURNBOARD',
    subtitle: 'Top brutal LinkedIn roasts by real humans.',
    keywords: ['Corporate Sycophancy', 'Thought Leaders', 'Humblebrags', 'LinkedIn Lunatics', 'AI Bro Hustle'],
    description: 'Corporate buzzwords, hollow thought leadership, and sycophantic hustle culture demolished by sharp anonymous writers.'
  },
  github: {
    name: 'GitHub',
    title: 'Best GitHub Roasts — BURNBOARD',
    subtitle: 'Top brutal GitHub roasts by real humans.',
    keywords: ['10x Engineers', 'Green Squares', 'Unfinished Projects', 'CSS Centering', 'Vim Elitists'],
    description: 'Abandoned side projects, green-square commit farmers, and rockstar developer delusions roasted with zero mercy.'
  },
  x: {
    name: 'X (Twitter)',
    title: 'Best X / Twitter Roasts — BURNBOARD',
    subtitle: 'Top brutal X / Twitter roasts by real humans.',
    keywords: ['Engagement Bait', 'Thread Boys', 'Hot Takes', 'Ratio Kings', 'Crypto Gurus'],
    description: 'Engagement baiters, 20-tweet masterclasses, and hot-take reply guys held strictly accountable.'
  },
  instagram: {
    name: 'Instagram',
    title: 'Best Instagram Roasts — BURNBOARD',
    subtitle: 'Top brutal Instagram roasts by real humans.',
    keywords: ['Filtered Delusion', 'Gym Soliloquies', 'Fake Wealth', 'Aesthetic Life', 'Course Sellers'],
    description: 'Over-filtered lifestyles, rented supercar flexes, and motivational caption poetry incinerated.'
  }
};

export const PlatformSeoView: React.FC<PlatformSeoViewProps> = ({
  platform,
  profiles,
  roasts,
  onBack,
  onSelectProfile,
  onOpenSubmit,
  onUpvoteRoast,
  onReactRoast,
  onSubmitRoast,
  onShareRoast,
  onReportRoast,
  onTriggerWarning
}) => {
  const normKey = platform.toLowerCase().replace(/[^a-z]/g, '');
  const info = PLATFORM_INFO[normKey] || {
    name: platform,
    title: `Best ${platform} Roasts — BURNBOARD`,
    subtitle: `Top brutal ${platform} roasts by real humans.`,
    keywords: [`${platform} Comedy`, 'Anonymous Burns', 'Social Media Roasts'],
    description: `All community roasts and target profiles from ${platform}.`
  };

  // Filter profiles by this platform
  const filteredProfiles = profiles.filter(p => {
    const pNorm = p.platform.toLowerCase().replace(/[^a-z]/g, '');
    if (normKey === 'x') {
      return pNorm === 'x' || pNorm === 'twitter';
    }
    return pNorm === normKey || p.platform.toLowerCase().includes(normKey);
  });

  const totalRoastsForPlatform = filteredProfiles.reduce((acc, p) => acc + (p.roast_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Back Button & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <button
          id="btn-back-from-seo"
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#141414] hover:bg-[#1f1f1f] text-zinc-300 hover:text-white rounded-xl border border-[#262626] text-xs font-mono font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Global Feed</span>
        </button>

        <span className="text-[11px] font-mono text-zinc-500">
          Canonical: /roast/{normKey}
        </span>
      </div>

      {/* SEO Hero Header (H1 + H2) */}
      <header className="bg-gradient-to-b from-[#141414] to-[#0d0d0d] border border-[#262626] rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 bg-[#ff4d00]/15 border border-[#ff4d00]/40 text-[#ff4d00] font-mono font-black text-xs uppercase tracking-wider rounded-lg">
            🔥 {info.name} Roast Arena
          </span>
          <span className="text-zinc-500 text-xs font-mono">
            {filteredProfiles.length} Active Targets • {totalRoastsForPlatform} Human Burns
          </span>
        </div>

        {/* H1 SEO Title */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight font-sans">
          {info.title}
        </h1>

        {/* H2 SEO Subtitle */}
        <h2 className="text-sm sm:text-base text-zinc-300 font-sans leading-relaxed max-w-3xl">
          {info.subtitle} {info.description}
        </h2>

        {/* Keyword Pills */}
        <div className="pt-2 flex flex-wrap gap-1.5">
          {info.keywords.map((kw, i) => (
            <span
              key={i}
              className="px-2.5 py-1 bg-[#1a1a1a] text-zinc-400 border border-[#333] rounded-md font-mono text-[11px] select-none"
            >
              #{kw}
            </span>
          ))}
        </div>
      </header>

      {/* Profile Feed For This Platform */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-[#ff4d00]" />
            <span>Target Profiles in {info.name} ({filteredProfiles.length})</span>
          </h3>

          <button
            onClick={onOpenSubmit}
            className="px-3 py-1.5 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-mono font-black text-xs rounded-xl transition-all shadow"
          >
            + Add {info.name} Target
          </button>
        </div>

        {filteredProfiles.map((profile, idx) => {
          const profileRoasts = roasts.filter(r => r.profile_id === profile.id);
          return (
            <React.Fragment key={profile.id}>
              <ProfileCard
                profile={profile}
                roasts={profileRoasts}
                onSelectProfile={onSelectProfile}
                onUpvoteRoast={onUpvoteRoast}
                onReactRoast={onReactRoast}
                onSubmitRoast={onSubmitRoast}
                onShareRoast={onShareRoast}
                onReportRoast={onReportRoast}
                onTriggerWarning={onTriggerWarning}
              />
              {/* Ad slot after 2nd profile in SEO views */}
              {idx === 1 && <AdSlot slotIndex={idx + 1} />}
            </React.Fragment>
          );
        })}

        {filteredProfiles.length === 0 && (
          <div className="bg-[#111] border border-dashed border-[#333] rounded-2xl p-10 text-center space-y-4">
            <div className="text-3xl">🔥</div>
            <h4 className="text-base font-bold text-white uppercase tracking-wider">
              No {info.name} targets yet
            </h4>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Be the first to submit a profile from {info.name} for roasting!
            </p>
            <button
              onClick={onOpenSubmit}
              className="px-5 py-2.5 bg-[#ff4d00] text-black font-mono font-black text-xs uppercase rounded-xl hover:bg-[#ff6622] transition-colors"
            >
              Add {info.name} Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
