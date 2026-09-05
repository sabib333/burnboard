'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Flame, ArrowLeft, Send, Loader2, Swords, Trophy, Clock, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { isProfane } from '@/lib/filter';

export default function ChallengePage() {
  const { username } = useParams();

  const [profile, setProfile] = useState(null);
  const [roasts, setRoasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roastText, setRoastText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Fetch profile by username
  useEffect(() => {
    if (!username) return;

    const fetchProfile = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false);
        return;
      }

      try {
        const cleanUsername = decodeURIComponent(username).replace(/^@/, '');
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .ilike('username', cleanUsername)
          .single();

        if (fetchError || !data) {
          setError(`Profile @${cleanUsername} not found`);
          setLoading(false);
          return;
        }

        setProfile(data);

        // Fetch their roasts
        const { data: roastData } = await supabase
          .from('roasts')
          .select('*')
          .eq('profile_id', data.id)
          .order('created_at', { ascending: false })
          .limit(5);

        setRoasts(roastData || []);
      } catch (err) {
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

  const handleSubmit = async () => {
    if (!roastText.trim() || !profile || isSubmitting) return;

    // Profanity check
    const profanityCheck = isProfane(roastText);
    if (profanityCheck.profane) {
      setError(profanityCheck.reason || 'Contains prohibited content');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const anonId = `Challenger #${Math.floor(Math.random() * 900) + 100}`;

      const res = await fetch('/api/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: profile.id,
          roast_text: roastText.trim(),
          anon_id: anonId,
          savage_level: 'savage',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to submit roast');
        return;
      }

      setSubmitted(true);
      setRoastText('');
      showToast(`🔥 Challenge roast delivered to @${profile.username}!`);

      // Refresh roasts
      const { data: newRoasts } = await supabase
        .from('roasts')
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setRoasts(newRoasts || []);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Flame className="w-8 h-8 text-[#ff4d00] animate-pulse mx-auto" />
          <p className="text-xs font-mono text-zinc-400">Loading challenge target...</p>
        </div>
      </div>
    );
  }

  // ── Error / Not Found ────────────────────────────────────
  if (error && !profile) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-4xl">🏃‍♂️💨</div>
          <h1 className="text-xl font-bold text-white">Target Not Found</h1>
          <p className="text-xs text-zinc-400">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ff4d00] text-black font-bold text-xs rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Feed
          </Link>
        </div>
      </div>
    );
  }

  // ── Main Challenge View ──────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#ff4d00] text-black px-4 py-2 rounded-xl text-xs font-mono font-bold shadow-lg animate-bounce">
          {toast}
        </div>
      )}

      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222] pb-4">
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>BURNBOARD</span>
          </Link>
          <div className="flex items-center gap-2 text-[#ff4d00] font-mono font-black text-sm">
            <Swords className="w-4 h-4" />
            <span>CHALLENGE</span>
          </div>
        </div>

        {/* Challenge Header */}
        <div className="bg-gradient-to-br from-[#1a0500] via-[#111] to-[#0a0a0a] border-2 border-[#ff4d00]/40 rounded-3xl p-5 sm:p-6 space-y-4 shadow-[0_0_40px_rgba(255,77,0,0.15)]">
          <div className="text-center space-y-2">
            <div className="text-4xl mb-2">⚔️</div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Challenge Roast
            </h1>
            <p className="text-xs text-zinc-400">
              Drop an anonymous roast on <span className="text-[#ff4d00] font-bold">@{profile?.username}</span>
            </p>
          </div>

          {/* Target Info */}
          <div className="flex items-center gap-3 bg-[#0a0a0a] border border-[#262626] rounded-xl p-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black shrink-0 ${profile?.avatar_color || 'bg-[#ff4d00] text-black'}`}>
              {profile?.avatar_letter}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white truncate">@{profile?.username}</span>
                <span className="text-[10px] font-bold bg-[#ff4d00]/15 text-[#ff4d00] border border-[#ff4d00]/30 px-2 py-0.5 rounded-full uppercase">
                  {profile?.platform}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">{profile?.bio}</p>
            </div>
          </div>
        </div>

        {/* Roast Submission */}
        <div className="bg-[#111] border border-[#222] rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#ff4d00]" />
            <h2 className="text-sm font-bold text-white">Your Challenge Roast</h2>
          </div>

          <p className="text-[11px] text-zinc-400">
            Keep it funny. Keep it creative. Anonymous by default.
          </p>

          <div className="relative">
            <textarea
              value={roastText}
              onChange={(e) => { setRoastText(e.target.value); setError(''); }}
              placeholder={`Roast @${profile?.username} here...`}
              rows={3}
              maxLength={280}
              className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#ff4d00] focus:ring-1 focus:ring-[#ff4d00]/30 resize-none"
            />
            <div className="flex justify-between items-center mt-1.5">
              <span className="text-[10px] font-mono text-zinc-500">
                {280 - roastText.length} chars left
              </span>
              <span className="text-[10px] font-mono text-zinc-600">
                Ctrl+Enter to submit
              </span>
            </div>
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-2.5 text-xs text-red-400 font-mono flex items-center gap-2">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!roastText.trim() || isSubmitting}
            className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              submitted
                ? 'bg-green-600 text-white'
                : 'bg-[#ff4d00] hover:bg-[#ff6622] text-black shadow-[0_0_20px_rgba(255,77,0,0.4)]'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : submitted ? (
              <>✓ Roast Delivered!</>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Fire Challenge Roast
              </>
            )}
          </button>
        </div>

        {/* Recent Roasts */}
        {roasts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
              Recent Burns on @{profile?.username}
            </h3>
            {roasts.map((roast) => (
              <div key={roast.id} className="bg-[#111] border border-[#222] hover:border-[#333] p-4 rounded-2xl transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#ff4d00] font-black font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff4d00]" />
                    {roast.anon_id}
                  </span>
                  <span className="text-[10px] text-zinc-600 font-mono">
                    {new Date(roast.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-zinc-100 leading-relaxed select-text">
                  &ldquo;{roast.roast_text}&rdquo;
                </p>
                <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-zinc-500">
                  <span>▲ {roast.upvotes || 0}</span>
                  <span>😂 {roast.reaction_haha || 0}</span>
                  <span>💀 {roast.reaction_brutal || 0}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 border-t border-[#222]">
          <Link
            href="/"
            className="text-xs text-zinc-500 hover:text-[#ff4d00] font-mono transition-colors"
          >
            ← Back to BURNBOARD
          </Link>
        </div>
      </div>
    </div>
  );
}
