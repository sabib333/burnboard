'use client';

import React, { useState } from 'react';
import { Lock, Loader2, AlertTriangle } from 'lucide-react';

/**
 * BURNBOARD — AdminAccessLock (Master Prompt 26)
 *
 * Shared lock screen for admin dashboards. The password typed here is sent to
 * POST /api/admin/verify (server-side check) — it is never compared against a
 * client-bundled constant.
 *
 * Props:
 *   title     — dashboard name shown on the lock card
 *   busy      — verification in flight
 *   error     — human message from the hook (denied/unconfigured/network)
 *   onSubmit  — (password) => void  (wire to useAdminAuth().unlock)
 */

export default function AdminAccessLock({ title = 'Admin Dashboard', busy = false, error = null, onSubmit }) {
  const [password, setPassword] = useState('');

  const submit = () => {
    if (busy) return;
    onSubmit(password);
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="bg-[#101014] border border-[#26262c] rounded-2xl p-8 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="w-5 h-5 text-[#ff4d00]" />
          <h1 className="font-black text-lg">{title}</h1>
        </div>
        <p className="text-sm text-zinc-400 mb-4">Admin access required.</p>
        {error && (
          <div className="flex items-start gap-2 text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2 mb-4">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Admin password"
          disabled={busy}
          autoFocus
          className="w-full bg-black border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#ff4d00] disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={busy || !password}
          className="mt-3 w-full bg-[#ff4d00] text-black font-black rounded-lg py-2 text-sm flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Unlock
        </button>
        <p className="text-[10px] text-zinc-600 font-mono mt-3">
          Verified server-side against ADMIN_PASSWORD. Never stored in this browser.
        </p>
      </div>
    </main>
  );
}
