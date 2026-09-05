'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';

/**
 * InterestPicker — lightweight cold-start personalization for the For You feed.
 *
 * Explicit topic selection is a real, server-persisted preference
 * (POST /api/personalization/interests) that immediately influences ranking.
 * Reuses the platform's existing topics table — no duplicate topic system.
 */

const DISMISS_KEY = 'burnboard_interest_picker_dismissed';

export default function InterestPicker({ onApplied }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [topics, setTopics] = useState([]); // [{ id, name, selected, active }]
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState(null);

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/personalization/interests');
        if (!res.ok) throw new Error('unavailable');
        const data = await res.json();
        if (cancelled || !data?.topics) return;
        setTopics(data.topics);
        setSelected(new Set(data.topics.filter(t => t.selected).map(t => t.id)));
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback(async (id) => {
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
      if (!res.ok) throw new Error('save failed');
      onApplied?.();
    } catch {
      // Revert on failure so UI never lies about what was saved.
      setSelected(new Set(selected));
    } finally {
      setSaving(false);
    }
  }, [selected, onApplied]);

  if (dismissed || loading) return null;
  if (error) return null;

  // Selected first, then active (real recent activity), then alphabetical.
  const visible = [...topics]
    .sort((a, b) => {
      if (a.selected !== b.selected) return a.selected ? -1 : 1;
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 18);

  return (
    <div className="bg-gradient-to-br from-[#141414] to-[#111] border border-[#ff4d00]/25 rounded-2xl p-4 relative">
      <button
        onClick={() => {
          setDismissed(true);
          try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
        }}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-[#1f1f1f] transition-colors"
        aria-label="Dismiss interest picker"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 pr-8">
        <Sparkles className="w-4 h-4 text-[#ff4d00]" />
        <h3 className="text-sm font-black uppercase tracking-wider text-white font-mono">
          Make For You yours
        </h3>
      </div>
      <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
        Pick a few things you like — BurnBoard will mix in more of that while
        still helping you discover something new.
      </p>

      <div className="flex flex-wrap gap-1.5 mt-3" role="group" aria-label="Interests">
        {visible.map(topic => {
          const isOn = selected.has(topic.id);
          return (
            <button
              key={topic.id}
              onClick={() => toggle(topic.id)}
              disabled={saving}
              aria-pressed={isOn}
              className={`px-2.5 py-1.5 rounded-full text-[11px] font-mono font-bold transition-all active:scale-95 disabled:opacity-60 ${
                isOn
                  ? 'bg-[#ff4d00] text-black'
                  : 'bg-[#0a0a0a] text-zinc-400 border border-[#2a2a2a] hover:text-white hover:border-[#ff4d00]/40'
              }`}
            >
              {isOn && <span aria-hidden="true">✓ </span>}
              {topic.name}
            </button>
          );
        })}
      </div>

      {saving && (
        <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono text-zinc-500">
          <Loader2 className="w-3 h-3 animate-spin" />
          Saving preferences...
        </div>
      )}
    </div>
  );
}
