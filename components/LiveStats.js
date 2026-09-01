'use client';

/**
 * LiveStats — Real-time platform statistics from Supabase
 * Shows live profile count + roast count with realtime updates.
 * 100% real data. No demo data. Empty state if no Supabase.
 */

import React, { useState, useEffect } from 'react';
import { Flame, Users } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function LiveStats() {
  const [profileCount, setProfileCount] = useState(0);
  const [roastCount, setRoastCount] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const fetchCounts = async () => {
      try {
        const [profilesRes, roastsRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('roasts').select('id', { count: 'exact', head: true }),
        ]);

        setProfileCount(profilesRes.count || 0);
        setRoastCount(roastsRes.count || 0);
        setConnected(true);
      } catch (err) {
        console.warn('[LiveStats] Failed to fetch counts:', err);
      }
    };

    fetchCounts();

    // Realtime subscription for live count updates
    const channel = supabase
      .channel('live-stats')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles' },
        () => setProfileCount(prev => prev + 1)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'roasts' },
        () => setRoastCount(prev => prev + 1)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'profiles' },
        () => setProfileCount(prev => Math.max(0, prev - 1))
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'roasts' },
        () => setRoastCount(prev => Math.max(0, prev - 1))
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!isSupabaseConfigured || !supabase) return null;

  return (
    <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500">
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
        <span className={connected ? 'text-emerald-400' : ''}>Live</span>
      </div>
      <span className="text-zinc-600">•</span>
      <div className="flex items-center gap-1">
        <Users className="w-3 h-3 text-zinc-500" />
        <span className="text-zinc-300 font-bold">{profileCount}</span>
        <span>profiles</span>
      </div>
      <span className="text-zinc-600">•</span>
      <div className="flex items-center gap-1">
        <Flame className="w-3 h-3 text-[#ff4d00]" />
        <span className="text-zinc-300 font-bold">{roastCount}</span>
        <span>roasts</span>
      </div>
      <span className="text-zinc-600">•</span>
      <span className="text-zinc-400">Realtime</span>
    </div>
  );
}
