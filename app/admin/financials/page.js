'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet, Activity, AlertTriangle, RefreshCw,
  TrendingUp, ShieldCheck, CircleDollarSign, FileWarning,
} from 'lucide-react';
import { useAdminAuth } from '@/components/admin/useAdminAuth';
import AdminAccessLock from '@/components/admin/AdminAccessLock';

/**
 * /admin/financials — Financial Observability Dashboard (Master Prompt 19)
 *
 * Read-only aggregate view over the append-only financial ledger
 * (server-side at /api/admin/financials). Shows ledger health checks,
 * payment event state, payout state, and recent revenue snapshots.
 * No user-level financial data is ever shown.
 * Protected by the shared admin gate (MP26): server-verified, no embedded secret.
 */

function StatCard({ icon, label, value, sub, tone = 'default' }) {
  const tones = {
    default: '',
    warn: 'text-amber-400',
    danger: 'text-red-400',
    ok: 'text-emerald-400',
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

function formatMinor(minor) {
  const n = Number(minor) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100);
}

export default function AdminFinancialsPage() {
  const { authenticated, secret, busy, error: gateError, unlock } = useAdminAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchFinancials = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/financials', {
        headers: { 'x-admin-password': secret },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load financial data');
      setData(await res.json());
    } catch (e) {
      setError(e.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated && secret) fetchFinancials();
  }, [authenticated, secret, fetchFinancials]);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0c]">
        <AdminAccessLock title="Admin Financials" busy={busy} error={gateError} onSubmit={unlock} />
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-zinc-500 font-mono text-sm">
        Loading financial state…
      </div>
    );
  }

  const latest = data?.latestSnapshot || null;
  const totals = latest?.totals || [];
  const lastTotals = totals[totals.length - 1] || {};
  const byType = latest?.by_type || [];
  const payouts = latest?.payouts || {};
  const paymentHealth = latest?.payment_health || {};
  const checks = data?.checks || [];

  const drift = checks.find(c => c.kind === 'entitlement_drift');
  const stuckEvents = checks.find(c => c.kind === 'pending_events_24h');
  const failedEvents = checks.find(c => c.kind === 'failed_events_total');
  const payoutsPending = checks.find(c => c.kind === 'payouts_pending');
  const audit24h = checks.find(c => c.kind === 'audit_24h');

  const todayGross = lastTotals.gross_minor || 0;
  const todayNet = lastTotals.net_minor || 0;
  const todayRefunds = lastTotals.refunded_minor || 0;

  return (
    <div className="min-h-screen bg-[#0a0a0c] p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-400">
            <CircleDollarSign className="w-5 h-5" />
            <h1 className="text-lg font-black text-white">Financial Observability</h1>
          </div>
          <button
            onClick={fetchFinancials}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg px-4 py-2 text-xs font-semibold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/40 border border-red-900 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        {!data?.available && (
          <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-950/30 border border-amber-900 rounded-lg px-4 py-3">
            <FileWarning className="w-4 h-4" />
            Monetization ledger unavailable — has the monetization migration been applied?
          </div>
        )}

        {/* Revenue today */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={<TrendingUp className="w-3.5 h-3.5" />} label="Gross today" value={formatMinor(todayGross)} sub="succeeded purchases" />
          <StatCard icon={<Wallet className="w-3.5 h-3.5" />} label="Net today" value={formatMinor(todayNet)} sub="after platform + processing fees" />
          <StatCard icon={<Activity className="w-3.5 h-3.5" />} label="Refunded today" value={formatMinor(Math.abs(todayRefunds))} sub="adjustments" tone={todayRefunds < 0 ? 'warn' : 'default'} />
          <StatCard icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Snapshot days" value={data?.snapshotDates?.length || 0} sub="history persisted" />
        </div>

        {/* Health checks */}
        <div>
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-3">Ledger health</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={<FileWarning className="w-3.5 h-3.5" />}
              label="Entitlement drift"
              value={drift?.value ?? '—'}
              sub="succeeded purchases missing entitlement"
              tone={Number(drift?.value) > 0 ? 'danger' : 'ok'}
            />
            <StatCard
              icon={<Activity className="w-3.5 h-3.5" />}
              label="Stuck events"
              value={stuckEvents?.value ?? '—'}
              sub="webhook events > 24h unprocessed"
              tone={Number(stuckEvents?.value) > 0 ? 'warn' : 'ok'}
            />
            <StatCard
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
              label="Failed events"
              value={failedEvents?.value ?? '—'}
              sub="webhook events failed processing"
              tone={Number(failedEvents?.value) > 0 ? 'danger' : 'ok'}
            />
            <StatCard
              icon={<Wallet className="w-3.5 h-3.5" />}
              label="Pending payouts"
              value={payoutsPending?.value ?? '—'}
              sub="not yet provider-confirmed"
              tone={Number(payoutsPending?.value) > 0 ? 'warn' : 'ok'}
            />
          </div>
        </div>

        {/* Payment + payout state */}
        <div>
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-3">Pipeline state</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={<Activity className="w-3.5 h-3.5" />} label="Events 24h" value={paymentHealth.received_24h ?? '—'} sub="received" />
            <StatCard icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Processed total" value={paymentHealth.processed_total ?? '—'} sub="verified events" />
            <StatCard icon={<Wallet className="w-3.5 h-3.5" />} label="Paid out" value={formatMinor(payouts.paid_minor || 0)} sub="lifetime, confirmed" />
            <StatCard icon={<Activity className="w-3.5 h-3.5" />} label="Audit actions 24h" value={audit24h?.value ?? '—'} sub="financial audit log" />
          </div>
        </div>

        {/* Revenue by product type */}
        {byType.length > 0 && (
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-3">Revenue by product type</h2>
            <div className="bg-[#101014] border border-[#26262c] rounded-xl p-4 flex flex-col gap-2">
              {byType.map(t => (
                <div key={t.product_type} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300 font-mono">{t.product_type}</span>
                  <div className="flex items-center gap-6">
                    <span className="text-zinc-500 text-xs">{t.count} purchases</span>
                    <span className="text-white font-bold">{formatMinor(t.gross_minor)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 30-day gross trend */}
        {totals.length > 1 && (
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-3">Gross revenue — last 30 days</h2>
            <div className="bg-[#101014] border border-[#26262c] rounded-xl p-4">
              <div className="flex items-end gap-1 h-32">
                {totals.map((t, i) => {
                  const max = Math.max(...totals.map(x => Number(x.gross_minor) || 0), 1);
                  const h = Math.max(4, Math.round((Number(t.gross_minor) || 0) / max * 100));
                  const isToday = i === totals.length - 1;
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-t ${isToday ? 'bg-emerald-500' : 'bg-zinc-700 hover:bg-zinc-600'} transition-colors`}
                      style={{ height: `${h}%` }}
                      title={`${t.day}: ${formatMinor(t.gross_minor)}`}
                    />
                  );
                })}
              </div>
              <div className="text-[10px] text-zinc-600 font-mono mt-2">each bar = one day (hover for amount)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}