'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, HeartHandshake, Activity, AlertTriangle, RefreshCw,
  MessagesSquare, Bell, ShieldBan, Shield, Share2, Sprout, Info, Network,
} from 'lucide-react';
import { useAdminAuth } from '@/components/admin/useAdminAuth';
import AdminAccessLock from '@/components/admin/AdminAccessLock';

/**
 * /admin/social — Social Network Health Dashboard (Master Prompt 28)
 *
 * Aggregate health of the social layer: the follow graph, new-user social
 * activation (first connection), community ecosystem, conversations,
 * notification (return-loop) engine, and social boundaries. Computed from
 * real rows only — every number is labeled with what it measures and its
 * limits. No fabricated engagement, no private user data.
 * Protected by the shared admin gate.
 */

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

function pct(n) {
  if (n === null || n === undefined) return '—';
  return `${Number(n)}%`;
}

export default function AdminSocialPage() {
  const { authenticated, secret, busy, error: gateError, unlock } = useAdminAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/social', {
        headers: { 'x-admin-password': secret },
        cache: 'no-store',
      });
      if (!res.ok) {
        setError(`Social health endpoint returned ${res.status}`);
        setData(null);
        return;
      }
      setData(await res.json());
    } catch (err) {
      setError(err?.message || 'Failed to load social health data');
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
      <AdminAccessLock title="Social Network Health" busy={busy} error={gateError} onSubmit={unlock} />
    );
  }

  const alerts = data?.alerts || [];
  const s = data?.social || {};
  const g = s?.graph?.graph;
  const a = s?.activation?.cohort;
  const c = s?.communities?.communities;
  const cv = s?.conversations?.conversations;
  const nn = s?.notifications?.notifications;
  const bb = s?.boundaries?.boundaries;

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-[#ff4d00]" />
          <h1 className="font-black text-xl">Social Network Health</h1>
          <span className="text-[11px] font-mono text-zinc-500">
            {data ? `updated ${data.generatedAt?.slice(11, 19)} UTC · ${data.windowDays || 7}d window · ${fmt(data.userTotal)} accounts` : 'loading…'}
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
        <div className="text-zinc-500 text-sm font-mono">Loading…</div>
      )}

      {/* Per-subsystem availability banner */}
      {data && (
        <div className="bg-[#0a0a0e] border border-[#1d1d23] rounded-xl p-4 text-[12px] text-zinc-400 mb-4 font-mono flex flex-wrap gap-x-4 gap-y-1">
          <span>Graph: {s?.graph?.available ? 'ok' : `unavailable (${s?.graph?.reason || 'no service key'})`}</span>
          <span>Activation: {s?.activation?.available ? 'ok' : `unavailable (${s?.activation?.reason || 'no service key'})`}</span>
          <span>Communities: {s?.communities?.available ? 'ok' : `unavailable (${s?.communities?.reason || 'no service key'})`}</span>
          <span>Conversations: {s?.conversations?.available ? 'ok' : `unavailable (${s?.conversations?.reason || 'no service key'})`}</span>
          <span>Notifications: {s?.notifications?.available ? 'ok' : `unavailable (${s?.notifications?.reason || 'no service key'})`}</span>
          <span>Boundaries: {s?.boundaries?.available ? 'ok' : `unavailable (${s?.boundaries?.reason || 'no service key'})`}</span>
          {!data.userTotal && <span>Accounts: unknown (user_profiles unreadable)</span>}
        </div>
      )}

      {data && (
        <>
          {/* Computed alerts */}
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
          {alerts.length === 0 && g && (
            <div className="bg-[#0f1a12] border border-[#1d3a2a] rounded-xl p-3 text-sm text-emerald-300 mb-4">
              <Activity className="w-4 h-4 inline mr-2" />No social health alerts in the window.
            </div>
          )}

          {/* Follow graph */}
          <Section title="Follow graph (edges created)">
            {g ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={<HeartHandshake className="w-3.5 h-3.5" />} label="Total edges" value={fmt(g.totalEdges)} sub="follow relationships" />
                <StatCard icon={<Activity className="w-3.5 h-3.5" />} label="New follows 7d" value={fmt(g.edges7d)} sub={`${fmt(g.edges24h)} in last 24h`} />
                <StatCard icon={<Users className="w-3.5 h-3.5" />} label="Gained a follower" value={fmt(g.accountsGainingFollowers7d)} sub="distinct accounts, 7d" />
                <StatCard icon={<Users className="w-3.5 h-3.5" />} label="Started following" value={fmt(g.accountsStartingToFollow7d)} sub="distinct accounts, 7d" />
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500 font-mono">Follow graph unavailable.</p>
            )}
            <p className="mt-3 text-[11px] text-zinc-600 font-mono">
              Unfollows are deleted rows (no tombstone), so only edge creation is measurable — never net growth.
              The 7d account counts come from a bounded read of up to 5,000 recent edges.
            </p>
          </Section>

          {/* Activation cohort */}
          <Section title={`New-user social activation (newest ${fmt(a?.sampleSize)} accounts, ≤ ${s?.activation?.lookbackDays || 90}d old)`}>
            {a && a.sampleSize > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  icon={<Users className="w-3.5 h-3.5" />}
                  label="Followed someone"
                  value={pct(a.followingSharePct)}
                  sub="first-connection rate"
                  tone={a.followingSharePct < 25 ? 'warn' : 'ok'}
                />
                <StatCard icon={<Sprout className="w-3.5 h-3.5" />} label="Followed within 7d" value={pct(a.firstFollowWithin7dSharePct)} sub="of those who follow" />
                <StatCard icon={<HeartHandshake className="w-3.5 h-3.5" />} label="Got a follow-back" value={pct(a.reciprocalFollowSharePct)} sub="of those who follow" tone={a.reciprocalFollowSharePct < 15 ? 'warn' : 'ok'} />
                <StatCard icon={<Network className="w-3.5 h-3.5" />} label="Joined a community" value={pct(a.communityJoinSharePct)} sub={`${pct(a.firstCommunityJoinWithin7dSharePct)} joined within 7d`} />
                <StatCard icon={<Activity className="w-3.5 h-3.5" />} label="Created content" value={pct(a.createdContentSharePct)} sub="posted something" />
                <StatCard icon={<MessagesSquare className="w-3.5 h-3.5" />} label="Commented" value={pct(a.commentedSharePct)} sub="entered a conversation" />
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500 font-mono">
                {a && a.sampleSize === 0
                  ? 'No accounts created within the lookback window yet.'
                  : 'Activation cohort unavailable.'}
              </p>
            )}
            <p className="mt-3 text-[11px] text-zinc-600 font-mono">
              "First connection" is measured on real rows: the newest {fmt(a?.sampleSize)} accounts in the last {s?.activation?.lookbackDays || 90} days,
              checked for actual follow edges, community memberships, posts, and comments. Follow-backs are exact presence checks
              bounded to each account's first 200 outgoing follows — a sample, not a census.
            </p>
          </Section>

          {/* Community ecosystem */}
          <Section title="Community ecosystem">
            {c ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={<Network className="w-3.5 h-3.5" />} label="Active communities" value={fmt(c.total)} sub={`${fmt(c.publicCount)} public · ${fmt(c.privateCount)} private`} />
                <StatCard icon={<Sprout className="w-3.5 h-3.5" />} label="New communities" value={fmt(c.new7d)} sub={`${fmt(c.new30d)} in 30d`} />
                <StatCard icon={<Users className="w-3.5 h-3.5" />} label="Joins 7d" value={fmt(c.joins7d)} sub={`${fmt(c.distinctJoiners7d)} distinct joiners · ${fmt(c.joins30d)} in 30d`} />
                <StatCard icon={<Activity className="w-3.5 h-3.5" />} label="With posts 7d" value={fmt(c.communitiesWithPosts7d)} sub="received visible posts" />
                <StatCard icon={<Shield className="w-3.5 h-3.5" />} label="Owners" value={fmt(c.owners)} sub="active community owners" />
                <StatCard icon={<Shield className="w-3.5 h-3.5" />} label="Moderators" value={fmt(c.moderators)} sub="active moderators" />
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500 font-mono">Community data unavailable.</p>
            )}
            <p className="mt-3 text-[11px] text-zinc-600 font-mono">
              Leaves are deleted rows and member churn has no timestamp — only joins are measurable.
              "With posts 7d" counts distinct communities that received visible posts in the window.
            </p>
          </Section>

          {/* Conversations */}
          <Section title="Conversations (meaningful vs light)">
            {cv ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={<MessagesSquare className="w-3.5 h-3.5" />} label="Comments 7d" value={fmt(cv.comments7d)} sub={`${fmt(cv.comments24h)} in last 24h`} />
                <StatCard icon={<Users className="w-3.5 h-3.5" />} label="Commenters 7d" value={fmt(cv.distinctCommenters7d)} sub={`${fmt(cv.distinctThreads7d)} threads`} />
                <StatCard icon={<Activity className="w-3.5 h-3.5" />} label="Replies 7d" value={fmt(cv.replies7d)} sub={`${pct(cv.replySharePct)} of comments are replies`} tone={cv.comments7d > 0 && cv.replySharePct < 10 ? 'warn' : 'ok'} />
                <StatCard icon={<Share2 className="w-3.5 h-3.5" />} label="One-tap reactions" value={fmt(cv.lightReactions7d)} sub={`${fmt(cv.reactionsPerComment)} per comment (proxy)`} />
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500 font-mono">Conversation data unavailable.</p>
            )}
            <p className="mt-3 text-[11px] text-zinc-600 font-mono">
              Comments and replies are the meaningful-interaction signal; reactions are one-tap (light).
              Depth is proxied by the reply share of comments — a trend indicator, not a satisfaction measure.
            </p>
          </Section>

          {/* Return-loop engine */}
          <Section title="Return-loop engine (notifications)">
            {nn ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard icon={<Bell className="w-3.5 h-3.5" />} label="Delivered 7d" value={fmt(nn.delivered7d)} sub={`${fmt(nn.delivered24h)} in last 24h`} />
                <StatCard icon={<Bell className="w-3.5 h-3.5" />} label="Unread now" value={fmt(nn.unreadTotal)} sub="pull for return" />
                <div className="bg-[#101014] border border-[#26262c] rounded-xl p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Top types 7d</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono mt-1 space-y-0.5">
                    {(nn.topTypes7d || []).map((t) => (
                      <div key={t.type} className="flex justify-between gap-3">
                        <span>{t.type}</span>
                        <span className="text-zinc-500">{fmt(t.count)}</span>
                      </div>
                    ))}
                    {(nn.topTypes7d || []).length === 0 && <span>none recorded</span>}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500 font-mono">Notification data unavailable.</p>
            )}
            <p className="mt-3 text-[11px] text-zinc-600 font-mono">
              Notifications are the daily-return signal — they are deduped and preference-gated before delivery,
              and the safety gate suppresses delivery from muted/blocked actors, so volume reflects genuinely allowed events.
            </p>
          </Section>

          {/* Boundaries */}
          <Section title="Social boundaries (blocks / mutes)">
            {bb ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={<ShieldBan className="w-3.5 h-3.5" />} label="Blocks 7d" value={fmt(bb.blocks7d)} sub={`${fmt(bb.blocks30d)} in 30d`} tone={bb.blocks7d > 0 ? 'warn' : 'ok'} />
                <StatCard icon={<ShieldBan className="w-3.5 h-3.5" />} label="Mutes 7d" value={fmt(bb.mutes7d)} sub={`${fmt(bb.mutes30d)} in 30d`} />
                <StatCard icon={<Users className="w-3.5 h-3.5" />} label="Blocking users 7d" value={fmt(bb.distinctBlockers7d)} sub="distinct accounts" />
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500 font-mono">Boundary data unavailable.</p>
            )}
            <p className="mt-3 text-[11px] text-zinc-600 font-mono">
              Boundaries are healthy user control — a spike relative to new follows (see alerts) is the signal to
              investigate possible harassment amplification, never a reason to penalize the users who block.
            </p>
          </Section>

          {/* Honest scope note */}
          <div className="mt-6">
            <div className="bg-[#0a0a0e] border border-[#1d1d23] rounded-xl p-4">
              <p className="text-[11px] text-zinc-500 font-mono leading-relaxed flex items-start gap-2">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Every figure is computed from real rows — nothing is fabricated. Activation cohorts and follow-back
                  presence are bounded samples and are labeled as such. Unfollows and community leaves are deleted rows
                  (no tombstones), so churn is not measurable from this schema. This is the observability layer for the
                  social graph (docs/social/SOCIAL_HEALTH.md); it feeds decisions on connection, community, and
                  conversation flows. All data shown is aggregate-only — no individual users, no relationship details.
                </span>
              </p>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
