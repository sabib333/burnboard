'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Code2, Plus, KeyRound, Globe, ShieldCheck, Link2 } from 'lucide-react';

/**
 * /developer — Developer Portal (Master Prompt 20)
 *
 * Register applications, issue credentials, and configure webhook
 * endpoints. First-party, session-authenticated surface (API routes resolve
 * the session server-side). Secrets (client secret, webhook signing secret)
 * are shown EXACTLY ONCE after generation — refresh the list and they are
 * gone, matching the hash-at-rest storage model.
 */

const STATUS_LABELS = {
  development: 'In development',
  review: 'Under review',
  approved: 'Approved',
  limited: 'Limited',
  suspended: 'Suspended',
  revoked: 'Revoked',
};

const EVENT_TYPES = ['content.published', 'app.access_granted', 'app.access_revoked'];

function StatusBadge({ status }) {
  const color = {
    approved: 'text-emerald-400 border-emerald-900 bg-emerald-950/40',
    development: 'text-sky-400 border-sky-900 bg-sky-950/40',
    review: 'text-amber-400 border-amber-900 bg-amber-950/40',
    limited: 'text-amber-400 border-amber-900 bg-amber-950/40',
    suspended: 'text-red-400 border-red-900 bg-red-950/40',
    revoked: 'text-zinc-500 border-zinc-800 bg-zinc-900/40',
  }[status] || 'text-zinc-400 border-zinc-800 bg-zinc-900/40';
  return (
    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${color}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export default function DeveloperPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notSignedIn, setNotSignedIn] = useState(false);

  // New app form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [creating, setCreating] = useState(false);

  // One-time secret displays
  const [revealedSecret, setRevealedSecret] = useState(null); // { label, value }
  const [generatingFor, setGeneratingFor] = useState(null);
  const [webhookFor, setWebhookFor] = useState(null); // appId
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState(['content.published']);

  const loadApps = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/platform/dev/apps', { cache: 'no-store' });
      if (res.status === 401) {
        setNotSignedIn(true);
        setApps([]);
        return;
      }
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setApps(json.data || []);
    } catch (e) {
      setError(e.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);

  async function createApp() {
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/platform/dev/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          website: website.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Registration failed');
      setName(''); setDescription(''); setWebsite('');
      await loadApps();
    } catch (e) {
      setError(e.message || 'Registration failed');
    } finally {
      setCreating(false);
    }
  }

  async function issueCredential(appId) {
    setGeneratingFor(appId);
    setError('');
    try {
      const res = await fetch(`/api/platform/dev/apps/${appId}/credential`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment: 'development' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to issue');
      setRevealedSecret({
        label: 'Client secret (shown once)',
        value: json.clientSecret,
      });
      await loadApps();
    } catch (e) {
      setError(e.message || 'Failed to issue credential');
    } finally {
      setGeneratingFor(null);
    }
  }

  async function registerWebhook(appId) {
    if (!webhookUrl.trim()) return;
    setError('');
    try {
      const res = await fetch(`/api/platform/dev/apps/${appId}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl.trim(),
          event_types: webhookEvents,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to register');
      setRevealedSecret({
        label: 'Webhook signing secret (shown once)',
        value: json.signingSecret,
      });
      setWebhookFor(null);
      setWebhookUrl('');
    } catch (e) {
      setError(e.message || 'Failed to register webhook');
    }
  }

  if (notSignedIn) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-6">
        <div className="bg-[#101014] border border-[#26262c] rounded-2xl p-8 max-w-md w-full text-center">
          <Code2 className="w-8 h-8 text-zinc-500 mx-auto mb-4" />
          <h1 className="text-white font-black text-lg mb-2">Developer Portal</h1>
          <p className="text-zinc-400 text-sm mb-6">Sign in to register applications and manage credentials.</p>
          <a href="/login" className="inline-block bg-[#ff4d00] text-black font-bold rounded-lg px-6 py-2 text-sm">
            Sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-400">
            <Code2 className="w-5 h-5" />
            <h1 className="text-lg font-black text-white">Developer Portal</h1>
          </div>
          <a href="/" className="text-xs text-zinc-400 hover:text-white">← Back to BurnBoard</a>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded-lg px-4 py-3">{error}</div>
        )}

        {revealedSecret && (
          <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-4">
            <p className="text-emerald-300 text-xs font-mono mb-2">{revealedSecret.label} — copy it now, it will not be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black/40 rounded-lg px-3 py-2 text-emerald-200 text-xs break-all">{revealedSecret.value}</code>
              <button
                onClick={() => { navigator.clipboard?.writeText(revealedSecret.value); }}
                className="bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg px-3 py-2 text-xs font-bold"
              >
                Copy
              </button>
              <button
                onClick={() => setRevealedSecret(null)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg px-3 py-2 text-xs"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Register app */}
        <div className="bg-[#101014] border border-[#26262c] rounded-xl p-5">
          <h2 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-zinc-500" /> Register an application
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="App name"
              className="bg-[#18181c] border border-[#26262c] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-zinc-500" />
            <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="Website (https://…)"
              className="bg-[#18181c] border border-[#26262c] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-zinc-500" />
          </div>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does your app do? (shown to users when requesting access)"
            className="w-full mt-3 bg-[#18181c] border border-[#26262c] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-zinc-500 min-h-[70px] resize-none" />
          <button onClick={createApp} disabled={creating || !name.trim()}
            className="mt-3 bg-[#ff4d00] disabled:opacity-40 text-black font-bold rounded-lg px-4 py-2 text-sm">
            {creating ? 'Registering…' : 'Register app'}
          </button>
          <p className="text-[11px] text-zinc-500 mt-2">
            New apps start in <span className="text-sky-400 font-mono">development</span>. The platform review
            process approves scopes and production status.
          </p>
        </div>

        {/* My apps */}
        <div>
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-3">My applications</h2>
          {loading && <p className="text-zinc-500 text-sm">Loading…</p>}
          {!loading && apps.length === 0 && (
            <p className="text-zinc-500 text-sm bg-[#101014] border border-[#26262c] rounded-xl p-5">
              No applications yet. Register one above to get started.
            </p>
          )}
          <div className="flex flex-col gap-3">
            {apps.map(app => (
              <div key={app.id} className="bg-[#101014] border border-[#26262c] rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-bold text-sm">{app.name}</h3>
                      <StatusBadge status={app.status} />
                      {app.kill_switch && <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-red-900 bg-red-950/40 text-red-400">kill-switched</span>}
                    </div>
                    <p className="text-zinc-500 text-xs mt-1">{app.description || 'No description'}</p>
                    {app.website && (
                      <p className="text-zinc-600 text-xs mt-1 flex items-center gap-1">
                        <Globe className="w-3 h-3" /> {app.website}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => issueCredential(app.id)} disabled={generatingFor === app.id}
                      className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
                      <KeyRound className="w-3.5 h-3.5" />
                      {generatingFor === app.id ? '…' : 'New credential'}
                    </button>
                    <button onClick={() => setWebhookFor(webhookFor === app.id ? null : app.id)}
                      className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold">
                      <Link2 className="w-3.5 h-3.5" /> Webhook
                    </button>
                  </div>
                </div>

                {/* Approved scopes */}
                <div className="flex flex-wrap gap-1.5">
                  {(app.allowed_scopes || []).length === 0 ? (
                    <span className="text-[10px] text-zinc-600 font-mono">No scopes approved yet — under platform review</span>
                  ) : (
                    app.allowed_scopes.map(s => (
                      <span key={s} className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300">
                        {s}
                      </span>
                    ))
                  )}
                </div>

                {/* Credentials summary */}
                {(app.credentials || []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(app.credentials || []).map((c, i) => (
                      <span key={i} className="text-[10px] font-mono text-zinc-500">
                        {c.environment}: <span className="text-zinc-300">{c.prefix}••••</span>
                        {c.revoked ? ' (revoked)' : ''}
                      </span>
                    ))}
                  </div>
                )}

                {/* Webhook registration inline */}
                {webhookFor === app.id && (
                  <div className="border-t border-[#26262c] pt-3 mt-1 flex flex-col gap-2">
                    <p className="text-[11px] text-zinc-400 font-mono uppercase tracking-wider">Register webhook endpoint</p>
                    <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://your-app.example.com/hook (https only)"
                      className="bg-[#18181c] border border-[#26262c] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-zinc-500" />
                    <div className="flex flex-wrap gap-1.5">
                      {EVENT_TYPES.map(evt => (
                        <button key={evt} onClick={() => setWebhookEvents(prev => prev.includes(evt) ? prev.filter(x => x !== evt) : [...prev, evt])}
                          className={`text-[11px] font-mono px-2 py-1 rounded-full border transition-colors ${
                            webhookEvents.includes(evt) ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300' : 'border-zinc-800 text-zinc-500'
                          }`}>
                          {evt}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => registerWebhook(app.id)} disabled={!webhookUrl.trim()}
                      className="self-start bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40">
                      Register webhook
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="text-[11px] text-zinc-600 flex items-center gap-2 pb-8">
          <ShieldCheck className="w-3.5 h-3.5" />
          Secrets are hashed at rest and shown exactly once. Revoke access at any time from your connected apps.
        </div>
      </div>
    </div>
  );
}