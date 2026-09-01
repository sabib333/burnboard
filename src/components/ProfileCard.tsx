import React from 'react';
import { Flame, MessageSquare, ArrowUpRight, Share2, Sparkles } from 'lucide-react';
import { Profile, Roast } from '../types';
import { RoastItem } from './RoastItem';
import { RoastInput } from './RoastInput';

interface ProfileCardProps {
  profile: Profile;
  roasts: Roast[];
  onOpenProfile: (profileId: string) => void;
  onUpvoteRoast: (roastId: string) => void;
  onReactRoast: (roastId: string, type: 'haha' | 'brutal' | 'cry') => void;
  onSubmitRoast: (profileId: string, roastText: string, anonId: string) => Promise<void>;
  onShareRoast: (roast: Roast) => void;
  onReportRoast: (roastId: string) => void;
  onTriggerWarning: (message: string, subtext?: string) => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  roasts,
  onOpenProfile,
  onUpvoteRoast,
  onReactRoast,
  onSubmitRoast,
  onShareRoast,
  onReportRoast,
  onTriggerWarning
}) => {
  const getPlatformBadgeStyle = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'x':
      case 'x / twitter':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'linkedin':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      case 'github':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'instagram':
        return 'bg-pink-500/15 text-pink-400 border-pink-500/30';
      case 'indie hacker':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      default:
        return 'bg-[#ff4d00]/15 text-[#ff4d00] border-[#ff4d00]/30';
    }
  };

  // Show first 3 roasts in feed, with view more button if more exist
  const displayedRoasts = roasts.slice(0, 3);
  const remainingCount = roasts.length - displayedRoasts.length;

  const formatCount = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  return (
    <article
      id={`feed-card-${profile.id}`}
      className={`bg-[#111] rounded-2xl p-4 sm:p-5 shadow-2xl transition-all duration-200 relative ${
        profile.featured
          ? 'border-2 border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.18)] ring-1 ring-amber-500/30'
          : 'border border-[#222] hover:border-[#2d2d2d]'
      }`}
    >
      {/* Featured Badge */}
      {profile.featured && (
        <div className="absolute -top-3 right-5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-lg flex items-center gap-1 tracking-wider">
          <Sparkles className="w-3 h-3 fill-black" />
          <span>Featured Target</span>
        </div>
      )}

      {/* Profile Header */}
      <div className="flex items-start gap-3.5 mb-4">
        {/* Avatar Letter */}
        <div
          onClick={() => onOpenProfile(profile.id)}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-black shrink-0 cursor-pointer shadow-[0_0_20px_rgba(255,77,0,0.25)] hover:scale-105 transition-transform ${
            profile.avatar_color || 'bg-[#ff4d00] text-black'
          }`}
        >
          {profile.avatar_letter}
        </div>

        {/* Info & Stats */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <h3
                onClick={() => onOpenProfile(profile.id)}
                className="font-bold text-white text-base hover:text-[#ff4d00] transition-colors cursor-pointer truncate"
              >
                @{profile.username}
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getPlatformBadgeStyle(
                  profile.platform
                )}`}
              >
                {profile.tagline || profile.platform}
              </span>
            </div>

            {/* View full thread button */}
            <button
              onClick={() => onOpenProfile(profile.id)}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 font-mono transition-colors"
            >
              <span>Thread</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-zinc-300 text-sm mt-1.5 leading-relaxed">
            {profile.bio}
          </p>

          {/* Metrics */}
          <div className="flex items-center gap-4 mt-2.5 text-xs font-mono text-zinc-500">
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-[#ff4d00]" />
              <span className="text-zinc-300 font-bold">{formatCount(profile.roast_count)}</span>
              <span>roasts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-300 font-bold">▲ {formatCount(profile.total_upvotes)}</span>
              <span>upvotes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Roast Thread Section */}
      <div className="space-y-3 sm:pl-14 sm:border-l sm:border-[#222] sm:ml-6 mt-4">
        {displayedRoasts.map(roast => (
          <RoastItem
            key={roast.id}
            roast={roast}
            targetUsername={profile.username}
            targetPlatform={profile.platform}
            onUpvote={onUpvoteRoast}
            onReact={onReactRoast}
            onShare={onShareRoast}
            onReport={onReportRoast}
          />
        ))}

        {remainingCount > 0 && (
          <button
            onClick={() => onOpenProfile(profile.id)}
            className="w-full py-2 bg-[#161616] hover:bg-[#1c1c1c] text-xs font-mono font-bold text-zinc-400 hover:text-white rounded-xl border border-[#262626] transition-all flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#ff4d00]" />
            <span>View {remainingCount} more brutal burns on @{profile.username}</span>
          </button>
        )}

        {displayedRoasts.length === 0 && (
          <div className="p-4 bg-[#0a0a0a] rounded-xl border border-dashed border-[#222] text-center text-xs text-zinc-500">
            No burns yet! Be the first human to roast @{profile.username}.
          </div>
        )}

        {/* Inline Roast Input */}
        <RoastInput
          profileId={profile.id}
          targetUsername={profile.username}
          targetPlatform={profile.platform}
          onSubmitRoast={onSubmitRoast}
          onTriggerWarning={onTriggerWarning}
        />
      </div>
    </article>
  );
};
