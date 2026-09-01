import React, { useState, useEffect } from 'react';
import { Flame, Swords, Trophy, Plus, MessageCircle } from 'lucide-react';
import { ViewMode } from '../types';

interface MobileBottomNavProps {
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  onOpenSubmit: () => void;
  unreadDmCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  onOpenSubmit,
  unreadDmCount = 0,
}) => {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    // Check if running inside Capacitor
    setIsNative(!!(window as any).Capacitor);
  }, []);

  const triggerHaptic = async () => {
    if (!isNative) return;
    try {
      const { Haptics } = await import('@capacitor/haptics');
      await Haptics.vibrate({ duration: 30 });
    } catch {
      // Not available or not on native
    }
  };

  const navItems = [
    { id: 'feed' as ViewMode, icon: Flame, label: 'Feed' },
    { id: 'battle' as ViewMode, icon: Swords, label: 'Battle' },
    { id: 'submit' as ViewMode, icon: Plus, label: 'Submit', isAction: true },
    { id: 'dm' as ViewMode, icon: MessageCircle, label: 'DM', badge: unreadDmCount },
    { id: 'top' as ViewMode, icon: Trophy, label: 'Top' },
  ];

  return (
    <nav
      id="mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-lg border-t border-[#222] px-2"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          const isSubmit = item.isAction;

          if (isSubmit) {
            return (
              <button
                key={item.id}
                id={`mobile-nav-${item.id}`}
                onClick={() => {
                  triggerHaptic();
                  onOpenSubmit();
                }}
                className="flex flex-col items-center justify-center gap-0.5 -mt-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#ff4d00] flex items-center justify-center shadow-[0_0_20px_rgba(255,77,0,0.5)] active:scale-90 transition-transform">
                  <Icon className="w-6 h-6 text-black stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-mono font-bold text-[#ff4d00] mt-0.5">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              id={`mobile-nav-${item.id}`}
              onClick={() => {
                triggerHaptic();
                onNavigate(item.id);
              }}
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 min-w-[48px] relative"
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive
                      ? 'text-[#ff4d00] fill-[#ff4d00]'
                      : 'text-zinc-500'
                  }`}
                />
                {/* Unread DM badge */}
                {'badge' in item && item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center bg-[#ff4d00] text-black text-[9px] font-mono font-bold rounded-full leading-none">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </div>
              <span
                className={`text-[10px] font-mono font-bold transition-colors ${
                  isActive ? 'text-[#ff4d00]' : 'text-zinc-500'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
