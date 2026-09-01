import React, { useState, useEffect } from 'react';
import { Flame, Swords, Trophy, Sparkles, Plus, RefreshCw, Radio, Users, Zap, LogIn, User, ChevronDown, Settings, LogOut, MessageCircle, Bell } from 'lucide-react';
import { ViewMode } from '../types';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { setupRoastingPresence } from '../lib/presence';
import { AnonIdentity } from './AnonIdentity';
import { t } from '../lib/lang';
import { useAuth, UserProfile } from '../lib/auth';
import { calculateKarmaLevel } from '../lib/karma';
import { getFollowCounts } from '../lib/follows';
import { FollowCounts } from '../types';
import { NotificationBell } from './NotificationBell';

interface NavbarProps {
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  onOpenSubmit: () => void;
  onResetData: () => void;
  onShowToast?: (text: string, subtext?: string) => void;
}

// Auth Controls Component
const AuthControls: React.FC<{ onShowToast?: (text: string, subtext?: string) => void }> = ({ onShowToast }) => {
  const { user, userProfile, loading, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [followCounts, setFollowCounts] = useState<FollowCounts>({ followers: 0, following: 0 });

  if (loading) return null;

  // Not logged in: show Login/Sign Up button
  if (!user) {
    return (
      <a
        href="#auth"
        onClick={(e) => {
          e.preventDefault();
          window.location.hash = '#auth';
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141414] hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#ff4d00]/40 rounded-xl text-xs font-mono font-bold text-zinc-300 hover:text-white transition-all"
      >
        <LogIn className="w-3.5 h-3.5 text-[#ff4d00]" />
        <span className="hidden sm:inline">Login</span>
      </a>
    );
  }

  // Load follower count on mount
  useEffect(() => {
    if (user) {
      getFollowCounts(user.id).then(setFollowCounts);
    }
  }, [user]);

  // Logged in: show profile dropdown
  const karma = calculateKarmaLevel(userProfile?.karma || 0);
  const displayName = userProfile?.display_name || userProfile?.username || user.email?.split('@')[0] || 'User';

  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 bg-[#141414] hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#ff4d00]/40 rounded-xl transition-all"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#ff4d00] to-amber-500 text-black font-black text-xs flex items-center justify-center">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="hidden sm:flex flex-col items-start">
          <span className="text-xs font-bold text-white leading-tight">{displayName}</span>
          <span className="text-[9px] font-mono text-amber-400 leading-tight">🔥 {userProfile?.karma || 0} • {karma.level}</span>
        </div>
        <ChevronDown className="w-3 h-3 text-zinc-500" />
      </button>

      {dropdownOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-[#111] border border-[#333] rounded-xl shadow-2xl overflow-hidden min-w-[180px]">
            <div className="p-3 border-b border-[#222]">
              <div className="text-xs font-bold text-white">@{userProfile?.username}</div>
              <div className="text-[10px] font-mono text-amber-400">🔥 {userProfile?.karma || 0} karma • {karma.badge}</div>
              <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-zinc-400">
                <span><strong className="text-white">{followCounts.followers}</strong> followers</span>
                <span><strong className="text-white">{followCounts.following}</strong> following</span>
              </div>
            </div>
            <button
              onClick={() => { window.location.hash = '#settings'; setDropdownOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-zinc-300 hover:bg-[#1a1a1a] hover:text-white transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
            <button
              onClick={() => { window.location.hash = `#u/${userProfile?.username}`; setDropdownOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-zinc-300 hover:bg-[#1a1a1a] hover:text-white transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              <span>My Profile</span>
            </button>
            <div className="border-t border-[#222]">
              <button
                onClick={async () => { await signOut(); setDropdownOpen(false); onShowToast?.('Logged Out', 'See you next time! 🔥'); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-red-950/40 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenSubmit,
  onResetData,
  onShowToast
}) => {
  const { user } = useAuth();
  const [activeRoasters, setActiveRoasters] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    try {
      setStreak(parseInt(localStorage.getItem('my_roast_streak') || '0', 10));
    } catch {}
  }, []);

  // Real presence tracking via Supabase
  useEffect(() => {
    const cleanup = setupRoastingPresence(setActiveRoasters);
    return cleanup;
  }, []);

  return (
    <header
      id="main-navbar"
      className="h-16 flex items-center justify-between px-3 sm:px-6 border-b border-[#222] bg-[#0a0a0a]/95 backdrop-blur-md sticky top-0 z-30 select-none gap-2"
    >
      {/* Brand Identity */}
      <div className="flex items-center gap-2.5 sm:gap-3 cursor-pointer shrink-0" onClick={() => onNavigate('feed')}>
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#ff4d00] to-amber-600 flex items-center justify-center shadow-[0_0_20px_rgba(255,77,0,0.35)]">
          <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-black fill-black animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="text-lg sm:text-xl font-black tracking-tighter uppercase italic text-white flex items-center gap-1">
              BURNBOARD
            </h1>
            <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-widest bg-[#222] text-[#ff4d00] px-1.5 py-0.5 rounded border border-[#333]">
              v2.0
            </span>
          </div>
          <p className="text-[10px] font-mono text-zinc-400 tracking-tight hidden md:block">
            No AI. Just Humans Roasting Humans.
          </p>
        </div>
      </div>

      {/* Streak Counter */}
      {streak > 0 && (
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-mono font-bold">
          <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
          <span className="text-amber-400">{streak}d</span>
          <span className="text-zinc-500">streak</span>
        </div>
      )}

      {/* Live Roasting Counter with Green Pulse */}
      <div
        id="live-roasting-indicator"
        className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-[#111111] border border-[#262626] text-xs font-mono font-bold"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        <span className="text-zinc-300">
          <strong className="text-white font-black">{activeRoasters}</strong> roasting now
        </span>
      </div>

      {/* Center Nav for Mobile / Tablet */}
      <div className="flex md:hidden items-center gap-1 bg-[#141414] p-1 rounded-xl border border-[#222]">
        <button
          id="mobile-nav-feed"
          onClick={() => onNavigate('feed')}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
            currentView === 'feed'
              ? 'bg-[#ff4d00] text-black shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Feed
        </button>
        <button
          id="mobile-nav-top"
          onClick={() => onNavigate('top')}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
            currentView === 'top'
              ? 'bg-[#ff4d00] text-black shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Top
        </button>
        <button
          id="mobile-nav-battle"
          onClick={() => onNavigate('battle')}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
            currentView === 'battle'
              ? 'bg-[#ff4d00] text-black shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Battle
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Anonymous Identity Persona Badge */}
        <AnonIdentity onShowToast={onShowToast} />

        {/* Reset / Sample seed button */}
        <button
          id="btn-reset-demo"
          onClick={onResetData}
          title="Reset all data"
          className="hidden sm:block p-2 text-zinc-500 hover:text-zinc-200 hover:bg-[#1a1a1a] rounded-xl border border-[#222] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Notification Bell */}
        <NotificationBell onNavigate={(view) => window.location.hash = view.startsWith('#') ? view : `#${view}`} />

        {/* DM Link */}
        {user && (
          <a
            href="#dm"
            className="p-2 text-zinc-400 hover:text-white hover:bg-[#1a1a1a] rounded-xl border border-[#222] transition-colors hidden sm:flex"
            title="Messages"
          >
            <MessageCircle className="w-4 h-4" />
          </a>
        )}

        {/* Auth: Login/Signup or Profile Dropdown */}
        <AuthControls onShowToast={onShowToast} />

        {/* Get Roasted Primary CTA */}
        <button
          id="btn-get-roasted"
          onClick={onOpenSubmit}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-white text-black font-extrabold rounded-xl hover:bg-[#ff4d00] hover:text-black transition-all duration-200 text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:shadow-[0_0_25px_rgba(255,77,0,0.5)] active:scale-95 shrink-0"
        >
          <Flame className="w-4 h-4 text-black fill-black" />
          <span>Get Roasted</span>
        </button>
      </div>
    </header>
  );
};

