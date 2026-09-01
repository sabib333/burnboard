import React, { useState } from 'react';
import { Flame, Share2, Copy, Check, X, Sparkles, MessageCircle } from 'lucide-react';
import { track } from '../lib/analytics';

interface RoastInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUsername?: string;
  onShowToast: (title: string, msg: string) => void;
}

export const RoastInviteModal: React.FC<RoastInviteModalProps> = ({
  isOpen,
  onClose,
  targetUsername = 'a target',
  onShowToast
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://burnboard.app';
  const shareText = `I just dropped a brutal burn on @${targetUsername} on BURNBOARD 🔥 Dare to roast them back?`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    track('share_clicked', { medium: 'clipboard_invite', targetUsername });
    onShowToast('Invite Link Copied! 📋', 'Share with your funniest friends.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareX = () => {
    track('share_clicked', { medium: 'twitter_invite', targetUsername });
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(appUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShareWhatsApp = () => {
    track('share_clicked', { medium: 'whatsapp_invite', targetUsername });
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${appUrl}`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#111] border border-[#ff4d00]/50 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative space-y-5 animate-scale-up">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-[#ff4d00] rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-orange-500/30 text-black">
            <Flame className="w-8 h-8 fill-black" />
          </div>
          <h3 className="text-xl font-extrabold text-white tracking-tight">
            🔥 That was brutal!
          </h3>
          <p className="text-xs text-zinc-300">
            Invite 2 friends to roast <strong className="text-white">@{targetUsername}</strong> back or challenge you in the arena.
          </p>
        </div>

        {/* Share Action Grid */}
        <div className="space-y-2.5 pt-1">
          {/* Share to X */}
          <button
            id="btn-invite-x"
            onClick={handleShareX}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-[#1a1a1a] hover:bg-[#262626] border border-[#333] hover:border-[#ff4d00]/50 text-white rounded-xl font-mono font-bold text-xs transition-all active:scale-98"
          >
            <span>Share Roast Challenge on 𝕏</span>
          </button>

          {/* Share to WhatsApp */}
          <button
            id="btn-invite-whatsapp"
            onClick={handleShareWhatsApp}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-[#075e54]/30 hover:bg-[#075e54]/50 border border-[#128c7e]/50 text-emerald-300 rounded-xl font-mono font-bold text-xs transition-all active:scale-98"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Invite via WhatsApp</span>
          </button>

          {/* Copy Link */}
          <button
            id="btn-invite-copy-link"
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-[#ff4d00] hover:bg-[#ff6622] text-black rounded-xl font-mono font-black text-xs transition-all active:scale-98 shadow-md"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Link Copied!' : 'Copy Direct Challenge Link'}</span>
          </button>
        </div>

        <div className="text-center">
          <button
            onClick={onClose}
            className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Skip & continue browsing
          </button>
        </div>
      </div>
    </div>
  );
};
