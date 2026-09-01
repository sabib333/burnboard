import React, { useState, useEffect } from 'react';
import { Flame, UserPlus, Swords, Share2, ArrowRight, ArrowLeft, X, Check, Copy, CheckCircle, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/auth';

const ONBOARDING_KEY = 'burnboard_onboarding_completed';
const ONBOARDING_ROAST_COUNT_KEY = 'burnboard_onboarding_roast_count';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSubmit: () => void;
  onNavigate: (view: string) => void;
  onShowToast: (text: string, subtext?: string) => void;
  roastCount: number;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onOpenSubmit,
  onNavigate,
  onShowToast,
  roastCount,
}) => {
  const { userProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [step2Complete, setStep2Complete] = useState(false);

  // Track roast count for step 2
  useEffect(() => {
    if (roastCount >= 3) {
      setStep2Complete(true);
    }
  }, [roastCount]);

  if (!isOpen) return null;

  const profileUrl = userProfile
    ? `${window.location.origin}/u/${userProfile.username}`
    : window.location.origin;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    onShowToast('Profile Link Copied! 🔗', 'Share it on X, Discord, or anywhere');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleComplete = () => {
    // Save completion
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {}

    // Confetti blast
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff4d00', '#ff8533', '#f59e0b', '#ffffff'],
    });

    setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 90,
        origin: { y: 0.5, x: 0.3 },
        colors: ['#ff4d00', '#ff8533', '#ffffff'],
      });
    }, 300);

    setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 90,
        origin: { y: 0.5, x: 0.7 },
        colors: ['#ff4d00', '#ff8533', '#ffffff'],
      });
    }, 500);

    onShowToast('Onboarding Complete! 🔥', 'You are now a certified roaster. Welcome to BURNBOARD.');
    onClose();
  };

  const steps = [
    {
      title: 'Create Your Roast Profile',
      subtitle: 'Put yourself or someone else in the hot seat',
      icon: <UserPlus className="w-8 h-8" />,
      iconBg: 'bg-[#ff4d00]/20 text-[#ff4d00]',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            Your roast profile is what others see when they visit your page.
            It's the first step to building your roast reputation on BURNBOARD.
          </p>
          <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Choose a username & platform</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Add a bio (the roast material)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Get your personal roast page at /u/username</span>
            </div>
          </div>
        </div>
      ),
      action: {
        label: 'Create Profile',
        onClick: () => {
          onClose();
          onOpenSubmit();
        },
      },
    },
    {
      title: 'Roast 3 People',
      subtitle: 'Drop your first brutal burns',
      icon: <Swords className="w-8 h-8" />,
      iconBg: 'bg-red-500/20 text-red-400',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            The heart of BURNBOARD. Write anonymous, witty roasts for other users.
            Each roast earns you karma and builds your reputation.
          </p>
          <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-zinc-400">Progress</span>
              <span className="text-xs font-mono text-[#ff4d00] font-bold">
                {Math.min(roastCount, 3)} / 3 roasts
              </span>
            </div>
            <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#ff4d00] to-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((roastCount / 3) * 100, 100)}%` }}
              />
            </div>
            {step2Complete && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400 font-mono">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Step complete! You've roasted 3 people 🔥</span>
              </div>
            )}
          </div>
          {!step2Complete && (
            <p className="text-xs text-zinc-500 font-mono">
              Tip: Click any target in the feed and drop a roast in the input box
            </p>
          )}
        </div>
      ),
      action: step2Complete
        ? undefined
        : {
            label: 'Start Roasting',
            onClick: () => {
              onClose();
              onNavigate('feed');
            },
          },
    },
    {
      title: 'Share Your Link',
      subtitle: 'Spread the roast virus',
      icon: <Share2 className="w-8 h-8" />,
      iconBg: 'bg-purple-500/20 text-purple-400',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            Share your profile with friends, on X, Discord, or anywhere.
            The more people who join, the more brutal the roasts get.
          </p>
          <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4">
            <div className="text-[10px] text-zinc-500 uppercase font-mono mb-2">Your Profile Link</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[#111] border border-[#262626] rounded-lg px-3 py-2 text-xs text-[#ff4d00] font-mono truncate">
                {profileUrl}
              </div>
              <button
                onClick={handleCopyLink}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  copied
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-[#ff4d00] text-black hover:bg-[#ff6622]'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                const text = `Check out my roast profile on BURNBOARD! 🔥 ${profileUrl}`;
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="py-2 bg-[#111] border border-[#222] rounded-lg text-xs font-bold text-zinc-300 hover:text-white hover:border-[#333] transition-all"
            >
              𝕏 Post
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`🔥 Join me on BURNBOARD — get roasted by real humans!\n${profileUrl}`);
                onShowToast('Copied for Discord! 📋', 'Paste it in your server');
              }}
              className="py-2 bg-[#111] border border-[#222] rounded-lg text-xs font-bold text-zinc-300 hover:text-white hover:border-[#333] transition-all"
            >
              Discord
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: 'BURNBOARD', text: 'Get roasted by real humans! 🔥', url: profileUrl });
                } else {
                  handleCopyLink();
                }
              }}
              className="py-2 bg-[#111] border border-[#222] rounded-lg text-xs font-bold text-zinc-300 hover:text-white hover:border-[#333] transition-all"
            >
              Share
            </button>
          </div>
        </div>
      ),
      action: {
        label: 'Complete Onboarding',
        onClick: handleComplete,
        isFinal: true,
      },
    },
  ];

  const currentStep = steps[step];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#111] border border-[#262626] rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1 bg-[#1a1a1a]">
          <div
            className="h-full bg-gradient-to-r from-[#ff4d00] to-amber-500 transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-[#1a1a1a] transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8 space-y-5">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i <= step ? 'bg-[#ff4d00] w-8' : 'bg-[#333] w-4'
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="flex justify-center">
            <div className={`w-16 h-16 rounded-2xl ${currentStep.iconBg} flex items-center justify-center`}>
              {currentStep.icon}
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="text-center space-y-1">
            <h2 className="text-xl font-black text-white uppercase tracking-tight">
              {currentStep.title}
            </h2>
            <p className="text-xs text-zinc-400 font-mono">{currentStep.subtitle}</p>
          </div>

          {/* Content */}
          {currentStep.content}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3 pt-2">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#222] text-zinc-300 font-mono font-bold text-xs rounded-xl transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {step < steps.length - 1 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-extrabold text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(255,77,0,0.3)] active:scale-95"
                >
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : currentStep.action ? (
                <button
                  onClick={currentStep.action.onClick}
                  className={`flex items-center gap-1.5 px-5 py-2.5 font-extrabold text-xs rounded-xl transition-all active:scale-95 ${
                    currentStep.action.isFinal
                      ? 'bg-gradient-to-r from-[#ff4d00] to-amber-500 text-black shadow-[0_0_25px_rgba(255,77,0,0.5)]'
                      : 'bg-[#ff4d00] hover:bg-[#ff6622] text-black'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 fill-black" />
                  <span>{currentStep.action.label}</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Skip */}
          <div className="text-center">
            <button
              onClick={handleComplete}
              className="text-[11px] text-zinc-600 hover:text-zinc-400 font-mono transition-colors"
            >
              Skip onboarding →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Check if onboarding has been completed
 */
export function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark onboarding as completed
 */
export function completeOnboarding(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, 'true');
  } catch {}
}
