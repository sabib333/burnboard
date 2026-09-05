import React, { useState, useEffect } from 'react';
import { ArrowLeft, Flame, Share2, Copy, Check, Sparkles, MessageSquare, TrendingUp, Clock, AlertTriangle, Download, ExternalLink, Bell, BellRing, Mail, Bookmark, BarChart3, Loader2, Send } from 'lucide-react';
import { Profile, Roast } from '../types';
import { RoastItem } from '../components/RoastItem';
import { RoastInput } from '../components/RoastInput';
import { KarmaBar } from '../components/KarmaBar';
import { downloadOgImage } from '../lib/ogGenerator';
import { track } from '../lib/analytics';
import { subscribeToRoastAlerts, saveSubscription, isSubscribedToProfile } from '../lib/notifications';

interface ProfileDetailViewProps {
  profile: Profile;
  roasts: Roast[];
  onBack: () => void;
  onUpvoteRoast: (roastId: string) => void;
  onReactRoast: (roastId: string, type: 'haha' | 'brutal' | 'cry') => void;
  onSubmitRoast: (profileId: string, roastText: string, anonId: string, savageLevel?: string) => Promise<void>;
  onShareRoast: (roast: Roast) => void;
  onReportRoast: (roastId: string) => void;
  onTriggerWarning: (message: string, subtext?: string) => void;
  onShowToast: (text: string, subtext?: string) => void;
}

export const ProfileDetailView: React.FC<ProfileDetailViewProps> = ({
  profile,
  roasts,
  onBack,
  onUpvoteRoast,
  onReactRoast,
  onSubmitRoast,
  onShareRoast,
  onReportRoast,
  onTriggerWarning,
  onShowToast
}) => {
  const [sortRoastsBy, setSortRoastsBy] = useState<'upvotes' | 'brutal' | 'new'>('upvotes');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isExportingHero, setIsExportingHero] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    setIsSubscribed(isSubscribedToProfile(profile.id));
  }, [profile.id]);

  const [notifyLoading, setNotifyLoading] = useState(false);

  const handleNotifyMe = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setNotifyLoading(true);

    try {
      // Request browser notification permission if available
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
        try {
          await Notification.requestPermission();
        } catch (err) {
          console.warn('Browser notification permission request failed', err);
        }
      }

      // If email provided, subscribe via API (sends to Resend)
      if (notifyEmail && notifyEmail.includes('@')) {
        const result = await subscribeToRoastAlerts(profile.id, notifyEmail);
        if (!result.success) {
          console.warn('API subscription failed, saving locally:', result.error);
        }
      }

      // Save to localStorage for quick UI check
      saveSubscription(profile.id, notifyEmail || null, profile.username);
      setIsSubscribed(true);
      setShowNotifyModal(false);
      track('notification_subscribed', { profile_id: profile.id, hasEmail: !!notifyEmail });

      if (notifyEmail) {
        onShowToast('Email Alerts Active! 🔔', `We'll send an email to ${notifyEmail} when @${profile.username} gets roasted.`);
      } else {
        onShowToast('Notification Hook Active! 🔔', 'Bookmark this page to track live incoming burns.');
      }
    } catch {
      onShowToast('Notification Active', 'Tracking new roasts in your browser.');
    } finally {
      setNotifyLoading(false);
    }
  };

  const sortedRoasts = [...roasts].sort((a, b) => {
    if (sortRoastsBy === 'upvotes') {
      return (b.upvotes || 0) - (a.upvotes || 0);
    }
    if (sortRoastsBy === 'brutal') {
      return (b.reaction_brutal || 0) - (a.reaction_brutal || 0);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const topRoast = sortedRoasts[0];

  const handleCopyShareLink = () => {
    const link = `${window.location.origin}/#post/${profile.id}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    onShowToast('Thread Link Copied', `Direct URL for @${profile.username}'s roast chamber`);
  };

  const handleShareToTwitter = () => {
    const text = topRoast
      ? `"${topRoast.roast_text}" — Check out the roasts on @${profile.username} on BURNBOARD 🔥`
      : `Roast @${profile.username} on BURNBOARD 🔥`;
    const url = `${window.location.origin}/#post/${profile.id}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  };

  const handleShareToReddit = () => {
    const title = `BURNBOARD: Roasting @${profile.username} (${profile.platform})`;
    const url = `${window.location.origin}/#post/${profile.id}`;
    window.open(`https://www.reddit.com/submit?title=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank');
  };

  const handleDownloadHeroCard = async () => {
    setIsExportingHero(true);
    try {
      await downloadOgImage({
        template: 'roast',
        username: profile.username,
        text: topRoast?.roast_text || profile.bio,
        platform: profile.platform,
        anonId: topRoast?.anon_id || 'Anonymous Burner'
      }, `burnboard-${profile.username}-hero.png`);

      onShowToast('1080x1080 OG Card Generated! 🔥', 'High-res card saved to your device.');
    } catch (err) {
      console.error(err);
      onShowToast('Export error', 'Could not generate card');
    } finally {
      setIsExportingHero(false);
    }
  };

  const formatCount = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  return (
    <div className="space-y-6">
      {/* Navigation & Viral Share Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          id="btn-back-feed"
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#141414] hover:bg-[#1f1f1f] text-zinc-300 hover:text-white rounded-xl border border-[#262626] text-xs font-mono font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed</span>
        </button>

        {/* Viral Share Hub */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Share to X */}
          <button
            id="btn-share-x"
            onClick={handleShareToTwitter}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141414] hover:bg-[#1f1f1f] text-zinc-300 hover:text-white rounded-xl border border-[#262626] text-xs font-mono font-bold transition-colors"
            title="Share to X / Twitter"
          >
            <span>𝕏 Post</span>
          </button>

          {/* Share to Reddit */}
          <button
            id="btn-share-reddit"
            onClick={handleShareToReddit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141414] hover:bg-[#1f1f1f] text-orange-400 hover:text-orange-300 rounded-xl border border-[#262626] text-xs font-mono font-bold transition-colors"
            title="Share to Reddit"
          >
            <span>Reddit</span>
          </button>

          {/* Get Notified Button */}
          <button
            id="btn-get-notified"
            onClick={() => setShowNotifyModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all ${
              isSubscribed
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-[#141414] hover:bg-[#1f1f1f] text-zinc-300 hover:text-white border-[#262626]'
            }`}
            title="Get notified when this profile gets roasted"
          >
            {isSubscribed ? <BellRing className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> : <Bell className="w-3.5 h-3.5 text-[#ff4d00]" />}
            <span>{isSubscribed ? 'Alerts On 🔔' : 'Get Notified'}</span>
          </button>

          {/* Download 1080x1080 OG Card */}
          <button
            id="btn-download-og-hero"
            onClick={handleDownloadHeroCard}
            disabled={isExportingHero}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141414] hover:bg-[#1f1f1f] text-zinc-300 hover:text-white rounded-xl border border-[#262626] text-xs font-mono font-bold transition-colors"
            title="Download 1080x1080 Share Card"
          >
            <Download className="w-3.5 h-3.5 text-[#ff4d00]" />
            <span>{isExportingHero ? 'Saving...' : '1080p Card'}</span>
          </button>

          {/* Copy Direct Link */}
          <button
            id="btn-share-profile-link"
            onClick={handleCopyShareLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ff4d00] hover:bg-[#ff6622] text-black rounded-xl text-xs font-mono font-black transition-all shadow-md active:scale-95"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>
      </div>

      {/* Target Profile Hero Card */}
      <div className="bg-gradient-to-b from-[#14100c] to-[#111] border border-[#ff4d00]/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar Circle */}
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black shrink-0 shadow-[0_0_30px_rgba(255,77,0,0.35)] ${
              profile.avatar_color || 'bg-[#ff4d00] text-black'
            }`}
          >
            {profile.avatar_letter}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">
                @{profile.username}
              </h1>
              <span className="text-xs font-bold bg-[#ff4d00]/15 text-[#ff4d00] border border-[#ff4d00]/30 px-3 py-0.5 rounded-full uppercase tracking-wider">
                {profile.platform}
              </span>
            </div>

            <p className="text-zinc-300 text-sm sm:text-base mt-2 leading-relaxed max-w-2xl">
              {profile.bio}
            </p>

            {/* Metrics */}
            <div className="flex items-center gap-6 mt-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-[#ff4d00]" />
                <span className="text-white font-bold text-sm">{formatCount(profile.roast_count)}</span>
                <span className="text-zinc-500">total roasts</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#ff4d00] font-bold">▲</span>
                <span className="text-white font-bold text-sm">{formatCount(profile.total_upvotes)}</span>
                <span className="text-zinc-500">upvotes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Roast Input */}
        <div className="mt-6 pt-5 border-t border-[#262626]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-xs font-mono text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-[#ff4d00]" />
              <span>Drop Your Brutal Burn on @{profile.username}</span>
            </div>
            <button
              onClick={() => setShowNotifyModal(true)}
              className="text-[11px] font-mono text-[#ff4d00] hover:text-[#ff7733] hover:underline flex items-center gap-1"
            >
              <Bell className="w-3 h-3" />
              <span>Email me when roasted</span>
            </button>
          </div>
          <RoastInput
            profileId={profile.id}
            targetUsername={profile.username}
            targetPlatform={profile.platform}
            onSubmitRoast={onSubmitRoast}
            onTriggerWarning={onTriggerWarning}
          />
        </div>
      </div>

      {/* Karma Bar + Roast Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KarmaBar
          upvotes={profile.total_upvotes}
          roastsGiven={profile.roast_count}
          streak={parseInt(typeof window !== 'undefined' ? localStorage.getItem('my_roast_streak') || '3' : '3')}
        />
        <div className="bg-[#111] border border-[#222] rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>Roast Stats</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0a0a0a] rounded-xl p-2.5 border border-[#222]">
              <div className="text-[10px] text-zinc-500 font-mono">Avg Length</div>
              <div className="text-sm font-black text-white font-mono">
                {roasts.length > 0 ? Math.round(roasts.reduce((s, r) => s + r.roast_text.length, 0) / roasts.length) : 0} chars
              </div>
            </div>
            <div className="bg-[#0a0a0a] rounded-xl p-2.5 border border-[#222]">
              <div className="text-[10px] text-zinc-500 font-mono">Brutality Score</div>
              <div className="text-sm font-black text-[#ff4d00] font-mono">
                {profile.roast_count > 0 ? (profile.total_upvotes / profile.roast_count).toFixed(1) : '0.0'}
              </div>
            </div>
            <div className="bg-[#0a0a0a] rounded-xl p-2.5 border border-[#222] col-span-2">
              <div className="text-[10px] text-zinc-500 font-mono">Most Used Word</div>
              <div className="text-sm font-black text-amber-400 font-mono">
                {(() => {
                  if (roasts.length === 0) return 'N/A';
                  const words: Record<string, number> = {};
                  roasts.forEach(r => {
                    r.roast_text.toLowerCase().split(/\s+/).forEach(w => {
                      if (w.length > 3) words[w] = (words[w] || 0) + 1;
                    });
                  });
                  const top = Object.entries(words).sort((a, b) => b[1] - a[1])[0];
                  return top ? top[0] : 'N/A';
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Roasts Feed Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#ff4d00]" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              All Burns ({roasts.length})
            </h2>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-1 bg-[#111] p-1 rounded-xl border border-[#222]">
            <button
              onClick={() => setSortRoastsBy('upvotes')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                sortRoastsBy === 'upvotes'
                  ? 'bg-[#ff4d00] text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Top Upvoted
            </button>
            <button
              onClick={() => setSortRoastsBy('brutal')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                sortRoastsBy === 'brutal'
                  ? 'bg-[#ff4d00] text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Most Brutal 💀
            </button>
            <button
              onClick={() => setSortRoastsBy('new')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                sortRoastsBy === 'new'
                  ? 'bg-[#ff4d00] text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Newest
            </button>
          </div>
        </div>

        {/* List of Roasts */}
        <div className="space-y-3">
          {sortedRoasts.map(roast => (
            <RoastItem
              key={roast.id}
              roast={roast}
              targetUsername={profile.username}
              targetPlatform={profile.platform}
              onUpvote={onUpvoteRoast}
              onReact={onReactRoast}
              onShare={onShareRoast}
              onReport={onReportRoast}
              onShowToast={onShowToast}
            />
          ))}

          {sortedRoasts.length === 0 && (
            <div className="bg-[#111] border border-dashed border-[#262626] rounded-2xl p-8 text-center space-y-2">
              <div className="text-2xl">🔥</div>
              <p className="text-sm font-bold text-white">No burns recorded yet</p>
              <p className="text-xs text-zinc-400">
                Be the very first human to put @{profile.username} in their place.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Get Notified Modal */}
      {showNotifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111] border border-[#ff4d00]/40 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#ff4d00]/20 text-[#ff4d00] flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-mono">
                  Notify Me When Roasted 🔔
                </h3>
                <p className="text-xs text-zinc-400">
                  Target: @{profile.username} ({profile.platform})
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Want to know the instant fresh burns drop on this profile? Enter your email or enable browser alerts. We never spam or sell data.
            </p>

            <form onSubmit={handleNotifyMe} className="space-y-3 pt-1">
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="Enter email (optional)"
                  className="w-full bg-[#0a0a0a] border border-[#333] focus:border-[#ff4d00] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1 font-mono">
                <span>⚡ Browser permission requested</span>
                <span>100% Free & Anonymous</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNotifyModal(false)}
                  className="w-1/2 py-2.5 bg-[#1a1a1a] hover:bg-[#222] text-zinc-300 font-mono font-bold text-xs rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={notifyLoading}
                  className="w-1/2 py-2.5 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-mono font-black text-xs rounded-xl transition-all shadow active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {notifyLoading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Subscribing...</>
                  ) : notifyEmail ? (
                    <><Send className="w-3.5 h-3.5" /> Save & Notify</>
                  ) : (
                    <>Enable Alerts 🔔</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
