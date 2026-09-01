'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Key, BarChart3, Users, Flame, Database, Trash2, Download, AlertTriangle, Star, TrendingUp, Clock, Eye } from 'lucide-react';
import { getAnalyticsEvents } from '@/lib/analytics';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [events, setEvents] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [roasts, setRoasts] = useState([]);
  const [reports, setReports] = useState([]);
  const [blockedIps, setBlockedIps] = useState([]);
  const [activeTab, setActiveTab] = useState('metrics');
  const [loading, setLoading] = useState(true);

  // Real computed stats
  const [roastsToday, setRoastsToday] = useState(0);
  const [topProfile, setTopProfile] = useState(null);
  const [recentRoasts, setRecentRoasts] = useState([]);

  const loadData = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    try {
      const [profsRes, rstsRes, repsRes, ipsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('roasts').select('*').order('created_at', { ascending: false }),
        supabase.from('reports').select('*').order('created_at', { ascending: false }),
        supabase.from('blocked_ips').select('*').order('created_at', { ascending: false }),
      ]);

      const profs = profsRes.data || [];
      const rsts = rstsRes.data || [];

      setProfiles(profs);
      setRoasts(rsts);
      setReports(repsRes.data || []);
      setBlockedIps(ipsRes.data || []);
      setEvents(getAnalyticsEvents());

      // Compute roasts today
      const today = new Date().toISOString().slice(0, 10);
      const todayRoasts = rsts.filter(r => r.created_at && r.created_at.startsWith(today));
      setRoastsToday(todayRoasts.length);

      // Top profile by roast count
      if (profs.length > 0) {
        const sorted = [...profs].sort((a, b) => (b.roast_count || 0) - (a.roast_count || 0));
        setTopProfile(sorted[0]);
      }

      // Recent roasts (last 10)
      setRecentRoasts(rsts.slice(0, 10));
    } catch (err) {
      console.error('[Admin] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('burnboard_admin_unlocked') === 'true') {
      setAuthenticated(true);
      loadData();
    } else {
      setLoading(false);
    }
  }, []);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (password === 'burn2024') {
      setAuthenticated(true);
      sessionStorage.setItem('burnboard_admin_unlocked', 'true');
      loadData();
    } else {
      alert('Invalid admin password.');
      if (typeof window !== 'undefined') window.location.href = '/';
    }
  };

  const handleExportBackup = () => {
    const backup = {
      timestamp: new Date().toISOString(),
      stats: {
        totalProfiles: profiles.length,
        totalRoasts: roasts.length,
        roastsToday,
        topProfile: topProfile?.username || 'None',
      },
      profiles,
      roasts,
      reports,
      blockedIps,
      events,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `burnboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleDeleteRoast = async (id) => {
    if (!confirm('Delete this roast permanently?')) return;
    if (isSupabaseConfigured && supabase) {
      await supabase.from('roasts').delete().eq('id', id);
    }
    setRoasts(prev => prev.filter(r => r.id !== id));
    setRecentRoasts(prev => prev.filter(r => r.id !== id));
  };

  const handleDeleteProfile = async (id) => {
    if (!confirm('Delete this profile AND all its roasts permanently?')) return;
    if (isSupabaseConfigured && supabase) {
      await supabase.from('roasts').delete().eq('profile_id', id);
      await supabase.from('profiles').delete().eq('id', id);
    }
    setProfiles(prev => prev.filter(p => p.id !== id));
    setRoasts(prev => prev.filter(r => r.profile_id !== id));
  };

  const handleToggleFeature = async (id, currentFeatured) => {
    const nextVal = !currentFeatured;
    if (isSupabaseConfigured && supabase) {
      await supabase.from('profiles').update({ featured: nextVal }).eq('id', id);
    }
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, featured: nextVal } : p));
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 font-mono">
        <form onSubmit={handleUnlock} className="bg-[#111] border border-[#222] p-8 rounded-2xl max-w-sm w-full space-y-4 text-center">
          <Key className="w-10 h-10 text-[#ff4d00] mx-auto" />
          <h1 className="text-lg font-bold">BURNBOARD Admin Console</h1>
          <p className="text-xs text-zinc-400">Restricted access for system moderation & scaling.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-[#0a0a0a] border border-[#333] rounded-xl px-4 py-2.5 text-sm text-center text-white focus:outline-none focus:border-[#ff4d00]"
          />
          <button
            type="submit"
            className="w-full py-2.5 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-bold rounded-xl text-xs uppercase"
          >
            Access Dashboard 🔥
          </button>
        </form>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 font-mono">
        <div className="text-center space-y-3">
          <Flame className="w-8 h-8 text-[#ff4d00] animate-pulse mx-auto" />
          <p className="text-sm text-zinc-400 animate-pulse">Loading admin data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 font-mono max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-[#222] pb-4">
        <div className="flex items-center gap-3">
          <Flame className="w-6 h-6 text-[#ff4d00]" />
          <div>
            <h1 className="text-lg font-bold">BURNBOARD Admin Dashboard</h1>
            <p className="text-xs text-zinc-400">Real data analytics • No fake stats</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1f1610] text-[#ff4d00] border border-[#ff4d00]/30 rounded-xl text-xs font-bold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
          <a href="/" className="text-xs text-zinc-400 hover:text-white">← Return to Feed</a>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-[#111] p-1 rounded-xl border border-[#222]">
        {[
          { id: 'metrics', label: 'Metrics', icon: BarChart3 },
          { id: 'profiles', label: 'Profiles', icon: Users },
          { id: 'roasts', label: 'Roasts', icon: Flame },
          { id: 'events', label: 'Events', icon: Eye },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.id ? 'bg-[#ff4d00] text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* METRICS TAB */}
      {activeTab === 'metrics' && (
        <div className="space-y-4">
          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
              <div className="text-xs text-zinc-500 flex items-center gap-1"><Users className="w-3 h-3" /> Profiles</div>
              <div className="text-2xl font-bold text-white mt-1">{profiles.length}</div>
            </div>
            <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
              <div className="text-xs text-zinc-500 flex items-center gap-1"><Flame className="w-3 h-3" /> Total Roasts</div>
              <div className="text-2xl font-bold text-[#ff4d00] mt-1">{roasts.length}</div>
            </div>
            <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
              <div className="text-xs text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Roasts Today</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{roastsToday}</div>
            </div>
            <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
              <div className="text-xs text-zinc-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Reports</div>
              <div className="text-2xl font-bold text-red-400 mt-1">{reports.length}</div>
            </div>
          </div>

          {/* Top Profile */}
          {topProfile && (
            <div className="bg-gradient-to-r from-[#1c1200] to-[#111] border border-amber-500/30 rounded-xl p-5">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <Star className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Most Roasted Profile (Real Data)</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black ${topProfile.avatar_color || 'bg-[#ff4d00] text-black'}`}>
                    {topProfile.avatar_letter}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">@{topProfile.username}</h3>
                    <p className="text-xs text-zinc-400">{topProfile.platform} • {topProfile.bio}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[#ff4d00]">{topProfile.roast_count || 0}</div>
                  <div className="text-[10px] text-zinc-500">roasts</div>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {profiles.length === 0 && (
            <div className="bg-[#111] border border-dashed border-[#333] rounded-xl p-8 text-center">
              <Flame className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-400 font-bold">No data yet — share your site!</p>
              <p className="text-xs text-zinc-500 mt-1">Profiles and roasts will appear here once users start submitting.</p>
            </div>
          )}
        </div>
      )}

      {/* PROFILES TAB */}
      {activeTab === 'profiles' && (
        <div className="bg-[#111] border border-[#222] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase">All Profiles ({profiles.length})</h2>
          <div className="divide-y divide-[#222] max-h-96 overflow-y-auto">
            {profiles.map(p => (
              <div key={p.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${p.avatar_color || 'bg-[#ff4d00] text-black'}`}>
                    {p.avatar_letter}
                  </div>
                  <div className="min-w-0">
                    <p className="text-zinc-200 font-bold truncate">@{p.username}</p>
                    <span className="text-zinc-500 text-[10px]">{p.platform} • {p.roast_count || 0} roasts • ▲ {p.total_upvotes || 0}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleFeature(p.id, p.featured)}
                    className={`p-1.5 rounded ${p.featured ? 'bg-amber-900/40 text-amber-400' : 'bg-[#1a1a1a] text-zinc-500 hover:text-amber-400'}`}
                    title={p.featured ? 'Unfeature' : 'Feature'}
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteProfile(p.id)}
                    className="p-1.5 bg-red-950/40 text-red-400 rounded hover:bg-red-900/60"
                    title="Delete profile"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {profiles.length === 0 && <p className="text-zinc-500 text-xs py-2">No profiles submitted yet.</p>}
          </div>
        </div>
      )}

      {/* ROASTS TAB */}
      {activeTab === 'roasts' && (
        <div className="bg-[#111] border border-[#222] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase">Recent Roasts ({roasts.length})</h2>
          <div className="divide-y divide-[#222] max-h-96 overflow-y-auto">
            {recentRoasts.map(r => (
              <div key={r.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div className="min-w-0">
                  <p className="text-zinc-200">&ldquo;{r.roast_text}&rdquo;</p>
                  <span className="text-zinc-500 text-[10px]">by {r.anon_id} • ▲ {r.upvotes} upvotes • {r.created_at ? new Date(r.created_at).toLocaleString() : ''}</span>
                </div>
                <button
                  onClick={() => handleDeleteRoast(r.id)}
                  className="p-1.5 bg-red-950/40 text-red-400 rounded hover:bg-red-900/60 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {recentRoasts.length === 0 && <p className="text-zinc-500 text-xs py-2">No roasts found.</p>}
          </div>
        </div>
      )}

      {/* EVENTS TAB */}
      {activeTab === 'events' && (
        <div className="bg-[#111] border border-[#222] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase">Analytics Events ({events.length})</h2>
          <div className="divide-y divide-[#222] max-h-96 overflow-y-auto">
            {events.slice(0, 50).map((evt, i) => (
              <div key={i} className="py-2 text-xs">
                <span className="text-[#ff4d00] font-bold">{evt.event}</span>
                {evt.data && Object.keys(evt.data).length > 0 && (
                  <span className="text-zinc-500 ml-2">{JSON.stringify(evt.data)}</span>
                )}
                <span className="text-zinc-600 ml-2">{evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : ''}</span>
              </div>
            ))}
            {events.length === 0 && <p className="text-zinc-500 text-xs py-2">No analytics events tracked yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
