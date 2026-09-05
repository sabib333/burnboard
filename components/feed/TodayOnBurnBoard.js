'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Flame, ArrowUpRight, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * TodayOnBurnBoard — Daily engagement module.
 * 
 * Shows today's most engaged roast as a featured item.
 * Gives users a reason to return daily.
 * 
 * Content is REAL — based on actual engagement data.
 */

function timeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diff = Math.max(0, Math.floor((now - past) / 1000));
  if (diff < 60) return 'now';
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function TodayOnBurnBoard() {
  const [featured, setFeatured] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    const fetchFeatured = async () => {
      try {
        // Get today's most engaged roast
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
          .from('roasts')
          .select(`
            *,
            profiles!inner(id, username, platform, avatar_letter, avatar_color, tagline)
          `)
          .gte('created_at', today.toISOString())
          .order('upvotes', { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          // Calculate engagement score
          const engagement = (
            (data.reaction_haha || 0) +
            (data.reaction_brutal || 0) +
            (data.reaction_cry || 0) +
            (data.upvotes || 0)
          );

          if (engagement > 0) {
            setFeatured({
              ...data,
              profile: data.profiles,
              engagement,
            });
          }
        }
      } catch (err) {
        // Silent fail — module is optional
      } finally {
        setLoading(false);
      }
    };

    fetchFeatured();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#111] border border-[#222] rounded-2xl p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 bg-[#222] rounded" />
          <div className="w-24 h-4 bg-[#222] rounded" />
        </div>
        <div className="space-y-2">
          <div className="w-full h-3 bg-[#222] rounded" />
          <div className="w-3/4 h-3 bg-[#1a1a1a] rounded" />
        </div>
      </div>
    );
  }

  if (!featured) return null;

  return (
    <div className="bg-gradient-to-br from-[#1a0a00] via-[#111] to-[#0a0a0a] border border-[#ff4d00]/30 rounded-2xl p-4 sm:p-5 space-y-3 shadow-[0_0_20px_rgba(255,77,0,0.1)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-[#ff4d00] fill-[#ff4d00]" />
          <span className="text-[11px] font-mono font-bold text-[#ff4d00] uppercase tracking-wider">
            TODAY ON BURNBOARD
          </span>
        </div>
        <Link
          href={`/post/${featured.id}`}
          className="text-[10px] font-mono text-zinc-500 hover:text-[#ff4d00] transition-colors flex items-center gap-1"
        >
          View <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Roast Text */}
      <Link href={`/post/${featured.id}`}>
        <p className="text-sm text-zinc-100 leading-relaxed hover:text-white transition-colors">
          &ldquo;{featured.roast_text}&rdquo;
        </p>
      </Link>

      {/* Author + Engagement */}
      <div className="flex items-center justify-between pt-2 border-t border-[#262626]">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${featured.profile?.avatar_color || 'bg-[#ff4d00] text-black'}`}>
            {featured.profile?.avatar_letter || '?'}
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            @{featured.profile?.username || 'anonymous'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
          <span>🔥 {featured.engagement} engagement</span>
          <span>{timeAgo(featured.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
