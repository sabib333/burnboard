import React, { useState, useEffect } from 'react';
import { Star, X, Flame } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

const RATE_APP_KEY = 'burnboard_rated_app';
const RATE_APP_THRESHOLD = 5; // Show after 5 roasts

interface RateAppModalProps {
  onShowToast?: (text: string, subtext?: string) => void;
}

export const RateAppModal: React.FC<RateAppModalProps> = ({ onShowToast }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Don't show if already rated or not on native
    if (!Capacitor.isNativePlatform()) return;
    if (localStorage.getItem(RATE_APP_KEY)) return;

    const roastCount = parseInt(
      localStorage.getItem('burnboard_user_roast_count') || '0',
      10
    );

    if (roastCount >= RATE_APP_THRESHOLD) {
      // Delay to avoid interrupting user flow
      const timer = setTimeout(() => setIsOpen(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleRate = () => {
    // Open Play Store listing
    window.open(
      'https://play.google.com/store/apps/details?id=com.burnboard.app',
      '_blank'
    );
    localStorage.setItem(RATE_APP_KEY, 'true');
    setIsOpen(false);
    onShowToast?.('Thanks! 🔥', 'Your rating means the world to us.');
  };

  const handleDismiss = () => {
    localStorage.setItem(RATE_APP_KEY, 'dismissed');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-[#262626] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-[0_0_40px_rgba(255,77,0,0.15)] animate-in fade-in zoom-in duration-200">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 text-zinc-500 hover:text-white rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#ff4d00]/10 flex items-center justify-center">
            <Flame className="w-8 h-8 text-[#ff4d00]" />
          </div>
          <h3 className="text-lg font-black text-white font-mono uppercase">
            Enjoying BURNBOARD?
          </h3>
          <p className="text-sm text-zinc-400">
            You've delivered some serious burns! If you're having fun roasting humans, drop us a 5-star rating on the Play Store. It helps other roasters find us.
          </p>
        </div>

        {/* Stars */}
        <div className="flex items-center justify-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className="w-8 h-8 text-yellow-500 fill-yellow-500"
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleRate}
            className="w-full py-3 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-mono font-black text-sm uppercase rounded-xl transition-colors"
          >
            ⭐ Rate 5 Stars
          </button>
          <button
            onClick={handleDismiss}
            className="w-full py-2 text-zinc-500 hover:text-zinc-300 text-xs font-mono transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};
