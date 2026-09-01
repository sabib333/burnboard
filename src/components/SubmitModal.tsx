import React, { useState } from 'react';
import { X, Flame, Sparkles, User, FileText, ArrowRight, LogIn } from 'lucide-react';
import { checkBadWords } from '../lib/badWords';
import { useAuth } from '../lib/auth';

interface SubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { username: string; platform: string; bio: string }) => Promise<string>;
  onTriggerWarning: (msg: string, sub?: string) => void;
}

export const SubmitModal: React.FC<SubmitModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onTriggerWarning
}) => {
  const { user, userProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [platform, setPlatform] = useState('X');
  const [bio, setBio] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const platforms = [
    { value: 'X', label: 'X / Twitter' },
    { value: 'LinkedIn', label: 'LinkedIn Thought Leader' },
    { value: 'GitHub', label: 'GitHub 10x Developer' },
    { value: 'Instagram', label: 'Instagram Influencer' },
    { value: 'Indie Hacker', label: 'Indie Hacker / SaaS' },
    { value: 'TikTok', label: 'TikTok Creator' },
    { value: 'Reddit', label: 'Reddit Mod / Redditor' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().replace(/^@/, '');
    const cleanBio = bio.trim();

    if (!cleanUsername) {
      onTriggerWarning('Username Required', 'Enter a valid handle or name to be roasted');
      return;
    }

    if (!cleanBio) {
      onTriggerWarning('Bio Required', 'Add some ammo: their quirks, bio, or claims');
      return;
    }

    // Profanity check on bio
    const { hasBadWords, foundWords } = checkBadWords(cleanBio);
    if (hasBadWords) {
      onTriggerWarning('Keep it brutal but clean', `Remove profanity (${foundWords.join(', ')}).`);
      return;
    }

    setIsSubmitting(true);
    try {
      const profileId = await onSubmit({
        username: cleanUsername,
        platform,
        bio: cleanBio
      });
      setUsername('');
      setBio('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const avatarLetter = (username.trim().charAt(0) || '?').toUpperCase();

  return (
    <div
      id="modal-submit-profile"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#111] border border-[#262626] rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#222]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ff4d00] flex items-center justify-center">
              <Flame className="w-5 h-5 text-black fill-black" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                Put Someone in the Hot Seat
              </h2>
              <p className="text-xs text-zinc-400">
                {user ? `Logged in as @${userProfile?.username || user.email}` : '3 simple fields. Anonymous submissions welcome.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Field 1: Username */}
          <div>
            <label className="block text-xs font-bold font-mono text-zinc-300 uppercase tracking-wider mb-1.5">
              1. Handle or Name
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">@</span>
              <input
                type="text"
                id="input-submit-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="elonmusk or TechRecruiter"
                required
                maxLength={40}
                className="w-full bg-[#161616] border border-[#2b2b2b] rounded-xl pl-8 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff4d00] focus:ring-1 focus:ring-[#ff4d00]"
              />
            </div>
          </div>

          {/* Field 2: Platform */}
          <div>
            <label className="block text-xs font-bold font-mono text-zinc-300 uppercase tracking-wider mb-1.5">
              2. Platform / Archetype
            </label>
            <select
              id="select-submit-platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full bg-[#161616] border border-[#2b2b2b] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff4d00] focus:ring-1 focus:ring-[#ff4d00]"
            >
              {platforms.map(p => (
                <option key={p.value} value={p.value} className="bg-[#161616] text-white">
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Field 3: Bio Textarea */}
          <div>
            <label className="block text-xs font-bold font-mono text-zinc-300 uppercase tracking-wider mb-1.5">
              3. Bio / Roast Material
            </label>
            <textarea
              id="textarea-submit-bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What do they brag about? Their bio taglines, weird flexes, or habits..."
              required
              maxLength={240}
              className="w-full bg-[#161616] border border-[#2b2b2b] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff4d00] focus:ring-1 focus:ring-[#ff4d00] resize-none"
            />
            <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 mt-1">
              <span>Ammo for human roasters</span>
              <span>{240 - bio.length} chars left</span>
            </div>
          </div>

          {/* Preview Snapshot */}
          <div className="bg-[#0c0c0c] border border-[#222] rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#ff4d00] text-black font-black flex items-center justify-center text-lg">
              {avatarLetter}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">
                @{username.trim() || 'handle'}
              </div>
              <div className="text-[10px] text-[#ff4d00] font-mono">
                {platform} • 0 burns yet
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2 space-y-2">
            {!user && (
              <a
                href="#auth"
                onClick={(e) => { e.preventDefault(); onClose(); window.location.hash = '#auth'; }}
                className="w-full py-2.5 bg-[#141414] hover:bg-[#1a1a1a] border border-[#262626] text-zinc-300 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs"
              >
                <LogIn className="w-3.5 h-3.5 text-[#ff4d00]" />
                <span>Create Account to Track Your Submissions</span>
              </a>
            )}
            <button
              type="submit"
              id="btn-submit-profile-confirm"
              disabled={isSubmitting || !username.trim() || !bio.trim()}
              className="w-full py-3 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(255,77,0,0.4)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-98"
            >
              <Flame className="w-4 h-4 text-black fill-black" />
              <span>{isSubmitting ? 'Igniting...' : user ? 'Enter the Hot Seat' : 'Submit as Anonymous'}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
