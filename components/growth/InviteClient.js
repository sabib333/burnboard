'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Gift, Copy, Check, Users, UserPlus, Flame, Sparkles,
  ArrowRight, Loader2, ShieldCheck, Link2, AlertTriangle,
} from 'lucide-react';

/**
 * InviteClient — Referral & Rewards hub (Master Prompt 23, Section 18).
 *
 * Shows the viewer's durable invite link, REAL referral stats (server-
 * validated), and transparent reward rules. Rewards only exist for ACTIVATED
 * referrals — never for raw signups — and are granted idempotently by the
 * server. No fake numbers, no spam incentives.
 */

function StatBox({ icon, label, value, sub }) {
  return (
    <div className="bg-[#111] border border-[#222] rounded-2xl p-4">
      <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-black text-white mt-1">{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{sub}</div>}
    </div>
  );
}

const REWARD_RULES = [
  { icon: '🔥', title: 'Real activation only', text: 'You earn karma when a friend who joined through your link actually activates — follows someone, joins a community, reacts, comments, shares, participates, or creates content within their first 7 days.' },
  { icon: '🏷️', title: 'Transparent value', text: '50 karma per activated friend. Same order of magnitude as creating content — invites are never the dominant way to earn.' },
  { icon: '🛡️', title: 'No spam, no farms', text: 'Maximum 10 rewards per month, and self-referrals, fake accounts, and mass invites earn nothing. Rewards are verified server-side.' },
];

export default function InviteClient() {
  const [code, setCode] = useState(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [summary, setSummary] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [refRes, rewardsRes] = await Promise.all([
        fetch('/api/referral', { cache: 'no-store' }),
        fetch('/api/referral/rewards', { cache: 'no-store' }),
      ]);

      if (refRes.ok) {
        const refData = await refRes.json();
        if (refData.code) {
          setCode(refData.code);
          setInviteUrl(refData.inviteUrl || '');
        }
      }

      if (rewardsRes.ok) {
        const rewardsData = await rewardsRes.json();
        setSummary(rewardsData.summary || null);
      } else {
        // Rewards are best-effort; the invite link itself is the core value.
        setSummary(null);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load invite details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(inviteUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // No-op: copying is best-effort.
    }
  };

  const shareText = `🔥 Join me on BurnBoard — real humans, no filter. ${inviteUrl}`;

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share && inviteUrl) {
      try {
        await navigator.share({ title: 'BurnBoard 🔥', text: shareText, url: inviteUrl });
        return;
      } catch {
        // Fall through to copy.
      }
    }
    handleCopy();
  };

  const recent = summary?.recent || [];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-mono">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#222] pb-4">
          <a href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs">
            <span className="text-lg">←</span>
            <span>BURN BOARD</span>
          </a>
          <div className="flex items-center gap-2 text-[#ff4d00] font-mono font-black text-sm">
            <Gift className="w-4 h-4" />
            <span>INVITE & EARN</span>
          </div>
        </header>

        {error && (
          <div className="bg-[#2a0a0a] border border-[#5a1a1a] rounded-2xl p-4 text-sm text-red-400">
            <AlertTriangle className="w-4 h-4 inline mr-2" />{error}
          </div>
        )}

        {/* Hero + invite link */}
        <section className="bg-gradient-to-br from-[#1a0f05] to-[#111] border border-[#ff4d00]/20 rounded-3xl p-6 sm:p-8 space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
              Bring your people<span className="text-[#ff4d00]">.</span>
            </h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Share your link. When a friend joins <strong className="text-zinc-200">and actually activates</strong> —
              follows, joins a community, reacts, comments, or creates — you earn{' '}
              <strong className="text-[#ff4d00]">50 karma</strong>. Real users only. No spam. No shortcuts.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-xs py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Preparing your invite link…
            </div>
          ) : code ? (
            <>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 flex items-center gap-2 bg-black border border-[#262626] rounded-xl px-3 py-3 min-w-0">
                  <Link2 className="w-4 h-4 text-[#ff4d00] shrink-0" />
                  <span className="text-xs text-zinc-300 truncate">{inviteUrl}</span>
                </div>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
                    copied
                      ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-400'
                      : 'bg-[#ff4d00] hover:bg-[#ff6622] text-black'
                  }`}
                  aria-label="Copy invite link"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleNativeShare}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#111] hover:bg-[#1a1a1a] border border-[#333] hover:border-[#ff4d00]/50 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                >
                  <Sparkles className="w-4 h-4" /> Share
                </button>
                <span className="text-[10px] text-zinc-500">
                  Your code: <span className="text-zinc-300">{code}</span>
                </span>
              </div>
            </>
          ) : (
            <p className="text-zinc-500 text-xs py-4">Invite link unavailable right now — try again in a moment.</p>
          )}
        </section>

        {/* Honest stats */}
        <section className="space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-widest text-[#ff4d00]">Your real invite stats</h2>
          {summary ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBox icon={<Users className="w-3.5 h-3.5" />} label="Visits" value={summary.visits ?? '—'} sub="people who opened your link" />
              <StatBox icon={<UserPlus className="w-3.5 h-3.5" />} label="Joined" value={summary.conversions ?? '—'} sub="signed up through your link" />
              <StatBox icon={<Flame className="w-3.5 h-3.5" />} label="Activated" value={summary.activatedConversions ?? '—'} sub="real first-value friends" />
              <StatBox icon={<Gift className="w-3.5 h-3.5" />} label="Karma earned" value={summary.karmaEarned ?? '—'} sub={`${summary.rewardsGranted ?? 0} rewards granted`} />
            </div>
          ) : (
            <div className="bg-[#111] border border-[#222] rounded-2xl p-6 text-center text-zinc-500 text-xs">
              Stats appear here once people start joining through your link.
            </div>
          )}
        </section>

        {/* Recent rewards */}
        {recent.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-mono uppercase tracking-widest text-[#ff4d00]">Recent rewards</h2>
            <div className="bg-[#111] border border-[#222] rounded-2xl divide-y divide-[#222]">
              {recent.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 text-xs">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <span>🔥</span>
                    <span>@{r.referred_username || 'friend'} activated</span>
                  </div>
                  <div className="text-[#ff4d00] font-black">
                    +{r.reward_amount} karma
                    <span className="text-zinc-600 font-normal ml-2">
                      {new Date(r.granted_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Transparent rules */}
        <section className="space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-widest text-[#ff4d00]">How it works — no fine print</h2>
          <div className="space-y-3">
            {REWARD_RULES.map((rule, i) => (
              <div key={i} className="bg-[#111] border border-[#222] rounded-2xl p-4 flex gap-3">
                <span className="text-lg shrink-0">{rule.icon}</span>
                <div>
                  <div className="text-xs font-bold text-zinc-200">{rule.title}</div>
                  <div className="text-[11px] text-zinc-500 leading-relaxed mt-0.5">{rule.text}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-zinc-600 pt-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Rewards are verified server-side and capped. No fake accounts, no purchased engagement, no dark patterns — ever.
          </div>
        </section>

        {/* CTA back to product */}
        <section className="pt-2">
          <a
            href="/home"
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(255,77,0,0.4)]"
          >
            Back to the feed <ArrowRight className="w-4 h-4" />
          </a>
        </section>
      </div>
    </main>
  );
}