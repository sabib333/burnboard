'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Flame, ArrowLeft, Loader2, X, Users, Globe, ChevronDown, Check, Swords } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { track } from '@/lib/analytics';

/**
 * /challenges/new — Challenge creation.
 * Name → Description → Type → Duration → (optional) Community → Create.
 * Community challenges are only offered for communities the user belongs to
 * (server re-validates membership on submit).
 */

const TYPES = [
  { type: 'hot_take', label: 'Hot Take', icon: '🌶', desc: 'Boldest take wins. Debate guaranteed.', color: 'text-red-400', border: 'border-red-500/40' },
  { type: 'opinion', label: 'Opinion', icon: '💬', desc: 'Everyone shares where they stand.', color: 'text-blue-400', border: 'border-blue-500/40' },
  { type: 'question', label: 'Question', icon: '❓', desc: 'Best answer gets crowned.', color: 'text-purple-400', border: 'border-purple-500/40' },
  { type: 'poll', label: 'Poll', icon: '🗳', desc: 'Participants build their own polls.', color: 'text-amber-400', border: 'border-amber-500/40' },
  { type: 'photo', label: 'Photo', icon: '📸', desc: 'Visual challenge — best shot wins.', color: 'text-pink-400', border: 'border-pink-500/40' },
];

const DURATIONS = [
  { label: '24 hours', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
];

export default function NewChallengePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('hot_take');
  const [durationHours, setDurationHours] = useState(72);
  const [communityId, setCommunityId] = useState('none');
  const [myCommunities, setMyCommunities] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Check auth client-side for a smooth UX (server enforces regardless)
  useEffect(() => {
    const checkAuth = async () => {
      if (!isSupabaseConfigured || !supabase) return;
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
    };
    checkAuth();
  }, []);

  // Preselect community from ?community=<id>
  useEffect(() => {
    const communityParam = searchParams.get('community');
    if (communityParam) setCommunityId(communityParam);
  }, [searchParams]);

  // Load communities for the picker (only real memberships)
  useEffect(() => {
    const loadCommunities = async () => {
      try {
        const res = await fetch('/api/communities?mine=true');
        if (res.ok) {
          const data = await res.json();
          setMyCommunities(data.communities || []);
        }
      } catch {}
    };
    loadCommunities();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setError('');

    if (title.trim().length < 3) {
      setError('Give your challenge a title (at least 3 characters).');
      return;
    }
    if (description.trim().length > 500) {
      setError('Description must be 500 characters or less.');
      return;
    }

    setSubmitting(true);
    try {
      const endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          challenge_type: type,
          ends_at: endsAt,
          community_id: communityId && communityId !== 'none' ? communityId : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create challenge');
        if (res.status === 401) setError(data.error + ' — sign in and try again.');
        return;
      }

      track('challenge_created', { type, community: !!data.challenge?.slug });
      router.push(data.challenge.url);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, title, description, type, durationHours, communityId, router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222] pb-4">
          <Link href="/challenges" className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Challenges</span>
          </Link>
          <div className="flex items-center gap-2 text-[#ff4d00] font-mono font-black text-sm">
            <Swords className="w-4 h-4" aria-hidden="true" />
            <span>NEW CHALLENGE</span>
          </div>
        </div>

        {!user && (
          <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-300 font-mono space-y-2">
            <p>You need an account to create or join challenges — entries are tied to real profiles.</p>
            <Link href="/auth" className="inline-block px-3 py-1.5 rounded-lg bg-[#ff4d00] text-black font-bold hover:bg-[#ff6622] transition-all">
              Sign in / Sign up
            </Link>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 font-mono flex items-center gap-2">
            <X className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Title */}
        <div>
          <label htmlFor="challenge-title" className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
            Challenge name
          </label>
          <input
            id="challenge-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder='e.g. "Hottest take on remote work"'
            className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#ff4d00] focus:ring-1 focus:ring-[#ff4d00]/30 transition-all"
          />
          <p className="text-[10px] font-mono text-zinc-600 mt-1 text-right">{title.length}/120</p>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="challenge-desc" className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
            Description <span className="text-zinc-600">(optional)</span>
          </label>
          <textarea
            id="challenge-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="What's the brief? Keep it to one or two lines so people get it in seconds."
            className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#ff4d00] resize-none transition-all"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
            Entry format
          </label>
          <div className="grid grid-cols-1 gap-2">
            {TYPES.map(t => (
              <button
                key={t.type}
                type="button"
                onClick={() => setType(t.type)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  type === t.type ? `bg-[#1a1a1a] border-[#ff4d00]/60 ${t.color}` : 'border-[#222] hover:border-[#333] bg-[#111]'
                }`}
                aria-pressed={type === t.type}
              >
                <span className="text-xl" aria-hidden="true">{t.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-white">{t.label}</span>
                  <span className="block text-[11px] text-zinc-400">{t.desc}</span>
                </span>
                {type === t.type && <Check className="w-4 h-4 text-[#ff4d00] shrink-0" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
            Runs for
          </label>
          <div className="flex gap-2">
            {DURATIONS.map(d => (
              <button
                key={d.hours}
                type="button"
                onClick={() => setDurationHours(d.hours)}
                className={`flex-1 py-2.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                  durationHours === d.hours
                    ? 'bg-[#1a1a1a] border-[#ff4d00]/60 text-white'
                    : 'border-[#222] text-zinc-400 hover:border-[#333]'
                }`}
                aria-pressed={durationHours === d.hours}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Community (optional) */}
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
            Host in a community <span className="text-zinc-600">(optional)</span>
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen(!pickerOpen)}
              className="w-full flex items-center gap-3 bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-sm text-white hover:border-[#ff4d00]/50 transition-all"
              aria-haspopup="listbox"
              aria-expanded={pickerOpen}
            >
              {communityId === 'none' || !myCommunities.find(c => c.id === communityId) ? (
                <>
                  <Globe className="w-4 h-4 text-[#ff4d00] shrink-0" aria-hidden="true" />
                  <span className="font-bold">Public BurnBoard</span>
                  <span className="text-[10px] font-mono text-zinc-500">Anyone can join</span>
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 text-[#ff4d00] shrink-0" aria-hidden="true" />
                  <span className="font-bold truncate">{myCommunities.find(c => c.id === communityId)?.name}</span>
                  <span className="text-[10px] font-mono text-zinc-500">Members only</span>
                </>
              )}
              <ChevronDown className={`w-4 h-4 text-zinc-500 ml-auto transition-transform ${pickerOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {pickerOpen && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => { setCommunityId('none'); setPickerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${communityId === 'none' ? 'bg-[#ff4d00]/10' : 'hover:bg-[#222]'}`}
                >
                  <Globe className="w-4 h-4 text-[#ff4d00]" aria-hidden="true" />
                  <span className="text-sm font-bold text-white">Public BurnBoard</span>
                  {communityId === 'none' && <Check className="w-4 h-4 text-[#ff4d00] ml-auto" aria-hidden="true" />}
                </button>
                {myCommunities.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setCommunityId(c.id); setPickerOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${communityId === c.id ? 'bg-[#ff4d00]/10' : 'hover:bg-[#222]'}`}
                  >
                    <Users className="w-4 h-4 text-[#ff4d00] shrink-0" aria-hidden="true" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-white truncate">{c.name}</span>
                      <span className="block text-[10px] font-mono text-zinc-500 truncate">/c/{c.slug}</span>
                    </span>
                    {communityId === c.id && <Check className="w-4 h-4 text-[#ff4d00]" aria-hidden="true" />}
                  </button>
                ))}
                {myCommunities.length === 0 && (
                  <div className="px-4 py-3">
                    <p className="text-[11px] text-zinc-500 font-mono">
                      You haven&apos;t joined any communities yet.{' '}
                      <Link href="/c" className="text-[#ff4d00] hover:text-white transition-colors">Browse communities →</Link>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !user}
          className="w-full py-3.5 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(255,77,0,0.4)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Flame className="w-4 h-4 fill-black" aria-hidden="true" />
              Create Challenge
            </>
          )}
        </button>

        <p className="text-center text-[10px] font-mono text-zinc-600">
          Public challenges run on real participation only — no fake entries, ever.
        </p>
      </div>
    </div>
  );
}

