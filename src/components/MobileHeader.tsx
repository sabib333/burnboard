import React from 'react';
import { Flame, Bell, MessageCircle } from 'lucide-react';
import { AnonIdentity } from './AnonIdentity';

interface MobileHeaderProps {
  onNavigate: (view: string) => void;
  unreadDmCount?: number;
  unreadNotifCount?: number;
  onShowToast?: (text: string, subtext?: string) => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  onNavigate,
  unreadDmCount = 0,
  unreadNotifCount = 0,
  onShowToast,
}) => {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-lg border-b border-[#222] px-4 flex items-center justify-between h-14"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Left: Logo */}
      <button
        onClick={() => onNavigate('feed')}
        className="flex items-center gap-2"
      >
        <Flame className="w-6 h-6 text-[#ff4d00] fill-[#ff4d00]" />
        <span className="text-sm font-mono font-black text-white uppercase tracking-wider">
          BURN<span className="text-[#ff4d00]">BOARD</span>
        </span>
      </button>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <AnonIdentity onShowToast={onShowToast} />

        {/* Notification Bell */}
        <button
          onClick={() => onNavigate('settings')}
          className="relative p-2 text-zinc-400 hover:text-white transition-colors"
        >
          <Bell className="w-5 h-5" />
          {unreadNotifCount > 0 ? (
            <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center bg-[#ff4d00] text-black text-[8px] font-mono font-bold rounded-full leading-none">
              {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
            </span>
          ) : null}
        </button>

        {/* DM Link */}
        <button
          onClick={() => onNavigate('dm')}
          className="relative p-2 text-zinc-400 hover:text-white transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          {unreadDmCount > 0 ? (
            <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center bg-[#ff4d00] text-black text-[8px] font-mono font-bold rounded-full leading-none">
              {unreadDmCount > 9 ? '9+' : unreadDmCount}
            </span>
          ) : null}
        </button>
      </div>
    </header>
  );
};
