'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, AlertTriangle, RefreshCw, Fingerprint, Lock,
  Activity, Info, ScrollText,
} from 'lucide-react';
import { useAdminAuth } from '@/components/admin/useAdminAuth';
import AdminAccessLock from '@/components/admin/AdminAccessLock';

/**
 * /admin/security — Security Operations Dashboard (Master Prompt 26)
 *
 * Aggregate visibility into security-relevant events: admin gate attempts
 * (success/failure velocity, flagged IPs), admin actions, and a recent event
 * feed from security_logs (30-day retention). Coarse and honest: IPs are
 * one-way hashes, no secrets or content ever shown. If the security_logs
 * table is absent (migrations pending) it says so instead of faking an
 * all-clear. Protected by the shared admin gate.
 */

const FAIL_ACTION_COLORS = {
  admin_verify_failed: { bg: 'bg-red-950/40', border: 'border-red-900/60', text: 'text-red-400' },
  admin_verify_success: { bg: 'bg-emerald-950/40', border: 'border-emerald-900/60', text: 'text-emerald-400' },
  admin_action: { bg: 'bg-amber-950/40', border: 'border-amber-900/60', text: 'text-amber-300' },
  account_export: { bg: 'bg-blue-950/40', border: 'border-blue-900/60', text: 'text-blue-300' },
  rate_limit_exceeded: { bg: 'bg-orange-950/40', border: 'border-orange-900/60', text: 'text-orange-300' },
};

function StatCard({ icon, label, value, sub, tone = 'default' }) {
  const tones = { default: '', ok: 'text-emerald-400', warn: 'text-amber-400', danger: 'text-red-400' };
  return (
    <div className="bg-[#101014] border border-[#26262c] rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-black ${tones[tone] || 'text-white'}`}>{value}</div>
      {sub && <div className="text-[11px] text-zinc-500 font-mono">{sub}</div>}
    </div>
  );
}

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString();
}

export default function AdminSecurityPage() {
  const { authenticated, secret, busy, error: gateError, unlock } = useAdminAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/security', {
        headers: { 'x-admin-password': secret },
        cache: 'no-store',
      });
      if (!res.ok) {
        setError(`Security endpoint returned ${res.status}`);
        setData(null);
        return;
      }
      setData(await res.json());
    } catch (err) {
      setError(err?.message || 'Failed to load security events');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [secret]);

  useEffect(() => {
    if (authenticated && secret) load();
  }, [authenticated, secret, load]);

  if (!authenticated) {
    return (
      <AdminAccessLock title="Security Operations" busy={busy} error={gateError} onSubmit={unlock} />
    );
  }

  const s = data?.summary || {};
  const anomalies = data?.anomalies || [];
  const events = data?.events || [];
  const available = data?.available;

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-[#ff4d00]" />
          <h1 className="font-black text-xl">Security Operations</h1>
          <span className="text-[11px] font-mono text-zinc-500">
            {data ? `updated ${data.generatedAt?.slice(11, 19)} UTC` : 'loading…'}
          </span>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 bg-[#101014] border border-[#26262c] rounded-lg px-3 py-1.5 text-xs font-mono hover:border-[#ff4d00]/50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {error && (
        <div className="bg-[#2a0a0a] border border-[#5a1a1a] rounded-xl p-4 text-sm text-red-400 mb-4">
          <AlertTriangle className="w-4 h-4 inline mr-2" />{error}
        </div>
      )}

      {available === false && !error && (
        <div className="bg-[#2a1400] border border-[#5a3a00] rounded-xl p-4 text-sm text-amber-300 mb-4">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          Security events are not available yet — the `security_logs` table is not present in this
          project (apply the migrations). Events recorded by admin surfaces will appear here automatically.
        </div>
      )}

      {available === true && (
        <>
          {/* Anomalies (velocity signals only — no fabrication) */}
          {anomalies.length > 0 && (
            <div className="space-y-2 mb-4">
              {anomalies.map((a, i) => (
                <div key={i} className="rounded-xl p-3 text-sm bg-[#2a1400] border border-[#5a3a00] text-amber-300">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />{a.detail}
                </div>
              ))}
            </div>
          )}
          {anomalies.length === 0 && (
            <div className="bg-[#0f1a12] border border-[#1d3a2a] rounded-xl p-3 text-sm text-emerald-300 mb-4">
              <Activity className="w-4 h-4 inline mr-2" />No security anomalies in the last 24h.
            </div>
          )}

          {/* 24h aggregate cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={<Fingerprint className="w-3.5 h-3.5" />}
              label="Failed unlocks 24h"
              value={fmt(s.failures24h)}
              sub="wrong admin secret attempts"
              tone={s.failures24h > 0 ? 'warn' : 'ok'}
            />
            <StatCard icon={<Lock className="w-3.5 h-3.5" />} label="Successful unlocks" value={fmt(s.successes24h)} sub="in last 24h" tone="ok" />
            <StatCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Flagged IPs 24h" value={fmt(s.flaggedIps24h)} sub={`≥5 failures from one IP`} tone={s.flaggedIps24h > 0 ? 'danger' : 'ok'} />
            <StatCard icon={<ScrollText className="w-3.5 h-3.5" />} label="Distinct sources" value={fmt(s.distinctIps24h)} sub="hashed IPs, failures only" />
          </div>

          {/* Recent event feed */}
          <div className="mt-6">
            <h2 className="text-xs font-mono uppercase tracking-widest text-[#ff4d00] mb-2">Recent security events</h2>
            <div className="bg-[#0a0a0e] border border-[#1d1d23] rounded-xl p-4">
              {events.length > 0 ? (
                <div className="divide-y divide-[#1d1d23] max-h-96 overflow-y-auto">
                  {events.map((evt) => {
                    const c = FAIL_ACTION_COLORS[evt.action] || { text: 'text-zinc-300' };
                    return (
                      <div key={evt.id} className="py-2.5 flex items-center justify-between gap-4 text-xs font-mono">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`px-2 py-0.5 rounded-full border ${c.bg || ''} ${c.border || ''} ${c.text || ''} shrink-0`}>
                            {evt.action}
                          </span>
                          <span className="text-zinc-400 truncate">{evt.ip}</span>
                          {evt.details && (
                            <span className="text-zinc-600 truncate hidden lg:inline">{JSON.stringify(evt.details)}</span>
                          )}
                        </div>
                        <span className="text-zinc-600 shrink-0">
                          {evt.createdAt ? new Date(evt.createdAt).toLocaleString() : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-zinc-500 text-sm">
                  No security events recorded yet — admin gate activity and admin actions will appear here.
                </p>
              )}
            </div>
          </div>

          {/* Honest scope note */}
          <div className="mt-6">
            <div className="bg-[#0a0a0e] border border-[#1d1d23] rounded-xl p-4">
              <p className="text-[11px] text-zinc-500 font-mono leading-relaxed flex items-start gap-2">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  {data?.retention || 'Events are retained 30 days and purged by the daily cleanup cron.'}{' '}
                  Only one-way IP hashes and coarse action names are stored — never passwords, tokens, or content.
                  This surface monitors the admin gate and admin actions; moderation signals live in the
                  safety/moderation tooling. External SIEM ingestion and account-attack telemetry from the auth
                  provider remain Stage-B items (see docs/security/SECURITY_MODEL.md).
                </span>
              </p>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
