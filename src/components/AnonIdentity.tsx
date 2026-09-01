import React, { useState, useEffect } from 'react';
import { Flame, Shield, User, Award, Sparkles, RefreshCw } from 'lucide-react';
import { getOrCreateAnonId } from '../lib/presence';

export { getOrCreateAnonId };

export function getUserRoastStats() {
  if (typeof window === 'undefined') return { count: 0, streak: 1 };
  const count = parseInt(localStorage.getItem('my_roast_count') || '0', 10);
  const streak = parseInt(localStorage.getItem('my_roast_streak') || '1', 10);
  return { count, streak };
}

export function incrementUserRoastCount() {
  if (typeof window === 'undefined') return;
  const current = parseInt(localStorage.getItem('my_roast_count') || '0', 10) + 1;
  localStorage.setItem('my_roast_count', String(current));

  // Update streak
  const lastRoastDate = localStorage.getItem('my_last_roast_date');
  const today = new Date().toISOString().slice(0, 10);
  let streak = parseInt(localStorage.getItem('my_roast_streak') || '1', 10);

  if (lastRoastDate) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (lastRoastDate === yesterday) {
      streak += 1;
    } else if (lastRoastDate !== today) {
      streak = 1;
    }
  } else {
    streak = 1;
  }

  localStorage.setItem('my_last_roast_date', today);
  localStorage.setItem('my_roast_streak', String(streak));
  return { count: current, streak };
}

export const AnonIdentity = ({ className = '', onShowToast }) => {
  const [anonId, setAnonId] = useState(getOrCreateAnonId);
  const [stats, setStats] = useState(getUserRoastStats);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setAnonId(getOrCreateAnonId());
    setStats(getUserRoastStats());

    const handleStorage = () => {
      setStats(getUserRoastStats());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleRegenerate = (e) => {
    e.stopPropagation();
    const newId = `Anonymous #${Math.floor(Math.random() * 900) + 100}`;
    localStorage.setItem('burnboard_anon_id', newId);
    setAnonId(newId);
    if (onShowToast) {
      onShowToast('New Anonymous Persona', `Your disguise is now ${newId}`);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        id="anon-identity-badge"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-[#1c1c1c] border border-[#262626] hover:border-[#ff4d00]/40 transition-all text-xs font-mono font-bold group"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-[#ff4d00] shadow-[0_0_8px_#ff4d00]" />
        <span className="text-zinc-300 group-hover:text-white hidden sm:inline">You are</span>
        <span className="text-[#ff4d00] font-black">{anonId}</span>

        {stats.streak >= 3 && (
          <span
            title={`${stats.streak}-day active burn streak`}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#ff4d00]/20 text-[#ff4d00] text-[10px] font-black"
          >
            <Flame className="w-3 h-3 fill-[#ff4d00]" />
            <span>{stats.streak}d</span>
          </span>
        )}
      </button>

      {/* Identity Dropdown Modal */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-[#111111] border border-[#2a2a2a] rounded-2xl p-4 shadow-2xl z-50 space-y-3">
            <div className="flex items-center justify-between border-b border-[#222] pb-2.5">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#ff4d00]" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  Anonymous Vault
                </span>
              </div>
              <button
                onClick={handleRegenerate}
                title="Reroll anonymous identity"
                className="p-1 text-zinc-500 hover:text-white hover:bg-[#222] rounded-lg transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3 space-y-2">
              <div className="text-xs text-zinc-400 font-mono">Current Alias:</div>
              <div className="text-base font-black font-mono text-[#ff4d00] flex items-center justify-between">
                <span>{anonId}</span>
                <span className="text-[10px] bg-[#222] text-zinc-400 px-2 py-0.5 rounded font-sans font-normal">
                  Encrypted
                </span>
              </div>
            </div>

            {/* User Roast Stats */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-[#141414] border border-[#222] rounded-xl p-2.5">
                <div className="text-[10px] uppercase font-mono text-zinc-500">Roasts Made</div>
                <div className="text-lg font-black text-white mt-0.5">
                  {stats.count} {stats.count === 1 ? 'burn' : 'burns'}
                </div>
              </div>

              <div className="bg-[#141414] border border-[#222] rounded-xl p-2.5">
                <div className="text-[10px] uppercase font-mono text-zinc-500">Fire Streak</div>
                <div className="text-lg font-black text-[#ff4d00] flex items-center justify-center gap-1 mt-0.5">
                  <Flame className="w-4 h-4 fill-[#ff4d00]" />
                  <span>{stats.streak} {stats.streak === 1 ? 'day' : 'days'}</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-zinc-400 leading-snug">
              {stats.count > 0 ? (
                <p>You have roasted <strong className="text-white">{stats.count} people</strong> with 100% untraceable identity.</p>
              ) : (
                <p>Drop your first roast on any target to start your daily streak.</p>
              )}
            </div>

            <div className="pt-1">
              <button
                onClick={handleRegenerate}
                className="w-full py-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] rounded-xl text-xs font-mono font-bold text-zinc-300 hover:text-white transition-colors"
              >
                Reroll Anonymous Persona
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnonIdentity;
