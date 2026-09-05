'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Activity, AlertTriangle, RefreshCw, Gauge,
  Database, Layers, Zap, BellRing, Webhook, Users, Info,
} from 'lucide-react';
import { useAdminAuth } from '@/components/admin/useAdminAuth';
import AdminAccessLock from '@/components/admin/AdminAccessLock';

/**
 * /admin/infrastructure — Executive Infrastructure Dashboard (Master Prompt 25)
 *
 * One aggregate view of platform health: traffic, database, cache, rate
 * limiter, queues, webhook pipeline, and DAU/WAU context — with computed,
 * actionable alerts (no noise, no user-level data). Protected by the shared
 * admin gate (MP26): server-verified, no client-embedded secret.
 */

function StatCard({ icon, label, value, sub, tone = 'default' }) {
  const tones = {
    default: '',
    ok: 'text-emerald-400',
    warn: 'text-amber-400',
    danger: 'text-red-400',
  };
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

function Section({ title, children }) {
  return (
    <div className="mt-6">
      <h2 className="text-xs font-mono uppercase tracking-widest text-[#ff4d00] mb-2">{title}</h2>
      <div className="bg-[#0a0a0e] border border-[#1d1d23] rounded-xl p-4">{children}</div>
    </div>
  );
}

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString();
}

export default function AdminInfrastructurePage() {
  const { authenticated, secret, busy, error: gateError, unlock } = useAdminAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/infrastructure', {
        headers: { 'x-admin-password': secret },
        cache: 'no-store',
      });
      if (!res.ok) {
        setError(`Infrastructure endpoint returned ${res.status}`);
        setData(null);
        return;
      }
      setData(await res.json());
    } catch (err) {
      setError(err?.message || 'Failed to load infrastructure data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated && secret) load();
  }, [authenticated, secret, load]);

  if (!authenticated) {
    return (
      <AdminAccessLock title="Infrastructure Dashboard" busy={busy} error={gateError} onSubmit={unlock} />
    );
  }

  const t = data?.traffic || {};
  const db = data?.database || {};
  const cache = data?.cache || {};
  const rl = data?.rateLimiter || {};
  const queues = data?.queues || {};
  const webhooks = data?.webhooks || {};
  const growth = data?.growth || {};
  const alerts = data?.alerts || [];

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-[#ff4d00]" />
          <h1 className="font-black text-xl">Executive Infrastructure</h1>
          <span className="text-[11px] font-mono text-zinc-500">
            {data ? `generated ${data.generatedAt?.slice(11, 19)} UTC` : 'loading…'}
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

      {!data && !error && (
        <div className="text-zinc-500 text-sm">
          {loading ? 'Collecting platform health…' : 'No data yet — hit Refresh.'}
        </div>
      )}

      {data && (
        <>
          {/* Alerts — actionable, threshold-based */}
          {alerts.length > 0 && (
            <div className="space-y-2 mb-4">
              {alerts.map((a, i) => (
                <div key={i} className={`rounded-xl p-3 text-sm ${
                  a.level === 'warn'
                    ? 'bg-[#2a1400] border border-[#5a3a00] text-amber-300'
                    : 'bg-[#0f1a12] border border-[#1d3a2a] text-emerald-300'
                }`}>
                  {a.level === 'warn'
                    ? <AlertTriangle className="w-4 h-4 inline mr-2" />
                    : <Info className="w-4 h-4 inline mr-2" />}
                  {a.detail}
                </div>
              ))}
            </div>
          )}
          {alerts.length === 0 && (
            <div className="bg-[#0f1a12] border border-[#1d3a2a] rounded-xl p-3 text-sm text-emerald-300 mb-4">
              <Activity className="w-4 h-4 inline mr-2" />All monitored systems within normal bounds.
            </div>
          )}

          {/* Traffic */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={<Activity className="w-3.5 h-3.5" />} label="Requests" value={fmt(t.totalRequests)} sub="instrumented endpoints (this instance)" />
            <StatCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Errors" value={fmt(t.errors)} sub={`${t.errorRatePct ?? '—'}% error rate`} tone={t.errorRatePct > 5 ? 'danger' : 'default'} />
            <StatCard icon={<Gauge className="w-3.5 h-3.5" />} label="Avg latency" value={t.avgLatencyMs ? `${t.avgLatencyMs}ms` : '—'} sub={`worst ${t.worstLatencyMs ? t.worstLatencyMs + 'ms' : '—'}`} tone={t.avgLatencyMs > 3000 ? 'warn' : 'default'} />
            <StatCard icon={<Zap className="w-3.5 h-3.5" />} label="Endpoints" value={fmt(t.instrumentedEndpoints)} sub="with request metrics" />
          </div>

          {/* Health + caches + queues */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <StatCard
              icon={<Database className="w-3.5 h-3.5" />}
              label="Database"
              value={db.status === 'ok' ? 'OK' : db.status === 'unconfigured' ? 'N/A' : db.status.toUpperCase()}
              sub={db.latencyMs != null ? `${db.latencyMs}ms probe` : db.error || ''}
              tone={db.status === 'ok' ? 'ok' : db.status === 'degraded' ? 'warn' : 'default'}
            />
            <StatCard icon={<Layers className="w-3.5 h-3.5" />} label="Cache" value={fmt(cache.size)} sub={`${fmt(cache.fresh)} fresh · ${fmt(cache.expired)} expired`} />
            <StatCard icon={<Zap className="w-3.5 h-3.5" />} label="Rate limiter" value={fmt(rl.activeKeys)} sub="active keys (this instance)" />
            <StatCard
              icon={<BellRing className="w-3.5 h-3.5" />}
              label="Notif queue"
              value={queues.status === 'ok' ? fmt(queues.pending) : 'N/A'}
              sub={queues.status === 'ok' ? 'pending items' : 'table unavailable'}
              tone={queues.status === 'ok' && (queues.pending || 0) > 1000 ? 'warn' : 'default'}
            />
          </div>

          {/* Webhooks + growth context */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <StatCard
              icon={<Webhook className="w-3.5 h-3.5" />}
              label="Payment events"
              value={webhooks.status === 'ok' ? fmt((webhooks.pending || 0) + (webhooks.failed || 0)) : 'N/A'}
              sub={webhooks.status === 'ok' ? `${fmt(webhooks.pending)} pending · ${fmt(webhooks.failed)} failed` : 'ledger unavailable'}
              tone={webhooks.status === 'ok' && (webhooks.failed || 0) > 0 ? 'danger' : 'default'}
            />
            <StatCard icon={<Users className="w-3.5 h-3.5" />} label="DAU" value={fmt(growth.dau)} sub="server-validated activity" />
            <StatCard icon={<Users className="w-3.5 h-3.5" />} label="WAU" value={fmt(growth.wau)} sub="North Star context" />
            <StatCard icon={<Users className="w-3.5 h-3.5" />} label="Signups 30d" value={fmt(growth.signups30d)} sub="coarse context only" />
          </div>

          {/* Honest scope note */}
          <Section title="Scope — what this dashboard measures">
            <p className="text-[11px] text-zinc-500 font-mono leading-relaxed">
              Request metrics, cache, and rate-limiter state are <strong className="text-zinc-300">per-instance</strong> (in-memory by
              design on serverless): each function instance reports its own slice. Cross-instance aggregation,
              distributed tracing, and persistent alert history are the documented Stage-B upgrade (Axiom/Grafana) —
              the APIs here are stable so that promotion changes nothing at call sites. Database, queues, and
              payment events are live probes over real tables; every subsystem degrades to &quot;unavailable&quot;
              instead of hiding a failure. No user-level data is ever shown.
            </p>
          </Section>
        </>
      )}
    </main>
  );
}