import React from 'react';
import { Flame, Swords, Trophy, Globe, ShieldCheck, TrendingUp, Zap, FileText } from 'lucide-react';
import { ViewMode, Profile } from '../types';
import { ProductHuntBadge } from './ProductHuntBadge';

interface SidebarLeftProps {
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  profiles: Profile[];
}

export const SidebarLeft: React.FC<SidebarLeftProps> = ({
  currentView,
  onNavigate,
  selectedCategory,
  onSelectCategory,
  profiles
}) => {
  // Compute counts per category
  const categories = [
    { id: 'ALL', label: 'All Platforms', icon: '🔥' },
    { id: 'X', label: 'X / Twitter', icon: '𝕏' },
    { id: 'LinkedIn', label: 'LinkedIn', icon: '💼' },
    { id: 'GitHub', label: 'GitHub', icon: '🐙' },
    { id: 'Instagram', label: 'Instagram', icon: '📸' },
    { id: 'Indie Hacker', label: 'Indie Hacker', icon: '🚀' }
  ];

  const seoChambers = [
    { slug: 'linkedin', label: 'LinkedIn Roasts', icon: '💼' },
    { slug: 'github', label: 'GitHub Roasts', icon: '🐙' },
    { slug: 'x', label: 'X / Twitter Roasts', icon: '𝕏' },
    { slug: 'instagram', label: 'Instagram Roasts', icon: '📸' }
  ];

  const getCategoryCount = (catId: string) => {
    if (catId === 'ALL') {
      return profiles.reduce((acc, p) => acc + p.roast_count, 0);
    }
    return profiles
      .filter(p => p.platform.toLowerCase() === catId.toLowerCase() || (catId === 'X' && p.platform === 'X'))
      .reduce((acc, p) => acc + p.roast_count, 0);
  };

  const totalBurns = profiles.reduce((acc, p) => acc + p.roast_count, 0);

  return (
    <aside
      id="sidebar-left"
      className="hidden md:flex w-64 border-r border-[#222] flex-col p-4 gap-5 bg-[#0a0a0a] overflow-y-auto shrink-0 select-none"
    >
      {/* Product Hunt Viral Badge */}
      <div className="px-1">
        <ProductHuntBadge className="w-full justify-between" />
      </div>

      {/* Discovery Section */}
      <nav className="flex flex-col gap-1">
        <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1.5 px-3">
          Discovery
        </div>
        <button
          id="nav-left-feed"
          onClick={() => onNavigate('feed')}
          className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
            currentView === 'feed'
              ? 'bg-[#1a1a1a] text-white border border-[#333] font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-[#141414]'
          }`}
        >
          <div className="flex items-center gap-3">
            <Flame className={`w-4 h-4 ${currentView === 'feed' ? 'text-[#ff4d00]' : 'text-zinc-500'}`} />
            <span className="text-xs font-mono">Main Feed</span>
          </div>
          <span className="text-[10px] font-mono bg-[#222] text-[#ff4d00] px-1.5 py-0.5 rounded">
            Live
          </span>
        </button>

        <button
          id="nav-left-top"
          onClick={() => onNavigate('top')}
          className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
            currentView === 'top'
              ? 'bg-[#1a1a1a] text-white border border-[#333] font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-[#141414]'
          }`}
        >
          <div className="flex items-center gap-3">
            <Trophy className={`w-4 h-4 ${currentView === 'top' ? 'text-amber-400' : 'text-zinc-500'}`} />
            <span className="text-xs font-mono">Hall of Fame</span>
          </div>
          <span className="text-[10px] font-mono bg-[#222] text-zinc-400 px-1.5 py-0.5 rounded">
            Ranked
          </span>
        </button>

        <button
          id="nav-left-battle"
          onClick={() => onNavigate('battle')}
          className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
            currentView === 'battle'
              ? 'bg-[#1a1a1a] text-white border border-[#333] font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-[#141414]'
          }`}
        >
          <div className="flex items-center gap-3">
            <Swords className={`w-4 h-4 ${currentView === 'battle' ? 'text-red-400' : 'text-zinc-500'}`} />
            <span className="text-xs font-mono">Roast Battles</span>
          </div>
          <span className="text-[10px] font-mono bg-red-950/60 text-red-400 border border-red-800/40 px-1.5 py-0.5 rounded animate-pulse">
            VS
          </span>
        </button>

        <button
          id="nav-left-world"
          onClick={() => onNavigate('world')}
          className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
            currentView === 'world'
              ? 'bg-[#1a1a1a] text-white border border-[#333] font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-[#141414]'
          }`}
        >
          <div className="flex items-center gap-3">
            <Globe className={`w-4 h-4 ${currentView === 'world' ? 'text-amber-400' : 'text-zinc-500'}`} />
            <span className="text-xs font-mono">World Map</span>
          </div>
          <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">
            🌍
          </span>
        </button>

        <button
          onClick={() => onNavigate('trending')}
          className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
            currentView === 'trending'
              ? 'bg-[#1a1a1a] text-white border border-[#333] font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-[#141414]'
          }`}
        >
          <div className="flex items-center gap-3">
            <TrendingUp className={`w-4 h-4 ${currentView === 'trending' ? 'text-orange-400' : 'text-zinc-500'}`} />
            <span className="text-xs font-mono">Trending</span>
          </div>
          <span className="text-[10px] font-mono bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded">
            📈
          </span>
        </button>

        <button
          onClick={() => onNavigate('challenges')}
          className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
            currentView === 'challenges'
              ? 'bg-[#1a1a1a] text-white border border-[#333] font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-[#141414]'
          }`}
        >
          <div className="flex items-center gap-3">
            <Zap className={`w-4 h-4 ${currentView === 'challenges' ? 'text-yellow-400' : 'text-zinc-500'}`} />
            <span className="text-xs font-mono">Challenges</span>
          </div>
          <span className="text-[10px] font-mono bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">
            ⚡
          </span>
        </button>

        <button
          onClick={() => onNavigate('burnReport')}
          className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
            currentView === 'burnReport'
              ? 'bg-[#1a1a1a] text-white border border-[#333] font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-[#141414]'
          }`}
        >
          <div className="flex items-center gap-3">
            <FileText className={`w-4 h-4 ${currentView === 'burnReport' ? 'text-purple-400' : 'text-zinc-500'}`} />
            <span className="text-xs font-mono">Burn Report</span>
          </div>
          <span className="text-[10px] font-mono bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded">
            📊
          </span>
        </button>


      </nav>

      {/* SEO Dedicated Chambers */}
      <nav className="flex flex-col gap-1">
        <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1.5 px-3 flex items-center justify-between">
          <span>SEO Chambers</span>
          <Globe className="w-3 h-3 text-zinc-600" />
        </div>
        {seoChambers.map(chamber => (
          <button
            key={chamber.slug}
            id={`nav-seo-${chamber.slug}`}
            onClick={() => {
              window.location.hash = `#roast/${chamber.slug}`;
            }}
            className="flex items-center justify-between px-3 py-1.5 rounded-xl transition-all text-zinc-400 hover:text-white hover:bg-[#141414] text-xs font-mono"
          >
            <div className="flex items-center gap-2">
              <span>{chamber.icon}</span>
              <span>{chamber.label}</span>
            </div>
            <span className="text-[9px] text-[#ff4d00]/70 uppercase">SEO</span>
          </button>
        ))}
      </nav>

      {/* Platform Stats Widget */}
      <div className="mt-auto pt-3 border-t border-[#222] flex flex-col gap-2.5">
        <div className="bg-[#111] border border-[#222] rounded-xl p-3">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] mb-1 font-mono">
            <span>Total Fire Power</span>
            <Flame className="w-3.5 h-3.5 text-[#ff4d00]" />
          </div>
          <div className="text-lg font-black text-white font-mono">
            {totalBurns.toLocaleString()} <span className="text-xs text-zinc-400 font-normal">burns</span>
          </div>
          <div className="w-full bg-[#222] h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-[#ff4d00] h-full rounded-full w-[84%] animate-pulse" />
          </div>
        </div>

        {/* Anti AI Guarantee */}
        <div className="bg-[#14100c] border border-[#ff4d00]/20 rounded-xl p-2.5 flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#ff4d00] shrink-0" />
          <div>
            <div className="text-[11px] font-bold text-zinc-200">
              100% Human Roasts
            </div>
            <div className="text-[10px] text-zinc-500 leading-tight">
              Zero AI slop allowed.
            </div>
          </div>
        </div>


      </div>
    </aside>
  );
};
