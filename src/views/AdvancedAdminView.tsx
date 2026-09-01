/**
 * BURNBOARD Advanced Admin Portal
 *
 * 4 Tabs:
 * 1. Overview — Real counts, graphs, stats
 * 2. Moderation — Profiles, roasts, reports, security logs
 * 3. Users — Search, karma, streak, ban/unban
 * 4. Challenges — Create daily challenges, manage active ones
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Users, Flame, AlertTriangle, BarChart3, Search,
  Ban, Eye, Trash2, Check, X, Loader2, Plus, Target,
  TrendingUp, Clock, FileText, Activity, Crown, EyeOff
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AdminStats {
  totalProfiles: number;
  totalRoasts: number;
  totalUsers: number;
  activeStories: number;
  pendingReports: number;
  totalUpvotes: number;
  roastsPerDay: { date: string; count: number }[];
}

type AdminTab = 'overview' | 'moderation' | 'users' | 'challenges';

export const AdvancedAdminView: React.FC<{ onShowToast: (t: string, s?: string, type?: string) => void }> = ({ onShowToast }) => {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckDone, setAdminCheckDone] = useState(false);

  // Stats
  const [stats, setStats] = useState<AdminStats>({
    totalProfiles: 0, totalRoasts: 0, totalUsers: 0,
    activeStories: 0, pendingReports: 0, totalUpvotes: 0,
    roastsPerDay: [],
  });

  // Moderation
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roasts, setRoasts] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [selectedRoasts, setSelectedRoasts] = useState<Set<string>>(new Set());

  // Users
  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers] = useState<any[]>([]);

  // Challenges
  const [challenges, setChallenges] = useState<any[]>([]);
  const [newChallenge, setNewChallenge] = useState({ title: '', description: '', reward_karma: 10, type: 'roast' as string });

  // ── Admin Check ────────────────────────────────────────────
  useEffect(() => {
    const checkAdmin = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setAdminCheckDone(true);
        return;
      }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setAdminCheckDone(true); return; }

        const adminEmail = (import.meta as any).env?.VITE_ADMIN_EMAIL || '';
        if (user.email === adminEmail) {
          setIsAdmin(true);
          setAdminCheckDone(true);
          return;
        }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        if (profile?.username === 'admin') {
          setIsAdmin(true);
        }
      } catch {}
      setAdminCheckDone(true);
    };
    checkAdmin();
  }, []);

  // ── Load Data ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setLoading(true);

    try {
      // Parallel fetch all stats
      const [profilesRes, roastsRes, usersRes, storiesRes, reportsRes, logsRes, challengesRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('roasts').select('id, upvotes', { count: 'exact' }),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('stories').select('id', { count: 'exact', head: true }).gt('expires_at', new Date().toISOString()),
        supabase.from('reports').select('*, roasts!inner(roast_text, profiles!inner(username))').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('security_logs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('challenges').select('*').order('created_at', { ascending: false }).limit(20),
      ]);

      const totalUpvotes = (roastsRes.data || []).reduce((sum: number, r: any) => sum + (r.upvotes || 0), 0);

      // Roasts per day (last 7 days)
      const { data: recentRoasts } = await supabase
        .from('roasts')
        .select('created_at')
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());

      const roastsPerDay = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.now() - (6 - i) * 86400000);
        const dateStr = d.toISOString().slice(0, 10);
        const count = (recentRoasts || []).filter((r: any) => r.created_at?.startsWith(dateStr)).length;
        return { date: dateStr, count };
      });

      setStats({
        totalProfiles: profilesRes.count || 0,
        totalRoasts: roastsRes.count || 0,
        totalUsers: usersRes.count || 0,
        activeStories: storiesRes.count || 0,
        pendingReports: reportsRes.data?.length || 0,
        totalUpvotes,
        roastsPerDay,
      });

      setReports(reportsRes.data || []);
      setSecurityLogs(logsRes.data || []);
      setChallenges(challengesRes.data || []);

      // Load moderation data
      const { data: profilesData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
      setProfiles(profilesData || []);

      const { data: roastsData } = await supabase.from('roasts').select('*, profiles!inner(username)').order('created_at', { ascending: false }).limit(50);
      setRoasts(roastsData || []);

    } catch (err) {
      console.warn('[Admin] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) loadData(); }, [isAdmin, loadData]);

  // ── Admin Gate ─────────────────────────────────────────────
  if (!adminCheckDone) {
    return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="w-6 h-6 text-[#ff4d00] animate-spin" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-5xl">🔒</div>
          <h1 className="text-xl font-bold text-white">404 — Not Found</h1>
          <p className="text-xs text-zinc-400">This page does not exist.</p>
        </div>
      </div>
    );
  }

  // ── Handlers ───────────────────────────────────────────────
  const banProfile = async (id: string) => {
    await supabase.from('profiles').update({ is_banned: true }).eq('id', id);
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, is_banned: true } : p));
    onShowToast('Profile banned');
  };

  const hideRoast = async (id: string) => {
    await supabase.from('roasts').update({ is_hidden: true }).eq('id', id);
    setRoasts(prev => prev.map(r => r.id === id ? { ...r, is_hidden: true } : r));
    onShowToast('Roast hidden');
  };

  const bulkHideRoasts = async () => {
    if (selectedRoasts.size === 0) return;
    const ids = Array.from(selectedRoasts);
    await supabase.from('roasts').update({ is_hidden: true }).in('id', ids);
    setRoasts(prev => prev.map(r => ids.includes(r.id) ? { ...r, is_hidden: true } : r));
    setSelectedRoasts(new Set());
    onShowToast(`${ids.length} roasts hidden`);
  };

  const resolveReport = async (reportId: string, action: 'approve' | 'dismiss') => {
    if (action === 'approve') {
      const report = reports.find(r => r.id === reportId);
      if (report?.roast_id) {
        await supabase.from('roasts').update({ is_hidden: true }).eq('id', report.roast_id);
      }
    }
    await supabase.from('reports').delete().eq('id', reportId);
    setReports(prev => prev.filter(r => r.id !== reportId));
    onShowToast(action === 'approve' ? 'Report approved — roast hidden' : 'Report dismissed');
  };

  const searchUsers = async () => {
    if (!userSearch.trim()) { setUsers([]); return; }
    const { data } = await supabase.from('user_profiles').select('*').ilike('username', `%${userSearch}%`).limit(20);
    setUsers(data || []);
  };

  const toggleUserBan = async (userId: string, currentBanned: boolean) => {
    await supabase.from('user_profiles').update({ is_banned: !currentBanned }).eq('id', userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: !currentBanned } : u));
    onShowToast(currentBanned ? 'User unbanned' : 'User banned');
  };

  const resetKarma = async (userId: string) => {
    await supabase.from('user_profiles').update({ karma: 0, level: 'Newbie' }).eq('id', userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, karma: 0, level: 'Newbie' } : u));
    onShowToast('Karma reset');
  };

  const createChallenge = async () => {
    if (!newChallenge.title.trim()) return;
    const { error } = await supabase.from('challenges').insert({
      title: newChallenge.title.trim(),
      description: newChallenge.description.trim(),
      reward_karma: newChallenge.reward_karma,
      type: newChallenge.type,
    });
    if (!error) {
      setNewChallenge({ title: '', description: '', reward_karma: 10, type: 'roast' });
      const { data } = await supabase.from('challenges').select('*').order('created_at', { ascending: false }).limit(20);
      setChallenges(data || []);
      onShowToast('Challenge created!');
    }
  };

  const deactivateChallenge = async (id: string) => {
    await supabase.from('challenges').update({ is_active: false }).eq('id', id);
    setChallenges(prev => prev.map(c => c.id === id ? { ...c, is_active: false } : c));
    onShowToast('Challenge deactivated');
  };

  // ── Render ─────────────────────────────────────────────────
  const maxRoastsDay = Math.max(1, ...stats.roastsPerDay.map(d => d.count));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-950/40 via-[#111] to-purple-950/40 border border-red-500/30 rounded-2xl p-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center border border-red-500/30">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-black text-white uppercase">Admin Portal</h1>
          <p className="text-[10px] text-zinc-500 font-mono">Full moderation + analytics + challenges</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111] border border-[#222] p-1 rounded-xl">
        {([
          { key: 'overview', icon: BarChart3, label: 'Overview' },
          { key: 'moderation', icon: Shield, label: 'Moderation' },
          { key: 'users', icon: Users, label: 'Users' },
          { key: 'challenges', icon: Target, label: 'Challenges' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all ${tab === t.key ? 'bg-[#ff4d00] text-black' : 'text-zinc-400 hover:text-white'}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-[#ff4d00] animate-spin" /></div>
      ) : (
        <>
          {/* ── TAB: OVERVIEW ─────────────────────────────────── */}
          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Profiles', value: stats.totalProfiles, icon: '🎯', color: 'text-[#ff4d00]' },
                  { label: 'Roasts', value: stats.totalRoasts, icon: '🔥', color: 'text-orange-400' },
                  { label: 'Users', value: stats.totalUsers, icon: '👥', color: 'text-blue-400' },
                  { label: 'Stories', value: stats.activeStories, icon: '📖', color: 'text-purple-400' },
                  { label: 'Reports', value: stats.pendingReports, icon: '🚨', color: 'text-red-400' },
                  { label: 'Upvotes', value: stats.totalUpvotes, icon: '▲', color: 'text-green-400' },
                ].map(s => (
                  <div key={s.label} className="bg-[#111] border border-[#222] rounded-xl p-3 text-center">
                    <span className="text-lg">{s.icon}</span>
                    <div className={`text-xl font-black font-mono ${s.color}`}>{s.value.toLocaleString()}</div>
                    <div className="text-[10px] text-zinc-500 font-mono uppercase">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Roasts per day graph */}
              <div className="bg-[#111] border border-[#222] rounded-2xl p-4">
                <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#ff4d00]" /> Roasts Per Day (Last 7 Days)
                </h3>
                <div className="flex items-end gap-2 h-32">
                  {stats.roastsPerDay.map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-mono text-zinc-400">{day.count}</span>
                      <div className="w-full bg-[#ff4d00] rounded-t-md transition-all" style={{ height: `${(day.count / maxRoastsDay) * 100}%`, minHeight: day.count > 0 ? 4 : 0 }} />
                      <span className="text-[8px] font-mono text-zinc-600">{day.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: MODERATION ──────────────────────────────── */}
          {tab === 'moderation' && (
            <div className="space-y-6">
              {/* Bulk actions */}
              {selectedRoasts.size > 0 && (
                <div className="bg-[#ff4d00]/10 border border-[#ff4d00]/30 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-xs font-mono text-[#ff4d00]">{selectedRoasts.size} roasts selected</span>
                  <button onClick={bulkHideRoasts} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg">Bulk Hide</button>
                </div>
              )}

              {/* Reports Queue */}
              <div className="bg-[#111] border border-[#222] rounded-2xl p-4">
                <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" /> Reports Queue ({reports.length})
                </h3>
                {reports.length === 0 ? (
                  <p className="text-xs text-zinc-500 font-mono text-center py-4">No pending reports</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {reports.map(r => (
                      <div key={r.id} className="p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-zinc-300 line-clamp-1">&ldquo;{r.roasts?.roast_text}&rdquo;</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">Target: @{r.roasts?.profiles?.username} • Reason: {r.reason}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => resolveReport(r.id, 'approve')} className="px-2 py-1 bg-red-600/20 text-red-400 text-[10px] font-bold rounded-lg hover:bg-red-600 hover:text-white">Hide Roast</button>
                          <button onClick={() => resolveReport(r.id, 'dismiss')} className="px-2 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-bold rounded-lg hover:bg-zinc-700">Dismiss</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Profiles Table */}
              <div className="bg-[#111] border border-[#222] rounded-2xl p-4">
                <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase mb-3">Profiles ({profiles.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead><tr className="text-zinc-500 border-b border-[#222]">
                      <th className="text-left py-2 px-2">User</th>
                      <th className="text-left py-2 px-2">Platform</th>
                      <th className="text-right py-2 px-2">Roasts</th>
                      <th className="text-right py-2 px-2">Upvotes</th>
                      <th className="text-right py-2 px-2">Action</th>
                    </tr></thead>
                    <tbody>
                      {profiles.map(p => (
                        <tr key={p.id} className="border-b border-[#1a1a1a] hover:bg-[#161616]">
                          <td className="py-2 px-2 text-white font-bold">{p.username}</td>
                          <td className="py-2 px-2 text-zinc-400">{p.platform}</td>
                          <td className="py-2 px-2 text-right text-zinc-300">{p.roast_count || 0}</td>
                          <td className="py-2 px-2 text-right text-zinc-300">{p.total_upvotes || 0}</td>
                          <td className="py-2 px-2 text-right">
                            {p.is_banned ? (
                              <span className="text-red-400 text-[10px]">BANNED</span>
                            ) : (
                              <button onClick={() => banProfile(p.id)} className="px-2 py-1 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-600 hover:text-white text-[10px] font-bold">Ban</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Roasts Table */}
              <div className="bg-[#111] border border-[#222] rounded-2xl p-4">
                <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase mb-3">Recent Roasts ({roasts.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead><tr className="text-zinc-500 border-b border-[#222]">
                      <th className="text-left py-2 px-2 w-8"><input type="checkbox" onChange={e => { if (e.target.checked) setSelectedRoasts(new Set(roasts.filter(r => !r.is_hidden).map(r => r.id))); else setSelectedRoasts(new Set()); }} /></th>
                      <th className="text-left py-2 px-2">Text</th>
                      <th className="text-left py-2 px-2">Target</th>
                      <th className="text-right py-2 px-2">Upvotes</th>
                      <th className="text-right py-2 px-2">Action</th>
                    </tr></thead>
                    <tbody>
                      {roasts.map(r => (
                        <tr key={r.id} className={`border-b border-[#1a1a1a] ${r.is_hidden ? 'opacity-40' : 'hover:bg-[#161616]'}`}>
                          <td className="py-2 px-2"><input type="checkbox" checked={selectedRoasts.has(r.id)} onChange={() => { const next = new Set(selectedRoasts); if (next.has(r.id)) next.delete(r.id); else next.add(r.id); setSelectedRoasts(next); }} disabled={r.is_hidden} /></td>
                          <td className="py-2 px-2 text-zinc-300 line-clamp-1 max-w-xs">{r.roast_text}</td>
                          <td className="py-2 px-2 text-zinc-400">@{r.profiles?.username}</td>
                          <td className="py-2 px-2 text-right text-zinc-300">{r.upvotes || 0}</td>
                          <td className="py-2 px-2 text-right">
                            {r.is_hidden ? <span className="text-zinc-600 text-[10px]">Hidden</span> : (
                              <button onClick={() => hideRoast(r.id)} className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-red-600 hover:text-white text-[10px] font-bold">Hide</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Security Logs */}
              <div className="bg-[#111] border border-[#222] rounded-2xl p-4">
                <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-zinc-400" /> Security Logs ({securityLogs.length})
                </h3>
                {securityLogs.length === 0 ? (
                  <p className="text-xs text-zinc-500 font-mono text-center py-4">No security logs</p>
                ) : (
                  <div className="overflow-x-auto max-h-48 overflow-y-auto">
                    <table className="w-full text-[10px] font-mono">
                      <thead><tr className="text-zinc-500 border-b border-[#222]">
                        <th className="text-left py-1 px-2">IP Hash</th>
                        <th className="text-left py-1 px-2">Action</th>
                        <th className="text-left py-1 px-2">Details</th>
                        <th className="text-right py-1 px-2">Time</th>
                      </tr></thead>
                      <tbody>
                        {securityLogs.map(l => (
                          <tr key={l.id} className="border-b border-[#1a1a1a]">
                            <td className="py-1 px-2 text-zinc-400">{l.ip_hash?.slice(0, 12)}…</td>
                            <td className="py-1 px-2 text-zinc-300">{l.action}</td>
                            <td className="py-1 px-2 text-zinc-500 line-clamp-1">{JSON.stringify(l.details)?.slice(0, 60)}</td>
                            <td className="py-1 px-2 text-right text-zinc-500">{new Date(l.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: USERS ────────────────────────────────────── */}
          {tab === 'users' && (
            <div className="space-y-4">
              <div className="bg-[#111] border border-[#222] rounded-2xl p-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchUsers()} placeholder="Search users by username..." className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff4d00]" />
                  </div>
                  <button onClick={searchUsers} className="px-4 py-2.5 bg-[#ff4d00] text-black font-bold text-xs rounded-xl">Search</button>
                </div>
              </div>

              {users.length > 0 && (
                <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead><tr className="text-zinc-500 border-b border-[#222]">
                        <th className="text-left py-2 px-3">Username</th>
                        <th className="text-right py-2 px-3">Karma</th>
                        <th className="text-right py-2 px-3">Level</th>
                        <th className="text-right py-2 px-3">Streak</th>
                        <th className="text-right py-2 px-3">Status</th>
                        <th className="text-right py-2 px-3">Actions</th>
                      </tr></thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id} className="border-b border-[#1a1a1a] hover:bg-[#161616]">
                            <td className="py-2 px-3 text-white font-bold">@{u.username}</td>
                            <td className="py-2 px-3 text-right text-amber-400">{u.karma || 0}</td>
                            <td className="py-2 px-3 text-right text-zinc-300">{u.level}</td>
                            <td className="py-2 px-3 text-right text-zinc-400">{u.streak || 0}d</td>
                            <td className="py-2 px-3 text-right">
                              {u.is_banned ? <span className="text-red-400">Banned</span> : <span className="text-green-400">Active</span>}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="flex gap-1 justify-end">
                                <button onClick={() => toggleUserBan(u.id, u.is_banned)} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${u.is_banned ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>{u.is_banned ? 'Unban' : 'Ban'}</button>
                                <button onClick={() => resetKarma(u.id)} className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded-lg text-[10px] font-bold hover:bg-zinc-700">Reset Karma</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {userSearch && users.length === 0 && !loading && (
                <div className="text-center py-8 text-xs text-zinc-500 font-mono">No users found matching &quot;{userSearch}&quot;</div>
              )}
            </div>
          )}

          {/* ── TAB: CHALLENGES ───────────────────────────────── */}
          {tab === 'challenges' && (
            <div className="space-y-4">
              {/* Create Challenge */}
              <div className="bg-[#111] border border-[#222] rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#ff4d00]" /> Create Daily Challenge
                </h3>
                <input type="text" value={newChallenge.title} onChange={e => setNewChallenge(prev => ({ ...prev, title: e.target.value }))} placeholder="e.g. Roast a LinkedIn influencer today" className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff4d00]" />
                <input type="text" value={newChallenge.description} onChange={e => setNewChallenge(prev => ({ ...prev, description: e.target.value }))} placeholder="Description (optional)" className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff4d00]" />
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-zinc-500 font-mono mb-1 block">Type</label>
                    <select value={newChallenge.type} onChange={e => setNewChallenge(prev => ({ ...prev, type: e.target.value }))} className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff4d00]">
                      <option value="roast">Roast</option>
                      <option value="vote">Vote</option>
                      <option value="share">Share</option>
                      <option value="follow">Follow</option>
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="text-[10px] text-zinc-500 font-mono mb-1 block">Reward Karma</label>
                    <input type="number" value={newChallenge.reward_karma} onChange={e => setNewChallenge(prev => ({ ...prev, reward_karma: parseInt(e.target.value) || 10 }))} className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff4d00]" />
                  </div>
                </div>
                <button onClick={createChallenge} disabled={!newChallenge.title.trim()} className="px-4 py-2 bg-[#ff4d00] text-black font-bold text-xs rounded-xl disabled:opacity-40">Create Challenge</button>
              </div>

              {/* Active Challenges */}
              <div className="bg-[#111] border border-[#222] rounded-2xl p-4">
                <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase mb-3">All Challenges ({challenges.length})</h3>
                {challenges.length === 0 ? (
                  <p className="text-xs text-zinc-500 font-mono text-center py-4">No challenges yet — create one above</p>
                ) : (
                  <div className="space-y-2">
                    {challenges.map(c => (
                      <div key={c.id} className={`p-3 rounded-xl border ${c.is_active ? 'bg-[#0a0a0a] border-[#222]' : 'bg-[#0a0a0a]/50 border-[#1a1a1a] opacity-50'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-white">{c.title}</span>
                            {c.description && <p className="text-[10px] text-zinc-500 mt-0.5">{c.description}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-amber-400">+{c.reward_karma} karma</span>
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${c.is_active ? 'bg-green-900/30 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>{c.is_active ? 'Active' : 'Inactive'}</span>
                            {c.is_active && (
                              <button onClick={() => deactivateChallenge(c.id)} className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-[10px] font-bold hover:bg-red-900/30 hover:text-red-400">Deactivate</button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdvancedAdminView;
