'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Check, X, Sparkles, RotateCcw } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * /settings/personalization — Personalization & recommendations controls
 *
 * Real, meaningful controls backed by /api/personalization/interests:
 *   - Master switch: turn personalization on/off (feed falls back to the
 *     generic ranking; no data is deleted while off).
 *   - Interests: explicit topic selection (immediately affects For You).
 *   - Reset: clears the interest graph (signals, affinities, feedback,
 *     interests) — a real reset, not a fake button.
 */

function Chip({ topic, selected, disabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(topic.id)}
      disabled={disabled}
      aria-pressed={selected}
      className={`px-2.5 py-1.5 rounded-full text-[11px] font-mono font-bold transition-all active:scale-95 disabled:opacity-60 ${
        selected
          ? 'bg-[#ff4d00] text-black'
          : 'bg-[#0a0a0a] text-zinc-400 border border-[#2a2a2a] hover:text-white hover:border-[#ff4d00]/40'
      }`}
    >
      {selected && <span aria-hidden="true">✓ </span>}
      {topic.name}
    </button>
  );
}

export default function PersonalizationSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [topics, setTopics] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [selectedCount, setSelectedCount] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmingReset, setConfirmingReset] = useState(false);

  // Gate on auth
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) router.push('/auth');
    }).catch(() => {});
  }, [router]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/personalization/interests');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/auth');
          return;
        }
        throw new Error('failed to load');
      }
      const data = await res.json();
      setEnabled(data.enabled !== false);
      setTopics(data.topics || []);
      setSelected(new Set((data.topics || []).filter(t => t.selected).map(t => t.id)));
      setSelectedCount(data.selectedCount || 0);
    } catch (err) {
      setError('Could not load your personalization settings.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const showSuccess = (msg) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 3000);
  };

  const showError = (msg) => {
    setError(msg);
    setSuccess('');
  };

  const toggleEnabled = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    const next = !enabled;
    try {
      const res = await fetch('/api/personalization/interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error('failed');
      setEnabled(next);
      showSuccess(next ? 'Personalization is on.' : 'Personalization is off — your feed is generic again.');
    } catch {
      showError('Could not update the setting.');
    } finally {
      setSaving(false);
    }
  }, [enabled, saving]);

  const toggleTopic = useCallback(async (id) => {
    if (saving) return;
    setSaving(true);
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    try {
      const res = await fetch('/api/personalization/interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_ids: [...next] }),
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setSelectedCount(data.selectedCount || 0);
    } catch {
      setSelected(new Set(selected));
      showError('Could not save your interests.');
    } finally {
      setSaving(false);
    }
  }, [selected, saving]);

  const handleReset = useCallback(async () => {
    if (saving) return;
    if (!confirmingReset) {
      setConfirmingReset(true);
      setTimeout(() => setConfirmingReset(false), 6000);
      return;
    }
    setSaving(true);
    setConfirmingReset(false);
    try {
      const res = await fetch('/api/personalization/interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      if (!res.ok) throw new Error('failed');
      await load();
      showSuccess('Personalization data cleared. For You will rebuild from scratch.');
    } catch {
      showError('Could not reset personalization.');
    } finally {
      setSaving(false);
    }
  }, [confirmingReset, saving, load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#ff4d00]" />
      </div>
    );
  }

  const sortedTopics = [...topics].sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1;
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222] pb-4">
          <Link href="/settings/profile" className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Settings</span>
          </Link>
          <h1 className="text-sm font-black text-white uppercase tracking-wider">Personalization</h1>
          <div className="w-16" />
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 font-mono flex items-center gap-2">
            <X className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-950/40 border border-green-500/30 rounded-xl p-3 text-xs text-green-400 font-mono flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}

        {/* Master switch */}
        <div className="bg-[#111] border border-[#222] rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#ff4d00]" />
              Personalized For You
            </h2>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              {enabled
                ? 'For You mixes your interests with new discoveries. You can tune it below or reset it any time.'
                : 'Off — For You shows generic recent content. Your data is kept, just not used.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Toggle personalization"
            onClick={toggleEnabled}
            disabled={saving}
            className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-60 ${
              enabled ? 'bg-[#ff4d00]' : 'bg-[#2a2a2a]'
            }`}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${enabled ? 'left-6' : 'left-1'}`}
            />
          </button>
        </div>

        {/* Interests */}
        <div className="bg-[#111] border border-[#222] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-white">Your interests</h2>
            <span className="text-[10px] font-mono text-zinc-500">
              {selectedCount} selected{saving ? ' · saving…' : ''}
            </span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Topics marked with real activity are listed first. Picking topics
            tunes For You — you can change this whenever your taste changes.
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Interest topics">
            {sortedTopics.map(topic => (
              <Chip
                key={topic.id}
                topic={topic}
                selected={selected.has(topic.id)}
                disabled={saving || !enabled}
                onToggle={toggleTopic}
              />
            ))}
          </div>
        </div>

        {/* Reset */}
        <div className="bg-[#111] border border-red-500/20 rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-red-400 flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset personalization
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Clears everything For You learned from you — signals, affinities,
            hidden/not-interested feedback and selected interests. Your
            follows and community memberships are untouched. Start fresh.
          </p>
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className={`w-full py-2.5 rounded-xl text-xs font-mono font-bold transition-all disabled:opacity-50 ${
              confirmingReset
                ? 'bg-red-600 text-white'
                : 'bg-[#1a1a1a] border border-[#333] text-zinc-300 hover:border-red-500/50 hover:text-red-400'
            }`}
          >
            {confirmingReset ? 'Click again to confirm — this clears your data' : 'Reset my recommendations'}
          </button>
        </div>

        {/* Privacy note */}
        <p className="text-[10px] font-mono text-zinc-600 leading-relaxed px-1">
          Personalization only uses your platform behavior and explicit choices
          on BurnBoard. We do not infer sensitive traits, sell profiles, or
          build cross-platform tracking.
        </p>
      </div>
    </div>
  );
}
