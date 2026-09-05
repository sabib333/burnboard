import React, { useState, useEffect } from 'react';
import { Flame, Share2, Copy, Clock, Users, ArrowLeft, Zap } from 'lucide-react';
import { Profile, Roast } from '../types';
import { RoastItem } from '../components/RoastItem';
import { RoastInput } from '../components/RoastInput';
import { generateHotSeatToken, getHotSeatShareUrl } from '../lib/hotSeat';
import { useAuth } from '../lib/auth';

interface HotSeatViewProps {
  profile: Profile;
  roasts: Roast[];
  onBack: () => void;
  onSubmitRoast: (profileId: string, roastText: string, anonId: string, savageLevel?: string) => Promise<void>;
  onUpvoteRoast: (roastId: string) => void;
  onReactRoast: (roastId: string, type: 'haha' | 'brutal' | 'cry') => void;
  onShareRoast: (roast: Roast) => void;
  onReportRoast: (roastId: string) => void;
  onTriggerWarning: (msg: string, sub?: string) => void;
  onShowToast: (text: string, sub?: string) => void;
}

export function HotSeatView({
  profile,
  roasts,
  onBack,
  onSubmitRoast,
  onUpvoteRoast,
  onReactRoast,
  onShareRoast,
  onReportRoast,
  onTriggerWarning,
  onShowToast,
}: HotSeatViewProps) {
  const { user } = useAuth();
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const isOwner = user?.id === profile.user_id;
  const roastCount = roasts.length;
  const totalUpvotes = roasts.reduce((sum, r) => sum + (r.upvotes || 0), 0);

  const handleGenerateLink = async () => {
    setGenerating(true);
    const token = await generateHotSeatToken(profile.id);
    if (token) {
      setShareUrl(getHotSeatShareUrl(token));
      onShowToast('🔥 Hot Seat Link Generated!', 'Share this link to get roasted.');
    } else {
      onTriggerWarning('Failed to generate link', 'Please try again.');
    }
    setGenerating(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      onShowToast('📋 Link Copied!', 'Share it on social media.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onTriggerWarning('Copy failed', 'Please copy manually.');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `🔥 @${profile.username} is in the Hot Seat!`,
          text: `Come roast @${profile.username} on BURNBOARD! No AI. Just humans.`,
          url: shareUrl,
        });
      } catch {}
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="p-2 bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
          <h1 className="text-lg font-black text-white uppercase font-mono">HOT SEAT</h1>
        </div>
      </div>

      {/* Hot Seat Card */}
      <div className="bg-gradient-to-br from-[#1a0a00] to-[#111] border-2 border-amber-500/50 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#ff4d00]/10 rounded-full blur-2xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black shadow-[0_0_30px_rgba(255,77,0,0.4)] ${profile.avatar_color || 'bg-[#ff4d00] text-black'}`}>
              {profile.avatar_letter}
            </div>
            <div>
              <h2 className="text-xl font-black text-white">@{profile.username}</h2>
              <p className="text-sm text-amber-400 font-mono">{profile.platform} Target</p>
            </div>
          </div>

          <p className="text-zinc-300 text-sm mb-4">{profile.bio}</p>

          <div className="flex items-center gap-6 text-xs font-mono text-zinc-400">
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-[#ff4d00]" />
              <span className="text-white font-bold">{roastCount}</span>
              <span>roasts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-bold">▲ {totalUpvotes}</span>
              <span>upvotes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Hot Seat Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Share Section (Owner Only) */}
      {isOwner && (
        <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
          <h3 className="text-sm font-black text-white uppercase mb-3 flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[#ff4d00]" />
            Share Your Hot Seat Link
          </h3>

          {!shareUrl ? (
            <button
              onClick={handleGenerateLink}
              disabled={generating}
              className="w-full px-4 py-3 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-black font-mono text-sm uppercase rounded-xl transition-all disabled:opacity-50"
            >
              {generating ? 'Generating...' : '🔥 Generate Share Link'}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-[#0a0a0a] border border-[#222] rounded-xl px-3 py-2 text-xs font-mono text-zinc-300"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-2 bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] rounded-xl transition-colors"
                >
                  <Copy className="w-4 h-4 text-zinc-400" />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleNativeShare}
                  className="flex-1 px-3 py-2 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-bold text-xs rounded-xl transition-colors"
                >
                  📤 Share
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex-1 px-3 py-2 bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-zinc-300 font-bold text-xs rounded-xl transition-colors"
                >
                  {copied ? '✅ Copied!' : '📋 Copy Link'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Roast Input */}
      <RoastInput
        profileId={profile.id}
        onSubmit={onSubmitRoast}
        onTriggerWarning={onTriggerWarning}
      />

      {/* Roasts List */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
          <Flame className="w-4 h-4 text-[#ff4d00]" />
          {roastCount} Roast{roastCount !== 1 ? 's' : ''}
        </h3>
        {roasts.length === 0 ? (
          <div className="text-center py-8 bg-[#111] border border-dashed border-[#222] rounded-2xl">
            <Zap className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">No roasts yet! Be the first to roast this target.</p>
          </div>
        ) : (
          roasts.map(roast => (
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
          ))
        )}
      </div>
    </div>
  );
}
