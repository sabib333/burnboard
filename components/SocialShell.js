'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Flame, Home, Compass, Plus, Swords, Bell, User, Search,
  TrendingUp, Trophy, Calendar, Menu, X, ChevronRight, Users, Sparkles, BarChart3, Gem, BrainCircuit
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * SocialShell — Global navigation wrapper for BurnBoard.
 * 
 * Desktop: Fixed left sidebar with logo + nav items + user section
 * Mobile: Fixed bottom tab bar with 5 primary actions
 * 
 * This wraps all pages in a consistent navigation frame.
 * Existing pages continue to work — this is additive.
 */

const NAV_ITEMS = [
  { key: 'home', label: 'Feed', shortLabel: 'Feed', icon: Home, href: '/home' },
  { key: 'explore', label: 'Explore', shortLabel: 'Explore', icon: Compass, href: '/explore' },
  { key: 'create', label: 'Create', shortLabel: 'Create', icon: Plus, href: '/create', accent: true },
  { key: 'battles', label: 'Battles', shortLabel: 'Battles', icon: Swords, href: '/battle' },
  { key: 'leaderboard', label: 'Rankings', shortLabel: 'Rank', icon: Trophy, href: '/leaderboards' },
];

const SECONDARY_ITEMS = [
  { key: 'communities', label: 'Communities', icon: Users, href: '/c' },
  { key: 'challenges', label: 'Challenges', icon: Sparkles, href: '/challenges' },
  { key: 'weekly', label: 'Weekly Recap', icon: Calendar, href: '/weekly' },
  { key: 'top', label: 'Top Roasts', icon: TrendingUp, href: '/top' },
  { key: 'notifications', label: 'Notifications', icon: Bell, href: '/notifications' },
  { key: 'ai', label: 'Your AI', icon: BrainCircuit, href: '/ai' },
  { key: 'premium', label: 'Premium', icon: Gem, href: '/premium' },
];

export default function SocialShell({ children }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);

  // Track auth state
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const getUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isActive = (href) => {
    if (href === '/home') return pathname === '/home' || pathname === '/';
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  // Creator Studio is only meaningful for signed-in creators.
  const secondaryItems = user
    ? [...SECONDARY_ITEMS, { key: 'creator', label: 'Creator Studio', icon: BarChart3, href: '/creator' }]
    : SECONDARY_ITEMS;

  return (
    <div className="social-shell">
      {/* ═══ Desktop Sidebar ═══ */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[260px] bg-[#0a0a0a] border-r border-[#1a1a1a] flex-col z-40">
        {/* Logo */}
        <div className="p-5 border-b border-[#1a1a1a]">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-[#ff4d00] flex items-center justify-center shadow-[0_0_15px_rgba(255,77,0,0.3)] group-hover:shadow-[0_0_20px_rgba(255,77,0,0.5)] transition-shadow">
              <Flame className="w-5 h-5 text-black fill-black" />
            </div>
            <div>
              <span className="text-sm font-black text-white uppercase tracking-wider">BURN</span>
              <span className="text-sm font-black text-[#ff4d00] uppercase tracking-wider">BOARD</span>
            </div>
          </Link>
        </div>

        {/* Primary Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  item.accent
                    ? 'bg-[#ff4d00] text-black hover:bg-[#ff6622] shadow-[0_0_12px_rgba(255,77,0,0.3)] mt-3'
                    : active
                      ? 'bg-[#111] text-white border border-[#222]'
                      : 'text-zinc-400 hover:text-white hover:bg-[#111]'
                }`}
              >
                <Icon className={`w-5 h-5 ${item.accent ? 'text-black' : active ? 'text-[#ff4d00]' : ''}`} />
                <span className="font-mono">{item.label}</span>
              </Link>
            );
          })}

          {/* Divider */}
          <div className="h-px bg-[#1a1a1a] my-3" />

          {/* Secondary Nav */}
          {secondaryItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-mono transition-all ${
                  active
                    ? 'bg-[#111] text-white'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#111]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-3 border-t border-[#1a1a1a]">
          {user ? (
            <Link
              href={`/u/${user.email?.split('@')[0] || 'user'}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#111] transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-[#ff4d00] flex items-center justify-center text-xs font-black text-black">
                {user.email?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{user.email?.split('@')[0] || 'User'}</p>
                <p className="text-[10px] text-zinc-500 font-mono truncate">{user.email}</p>
              </div>
              <NotificationBell />
            </Link>
          ) : (
            <Link
              href="/auth"
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#111] border border-[#222] hover:border-[#ff4d00]/50 text-xs font-mono font-bold text-zinc-300 hover:text-white transition-all"
            >
              <User className="w-4 h-4" />
              Sign In
            </Link>
          )}
        </div>
      </aside>

      {/* ═══ Mobile Bottom Nav ═══ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-lg border-t border-[#1a1a1a] pb-safe">
        <div className="flex items-center justify-around px-2 py-1">
          {NAV_ITEMS.slice(0, 5).map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[56px] ${
                  item.accent
                    ? '-mt-4'
                    : ''
                }`}
              >
                {item.accent ? (
                  <div className="w-10 h-10 rounded-full bg-[#ff4d00] flex items-center justify-center shadow-[0_0_15px_rgba(255,77,0,0.4)] -mb-1">
                    <Icon className="w-5 h-5 text-black" />
                  </div>
                ) : (
                  <Icon className={`w-5 h-5 ${active ? 'text-[#ff4d00]' : 'text-zinc-500'}`} />
                )}
                <span className={`text-[9px] font-mono font-bold ${item.accent ? 'text-[#ff4d00]' : active ? 'text-[#ff4d00]' : 'text-zinc-500'}`}>
                  {item.shortLabel}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ═══ Main Content Area ═══ */}
      <main className="social-shell-content">
        {children}
      </main>
    </div>
  );
}
