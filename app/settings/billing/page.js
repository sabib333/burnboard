'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft, CreditCard, RefreshCw, Check, X, Loader2, Gem, AlertTriangle
} from 'lucide-react';

/**
 * /settings/billing — private billing & subscription management (MP15).
 *
 * Shows only the authenticated owner's real entitlements + purchase history
 * from /api/monetization/billing. Cancellation is end-of-period and clearly
 * explained (access continues until the paid period ends — never a trap, and
 * never hidden). Handles ?done / ?error from the checkout redirect.
 */

function timeAgo(dateString) {
  if (!dateString) return '';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  if (diff < 60) return 'just now';
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function expiresLabel(dateString) {
  if (!dateString) return 'Ongoing';
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_LABEL = {
  pending: 'Pending',
  succeeded: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
  disputed: 'Disputed',
  reversed: 'Reversed',
  void: 'Void',
};

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null); // entitlements.key
  const [confirmKey, setConfirmKey] = useState(null);
  const [notice, setNotice] = useState('');

  const done = searchParams?.get('done');
  const errorParam = searchParams?.get('error');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/monetization/billing', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok && res.status === 401) {
        // Redirect to auth for signed-out users.
        window.location.href = '/auth';
        return;
      }
      setData(json);
    } catch {
      setData({ entitlements: [], purchases: [], available: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = useCallback(async (key) => {
    setCancelling(key);
    try {
      const res = await fetch('/api/monetization/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (res.ok) {
        setNotice('Your subscription is set to end after the current paid period. You keep full access until then.');
        setConfirmKey(null);
        await load();
      } else {
        setNotice('Could not cancel right now. Please try again.');
      }
    } catch {
      setNotice('Could not cancel right now. Please try again.');
    } finally {
      setCancelling(null);
    }
  }, [load]);

  const activeEntitlements = (data?.entitlements || []).filter(e => e.status === 'active' || e.status === 'pending' || e.status === 'suspended');
  const history = data?.purchases || [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-6 py-6">
        <header className="flex items-center gap-3">
          <Link href="/settings/profile" className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Settings
          </Link>
          <div className="h-5 w-px bg-[#222]" />
          <p className="text-xs font-mono font-bold text-[#ff4d00]">BILLING & SUBSCRIPTIONS</p>
        </header>

        {done && (
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-300">Payment verified — your access is now active. Thank you for supporting BurnBoard.</p>
          </div>
        )}
        {errorParam && !done && (
          <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-xs text-red-300">That payment could not be completed. No charge was made. Please try again.</p>
          </div>
        )}
        {notice && (
          <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-4 flex items-center gap-3">
            <RefreshCw className="w-4 h-4 text-[#ff4d00] shrink-0" />
            <p className="text-xs text-zinc-300">{notice}</p>
          </div>
        )}

        {data?.testMode && (
          <p className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider border border-amber-400/30 bg-amber-400/10 rounded-full px-3 py-1 inline-flex items-center gap-1.5">
            ⚠️ TEST MODE — sandbox records only
          </p>
        )}

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#ff4d00]" />
          </div>
        ) : !data?.available ? (
          <div className="bg-[#111] border border-dashed border-[#333] rounded-2xl p-10 text-center space-y-3">
            <p className="text-3xl">🔧</p>
            <p className="text-sm font-bold text-zinc-300">Billing isn&apos;t set up on this deployment yet.</p>
            <p className="text-xs text-zinc-500">Once the monetization migration is applied, your purchases and subscriptions will appear here.</p>
          </div>
        ) : (
          <>
            {/* Active memberships */}
            <section className="space-y-3">
              <h2 className="text-xs font-black text-white uppercase tracking-wider font-mono">Your memberships</h2>
              {activeEntitlements.length === 0 ? (
                <div className="bg-[#111] border border-[#222] rounded-2xl p-6 text-center space-y-3">
                  <p className="text-2xl">💎</p>
                  <p className="text-sm font-bold text-zinc-200">You don&apos;t have any active memberships.</p>
                  <p className="text-xs text-zinc-500">Premium adds real value without taking anything away. Safety, privacy, and basic participation stay free.</p>
                  <Link href="/premium" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ff4d00] text-black font-bold text-xs rounded-xl hover:bg-[#ff6622] transition-all">
                    <Gem className="w-4 h-4" />
                    Explore Premium
                  </Link>
                </div>
              ) : (
                activeEntitlements.map(e => (
                  <div key={e.id} className="bg-[#111] border border-[#222] rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white">{e.product?.name || e.key}</p>
                        <p className="text-[11px] font-mono text-zinc-500 mt-0.5">
                          {e.status === 'active' ? 'Active' : e.status}
                          {e.cancelAtPeriodEnd ? ' · cancels at period end' : ''}
                        </p>
                        <p className="text-[10px] font-mono text-zinc-600 mt-1">
                          Access until {expiresLabel(e.currentPeriodEnd)}
                        </p>
                      </div>
                      {e.status === 'active' && !e.cancelAtPeriodEnd && (
                        <button
                          onClick={() => setConfirmKey(confirmKey === e.key ? null : e.key)}
                          className="text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg border border-[#333] text-zinc-400 hover:border-red-500/50 hover:text-red-400 transition-all"
                        >
                          Cancel subscription
                        </button>
                      )}
                    </div>

                    {confirmKey === e.key && (
                      <div className="mt-4 bg-[#0e0e0e] border border-[#2a1a1a] rounded-xl p-4 space-y-3">
                        <p className="text-xs text-zinc-300 leading-relaxed">
                          Cancelling stops future renewals. <span className="text-white font-bold">You keep full access until {expiresLabel(e.currentPeriodEnd)}</span> — no immediate loss, no guilt trip, no hidden surprises.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCancel(e.key)}
                            disabled={cancelling === e.key}
                            className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/40 text-red-300 text-[11px] font-mono font-bold hover:bg-red-500/20 disabled:opacity-50 transition-all"
                          >
                            {cancelling === e.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm — keep access until expiry'}
                          </button>
                          <button
                            onClick={() => setConfirmKey(null)}
                            className="px-3 py-2 rounded-lg text-[11px] font-mono text-zinc-500 hover:text-white transition-all"
                          >
                            Keep my subscription
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>

            {/* Purchase history */}
            <section className="space-y-3">
              <h2 className="text-xs font-black text-white uppercase tracking-wider font-mono">Payment history</h2>
              {history.length === 0 ? (
                <p className="text-xs text-zinc-600 font-mono py-2">No purchases recorded yet.</p>
              ) : (
                <div className="bg-[#111] border border-[#222] rounded-2xl divide-y divide-[#1a1a1a]">
                  {history.map(p => (
                    <div key={p.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{p.product?.name || 'Purchase'}</p>
                        <p className="text-[10px] font-mono text-zinc-600 mt-0.5">{timeAgo(p.createdAt)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-white font-mono">{p.display}</p>
                        <p className={`text-[10px] font-mono ${p.status === 'succeeded' ? 'text-emerald-400' : p.status === 'refunded' || p.status === 'reversed' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                          {(STATUS_LABEL[p.status] || p.status)}
                          {p.testMode ? ' · test' : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <p className="text-[10px] font-mono text-zinc-600 leading-relaxed">
              <CreditCard className="w-3.5 h-3.5 inline mr-1" />
              Payments are verified server-side from provider events — no card data is ever stored by BurnBoard.
            </p>
          </>
        )}
      </div>
    </div>
  );
}