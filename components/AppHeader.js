'use client';

import React from 'react';
import Link from 'next/link';
import { Flame, Plus, Gift } from 'lucide-react';
import NotificationBell from './NotificationBell';
import LanguageSwitcher from './LanguageSwitcher';
import { t } from '@/lib/lang';

/**
 * AppHeader — Shared header with BURN BOARD branding and notification bell.
 * Used across discovery, leaderboard, weekly, and other pages.
 */
export default function AppHeader({ showCreate = true, backLink, backLabel }) {

  return (
    <header className="space-y-4 py-4 border-b border-[#222]">
      <div className="flex items-center justify-between">
        {/* Left side: back link or BURN BOARD */}
        {backLink ? (
          <Link href={backLink} className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs transition-colors">
            <span className="text-lg">←</span>
            <span>{backLabel || 'BURN BOARD'}</span>
          </Link>
        ) : (
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs transition-colors">
            <Flame className="w-4 h-4 text-[#ff4d00] fill-[#ff4d00]" />
            <span>BURN BOARD</span>
          </Link>
        )}

        {/* Right side: invite, notification bell + create button */}
        <div className="flex items-center gap-2">
          <Link
            href="/invite"
            title="Invite friends & earn karma"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 border border-[#26262c] hover:border-[#ff4d00]/50 text-zinc-400 hover:text-white text-[11px] font-mono rounded-xl transition-all"
          >
            <Gift className="w-3.5 h-3.5 text-[#ff4d00]" />
            Invite
          </Link>
          <LanguageSwitcher />
          <NotificationBell />
          {showCreate && (
            <Link
              href="/hot-seat"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-bold text-[11px] rounded-xl transition-all shadow-[0_0_15px_rgba(255,77,0,0.3)]"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('nav_create_hot_seat')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
