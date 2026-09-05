'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UserX, UserCheck, VolumeX, Volume2, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * ProfileSafetyActions — inline Block / Mute controls for profile headers.
 *
 * Shown only when the viewer is signed in and viewing someone else. State is
 * loaded from the server relationship endpoint and every action is enforced
 * server-side (never just a hidden button).
 *
 * Props:
 *   - targetUserId: string
 *   - targetUsername: string
 *   - onBlocked: optional fn (e.g. parent can clear content)
 */

export default function ProfileSafetyActions({ targetUserId, targetUsername, onBlocked }) {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [rel, setRel] = useState(null); // null = loading / unknown
  const [busy, setBusy] = useState(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase.auth.getUser();
          if (!cancelled) setCurrentUserId(data?.user?.id || null);
        } catch {
          if (!cancelled) setCurrentUserId(null);
        }
      }
      try {
        const res = await fetch(`/api/safety/relationship?user_id=${encodeURIComponent(targetUserId)}`);
        if (res.ok && !cancelled) setRel(await res.json());
      } catch {
        if (!cancelled) setRel({ signedIn: false });
      }
    };
    load();
    return () => { cancelled = true; };
  }, [targetUserId]);

  const isOwn = !!currentUserId && currentUserId === targetUserId;
  if (isOwn || !rel?.signedIn) return null;

  const blockedByTarget = !!rel.other_blocks_viewer;
  const isBlocked = !!rel.viewer_blocks_other;
  const isMuted = !!rel.viewer_mutes_other;

  const run = useCallback(async (kind) => {
    if (busy) return;
    setBusy(kind);
    setError('');
    try {
      const active = kind === 'block' ? isBlocked : isMuted;
      const res = await fetch(`/api/safety/${kind}s`, {
        method: active ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not update');
      } else {
        setRel((prev) => ({
          ...prev,
          viewer_blocks_other: kind === 'block' ? !active : prev?.viewer_blocks_other,
          viewer_mutes_other: kind === 'mute' ? !active : prev?.viewer_mutes_other,
        }));
        if (kind === 'block' && !active) {
          setConfirmBlock(false);
          onBlocked?.();
        }
      }
    } catch {
      setError('Network error');
    } finally {
      setBusy(null);
    }
  }, [busy, isBlocked, isMuted, targetUserId, onBlocked]);

  if (blockedByTarget) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono text-zinc-500 border border-[#2a2a2a] rounded-xl">
        <UserX className="w-3.5 h-3.5" />
        You are blocked by this user
      </span>
    );
  }

  const btn = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-mono font-bold rounded-xl border transition-all active:scale-95 disabled:opacity-50';

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[10px] font-mono text-red-400">{error}</span>}
      {isBlocked ? (
        <button
          onClick={() => run('block')}
          disabled={busy}
          className={`${btn} bg-[#1a1a1a] border-[#333] text-zinc-300 hover:text-red-400`}
          aria-label={`Unblock @${targetUsername}`}
        >
          {busy === 'block' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
          Unblock
        </button>
      ) : confirmBlock ? (
        <button
          onClick={() => run('block')}
          disabled={busy}
          className={`${btn} bg-red-500 border-red-500 text-white`}
          aria-label={`Confirm blocking @${targetUsername}`}
        >
          {busy === 'block' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
          Confirm block?
        </button>
      ) : (
        <button
          onClick={() => setConfirmBlock(true)}
          disabled={busy}
          className={`${btn} bg-[#0a0a0a] border-[#333] text-zinc-300 hover:border-red-500/50 hover:text-red-400`}
          aria-label={`Block @${targetUsername}`}
        >
          <UserX className="w-3.5 h-3.5" />
          Block
        </button>
      )}

      <button
        onClick={() => run('mute')}
        disabled={busy}
        className={`${btn} ${
          isMuted
            ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
            : 'bg-[#0a0a0a] border-[#333] text-zinc-300 hover:border-amber-500/50 hover:text-amber-400'
        }`}
        aria-label={isMuted ? `Unmute @${targetUsername}` : `Mute @${targetUsername}`}
        aria-pressed={isMuted}
      >
        {busy === 'mute' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isMuted ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        {isMuted ? 'Unmute' : 'Mute'}
      </button>
    </div>
  );
}
