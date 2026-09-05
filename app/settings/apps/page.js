'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Link2, ShieldCheck, Trash2, ExternalLink } from 'lucide-react';
import { scopeLabel } from '@/lib/platform/scopes';

/**
 * /settings/apps — Connected apps (Master Prompt 20)
 *
 * Every third-party application the user has granted scoped access to,
 * with the exact permissions granted, and one-click revocation. Revocation
 * is immediate and server-side (the app loses access instantly, even if it
 * has a cached token).
 */

export default function ConnectedAppsPage() {
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notSignedIn, setNotSignedIn] = useState(false);
  const [error, setError] = useState('');
  const [revokingId, setRevokingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/platform/connect', { cache: 'no-store' });
      if (res.status === 401) { setNotSignedIn(true); setGrants([]); return; }
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setGrants(json.data || []);
    } catch (e) {
      setError(e.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function revoke(grantId) {
    if (!window.confirm('Revoke this app\'s access? It will lose access to your data immediately.')) return;
    setRevokingId(grantId);
    setError('');
    try {
      const res = await fetch('/api/platform/connect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_id: grantId }),
      });
      if (!res.ok) throw new Error('Revoke failed');
      setGrants(prev => prev.filter(g => g.id !== grantId));
    } catch (e) {
      setError(e.message || 'Revoke failed');
    } finally {
      setRevokingId(null);
    }
  }

  if (notSignedIn) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-6">
        <div className="bg-[#101014] border border-[#26262c] rounded-2xl p-8 max-w-md w-full text-center">
          <ShieldCheck className="w-8 h-8 text-zinc-500 mx-auto mb-4" />
          <h1 className="text-white font-black text-lg mb-2">Connected apps</h1>
          <p className="text-zinc-400 text-sm mb-6">Sign in to see which apps can access your account and revoke them.</p>
          <a href="/login" className="inline-block bg-[#ff4d00] text-black font-bold rounded-lg px-6 py-2 text-sm">Sign in</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-400">
            <Link2 className="w-5 h-5" />
            <h1 className="text-lg font-black text-white">Connected apps</h1>
          </div>
          <a href="/" className="text-xs text-zinc-400 hover:text-white">← Back to BurnBoard</a>
        </div>

        {error && <div className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded-lg px-4 py-3">{error}</div>}

        {loading && <p className="text-zinc-500 text-sm">Loading…</p>}

        {!loading && grants.filter(g => !g.revoked).length === 0 && (
          <p className="text-zinc-500 text-sm bg-[#101014] border border-[#26262c] rounded-xl p-5">
            No connected apps. When you grant a third-party app access to your
            account, it will appear here and you can revoke it at any time.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {grants.filter(g => !g.revoked).map(g => (
            <div key={g.id} className="bg-[#101014] border border-[#26262c] rounded-xl p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-white font-bold text-sm">{g.appName}</h3>
                  {g.website && (
                    <a href={g.website} target="_blank" rel="noopener noreferrer"
                      className="text-zinc-500 text-xs flex items-center gap-1 mt-0.5 hover:text-zinc-300">
                      {g.website} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <p className="text-[11px] text-zinc-600 mt-1">
                    Connected {new Date(g.grantedAt).toLocaleDateString()}
                    {g.expiresAt ? ` · expires ${new Date(g.expiresAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <button onClick={() => revoke(g.id)} disabled={revokingId === g.id}
                  className="flex items-center gap-1.5 bg-red-950/60 hover:bg-red-900 border border-red-900 text-red-300 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
                  <Trash2 className="w-3.5 h-3.5" />
                  {revokingId === g.id ? 'Revoking…' : 'Revoke'}
                </button>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 mb-1.5">Permissions granted</p>
                <div className="flex flex-col gap-1">
                  {(g.scopes || []).map(s => (
                    <div key={s} className="flex items-center gap-2 text-xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="text-zinc-300">{scopeLabel(s)}</span>
                      <span className="text-zinc-600 font-mono text-[10px]">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}