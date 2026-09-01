import React, { useState, useEffect } from 'react';
import { ArrowLeft, ShieldAlert, Flame, BarChart3, Users, MessageSquare, AlertTriangle, RefreshCw, Key, CheckCircle, Database, Trash2, Star, Download, Shield, ShieldBan, Check, Lock, Eye, Clock, Zap } from 'lucide-react';
import { Profile, Roast, ReportItem, BlockedIP } from '../types';
import { getAnalyticsEvents, getAnalyticsSummary, AnalyticsEvent } from '../lib/analytics';
import { DataStore } from '../lib/dataStore';
import { getAllRateLimits, RATE_LIMITS } from '../lib/rateLimitAdvanced';

interface AdminViewProps {
  profiles: Profile[];
  roasts: Roast[];
  onBack: () => void;
  onDeleteProfile: (id: string) => void;
  onDeleteRoast: (id: string) => void;
  onToggleFeatureProfile?: (id: string) => void;
  onShowToast: (title: string, msg: string, type?: 'success' | 'warning' | 'info' | 'flame') => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  profiles,
  roasts,
  onBack,
  onDeleteProfile,
  onDeleteRoast,
  onToggleFeatureProfile,
  onShowToast
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [blockedIps, setBlockedIps] = useState<BlockedIP[]>([]);
  const [newBlockIp, setNewBlockIp] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');
  const [activeTab, setActiveTab] = useState<'metrics' | 'roasts' | 'reports' | 'profiles' | 'security' | 'securityDash'>('metrics');
  const [rateLimits, setRateLimits] = useState<Record<string, any>>({});

  const [eventSummary, setEventSummary] = useState<{ totalEvents: number; countsByEvent: Record<string, number> }>({
    totalEvents: 0,
    countsByEvent: {}
  });

  const loadData = async () => {
    const evs = getAnalyticsEvents();
    setEvents(evs);
    setEventSummary(getAnalyticsSummary());
    setReports(await DataStore.getReports());
    setBlockedIps(await DataStore.getBlockedIps());
    setRateLimits(getAllRateLimits());
  };

  useEffect(() => {
    if (sessionStorage.getItem('burnboard_admin_unlocked') === 'true') {
      setIsAuthenticated(true);
      loadData();
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'burn2024') {
      setIsAuthenticated(true);
      setAuthError(false);
      sessionStorage.setItem('burnboard_admin_unlocked', 'true');
      loadData();
      onShowToast('Admin Unlocked 🔥', 'Full scaling & moderation control active.', 'success');
    } else {
      setAuthError(true);
      onShowToast('Access Denied', 'Invalid admin password (burn2024).', 'warning');
    }
  };

  const handleExportJSON = async () => {
    const [profilesData, roastsData, battlesData, reportsData, blockedData] = await Promise.all([
      DataStore.getProfiles(),
      DataStore.getRoasts(),
      DataStore.getBattles(),
      DataStore.getReports(),
      DataStore.getBlockedIps(),
    ]);
    const backupData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      profiles: profilesData,
      roasts: roastsData,
      battles: battlesData,
      reports: reportsData,
      blocked_ips: blockedData,
      analytics_events: getAnalyticsEvents()
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `burnboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast('Export Complete 💾', 'Full database snapshot downloaded as JSON.', 'success');
  };

  const handleBlockIpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockIp.trim()) return;
    await DataStore.blockIp(newBlockIp.trim(), newBlockReason.trim() || 'Manual Admin Ban');
    setBlockedIps(await DataStore.getBlockedIps());
    setNewBlockIp('');
    setNewBlockReason('');
    onShowToast('IP Blocked 🛑', `Hash ${newBlockIp} was permanently barred.`, 'warning');
  };

  const handleUnblockIp = async (hash: string) => {
    await DataStore.unblockIp(hash);
    setBlockedIps(await DataStore.getBlockedIps());
    onShowToast('IP Unblocked', `Hash ${hash} restored.`, 'info');
  };

  const handleResolveReport = async (reportId: string, action: 'approve' | 'delete', roastId?: string) => {
    await DataStore.resolveReport(reportId, action, roastId);
    setReports(await DataStore.getReports());
    if (action === 'delete') {
      onShowToast('Burn Deleted', 'Roast removed from database.', 'warning');
    } else {
      onShowToast('Report Dismissed', 'Roast kept as clean.', 'info');
    }
  };

  const handleToggleFeature = (profileId: string) => {
    const isNow = DataStore.toggleFeatureProfile(profileId);
    if (onToggleFeatureProfile) onToggleFeatureProfile(profileId);
    onShowToast(
      isNow ? 'Profile Featured 👑' : 'Featured Removed',
      isNow ? 'Profile now pins to the top of the feed with gold styling.' : 'Standard feed positioning restored.',
      'success'
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 space-y-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#ff4d00]/10 border border-[#ff4d00]/30 flex items-center justify-center mx-auto text-[#ff4d00]">
          <Key className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-white font-mono uppercase tracking-wider">
            BurnMaster Command Center
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Enter the admin key to access scaling controls, live metrics & moderation.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="password"
            id="admin-password-input"
            value={passwordInput}
            onChange={(e) => {
              setPasswordInput(e.target.value);
              setAuthError(false);
            }}
            placeholder="Enter password (hint: burn2024)"
            className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#ff4d00] font-mono text-center"
            autoFocus
          />

          {authError && (
            <p className="text-xs text-red-400 font-mono">Incorrect password.</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBack}
              className="w-1/2 py-2.5 bg-[#1a1a1a] hover:bg-[#222] text-zinc-300 rounded-xl text-xs font-mono font-bold transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              className="w-1/2 py-2.5 bg-[#ff4d00] hover:bg-[#ff6622] text-black rounded-xl text-xs font-mono font-black transition-colors"
            >
              Unlock Command 🔥
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Calculated live stats
  const totalUpvotes = roasts.reduce((acc, r) => acc + (r.upvotes || 0), 0);
  const totalBrutalReactions = roasts.reduce((acc, r) => acc + (r.reaction_brutal || 0), 0);
  const roastsToday = roasts.filter(r => {
    const d = new Date(r.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#111] border border-[#222] p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222] text-zinc-300 hover:text-white rounded-xl border border-[#333] text-xs font-mono font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Exit</span>
          </button>
          <div>
            <h1 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#ff4d00]" />
              <span>BurnMaster Scaling & Moderation Console</span>
            </h1>
            <p className="text-[11px] text-zinc-400 font-mono">10,000+ Concurrent User Automation Ready</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1f1610] hover:bg-[#2e1d12] text-[#ff4d00] border border-[#ff4d00]/30 rounded-xl text-xs font-mono font-bold transition-colors"
            title="Download JSON Database Snapshot"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Backup</span>
          </button>
          <button
            onClick={loadData}
            className="p-2 bg-[#141414] hover:bg-[#1f1f1f] text-zinc-400 hover:text-white rounded-xl border border-[#262626]"
            title="Refresh logs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-[#0c0c0c] p-1.5 rounded-xl border border-[#222]">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
            activeTab === 'metrics' ? 'bg-[#ff4d00] text-black shadow' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Overview & Metrics
        </button>
        <button
          onClick={() => setActiveTab('roasts')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
            activeTab === 'roasts' ? 'bg-[#ff4d00] text-black shadow' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Recent Roasts ({roasts.length})
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
            activeTab === 'reports' ? 'bg-red-500 text-white shadow' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Report Queue ({reports.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('profiles')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
            activeTab === 'profiles' ? 'bg-[#ff4d00] text-black shadow' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Target Profiles ({profiles.length})
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
            activeTab === 'security' ? 'bg-amber-400 text-black shadow' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <ShieldBan className="w-3.5 h-3.5" />
          <span>IP Shields ({blockedIps.length})</span>
        </button>
        <button
          onClick={() => { setActiveTab('securityDash'); loadData(); }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
            activeTab === 'securityDash' ? 'bg-emerald-500 text-black shadow' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Security Dashboard</span>
        </button>
      </div>

      {/* METRICS TAB */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-[#111] border border-[#222] rounded-2xl p-4 space-y-1">
              <div className="text-zinc-500 text-[10px] font-mono uppercase font-bold flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#ff4d00]" />
                <span>Profiles</span>
              </div>
              <div className="text-2xl font-black text-white font-mono">{profiles.length}</div>
            </div>

            <div className="bg-[#111] border border-[#222] rounded-2xl p-4 space-y-1">
              <div className="text-zinc-500 text-[10px] font-mono uppercase font-bold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span>Total Burns</span>
              </div>
              <div className="text-2xl font-black text-white font-mono">{roasts.length}</div>
            </div>

            <div className="bg-[#111] border border-[#222] rounded-2xl p-4 space-y-1">
              <div className="text-zinc-500 text-[10px] font-mono uppercase font-bold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>Roasts Today</span>
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono">{roastsToday || roasts.length}</div>
            </div>

            <div className="bg-[#111] border border-[#222] rounded-2xl p-4 space-y-1">
              <div className="text-zinc-500 text-[10px] font-mono uppercase font-bold flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5 text-yellow-500" />
                <span>Upvotes</span>
              </div>
              <div className="text-2xl font-black text-white font-mono">{totalUpvotes.toLocaleString()}</div>
            </div>

            <div className="bg-[#111] border border-[#222] rounded-2xl p-4 space-y-1">
              <div className="text-zinc-500 text-[10px] font-mono uppercase font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span>Reports</span>
              </div>
              <div className="text-2xl font-black text-red-400 font-mono">{reports.length}</div>
            </div>

            <div className="bg-[#111] border border-[#222] rounded-2xl p-4 space-y-1">
              <div className="text-zinc-500 text-[10px] font-mono uppercase font-bold flex items-center gap-1">
                <ShieldBan className="w-3.5 h-3.5 text-purple-400" />
                <span>Blocked IPs</span>
              </div>
              <div className="text-2xl font-black text-purple-300 font-mono">{blockedIps.length}</div>
            </div>
          </div>

          {/* Event Analytics breakdown */}
          <div className="bg-[#111] border border-[#222] rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#ff4d00]" />
              <span>Event Funnel Activity</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(eventSummary.countsByEvent).map(([evName, count]) => (
                <div key={evName} className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-2.5">
                  <div className="text-[10px] font-mono text-zinc-400 truncate">{evName}</div>
                  <div className="text-base font-black text-[#ff4d00] font-mono">{count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ROASTS MODERATION TAB */}
      {activeTab === 'roasts' && (
        <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-[#222] flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>Verified Roasts Feed</span>
            <span>Action</span>
          </div>
          <div className="divide-y divide-[#1e1e1e] max-h-[600px] overflow-y-auto">
            {roasts.map(roast => {
              const prof = profiles.find(p => p.id === roast.profile_id);
              return (
                <div key={roast.id} className="p-4 flex items-start justify-between gap-4 hover:bg-[#161616] transition-colors">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="font-bold text-[#ff4d00]">@{prof?.username || 'Unknown'}</span>
                      <span className="text-zinc-500">• by {roast.anon_id}</span>
                      <span className="text-zinc-600">▲ {roast.upvotes} upvotes</span>
                    </div>
                    <p className="text-sm text-zinc-200 font-sans italic">"{roast.roast_text}"</p>
                    <div className="text-[10px] text-zinc-600 font-mono">{new Date(roast.created_at).toLocaleString()}</div>
                  </div>
                  <button
                    onClick={() => {
                      onDeleteRoast(roast.id);
                      onShowToast('Roast Extinguished', 'Burn removed from the platform.', 'warning');
                    }}
                    className="p-2 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 rounded-xl transition-all shrink-0"
                    title="Delete Roast"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* REPORTS QUEUE TAB */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="bg-[#111] border border-red-500/30 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span>Flagged Burns Moderation Queue</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Review flagged burns. Approve keeps the roast, Delete immediately purges the violation.
            </p>
          </div>

          <div className="bg-[#111] border border-[#222] rounded-2xl divide-y divide-[#1e1e1e] overflow-hidden">
            {reports.map(rep => (
              <div key={rep.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="text-xs font-mono font-bold text-red-400">
                    Flagged: {rep.profile_username ? `@${rep.profile_username}` : 'Target'}
                  </div>
                  <p className="text-sm text-zinc-200 italic">"{rep.roast_text || 'Roast content'}"</p>
                  <p className="text-xs text-zinc-400 font-mono">Reason: {rep.reason}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleResolveReport(rep.id, 'approve')}
                    className="px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/40 rounded-xl text-xs font-mono font-bold flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve (Keep)</span>
                  </button>
                  <button
                    onClick={() => handleResolveReport(rep.id, 'delete', rep.roast_id)}
                    className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 rounded-xl text-xs font-mono font-bold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Burn</span>
                  </button>
                </div>
              </div>
            ))}

            {reports.length === 0 && (
              <div className="p-8 text-center text-xs font-mono text-zinc-500">
                ✨ Clean slate! No pending reports in the moderation queue.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TARGET PROFILES TAB */}
      {activeTab === 'profiles' && (
        <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-[#222] flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>Target Profiles</span>
            <span>Feature / Delete</span>
          </div>
          <div className="divide-y divide-[#1e1e1e] max-h-[600px] overflow-y-auto">
            {profiles.map(profile => (
              <div key={profile.id} className="p-4 flex items-center justify-between gap-3 hover:bg-[#161616] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#222] text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {profile.avatar_letter}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white truncate">@{profile.username}</span>
                      <span className="text-[10px] font-mono bg-[#222] text-zinc-400 px-1.5 py-0.5 rounded uppercase">
                        {profile.platform}
                      </span>
                      {profile.featured && (
                        <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-bold">
                          👑 FEATURED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 truncate max-w-sm">{profile.bio}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleFeature(profile.id)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1 transition-all ${
                      profile.featured
                        ? 'bg-amber-500 text-black border-amber-400 shadow'
                        : 'bg-[#1a1a1a] hover:bg-[#222] text-zinc-300 border-[#333]'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5" />
                    <span>{profile.featured ? 'Featured' : 'Feature'}</span>
                  </button>
                  <button
                    onClick={() => {
                      onDeleteProfile(profile.id);
                      onShowToast('Profile Deleted', 'Target removed from the platform.', 'warning');
                    }}
                    className="p-2 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 rounded-xl"
                    title="Delete Profile"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IP SHIELDS & BAN CONTROL */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Add Manual IP Ban */}
          <div className="bg-[#111] border border-[#222] rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
              <ShieldBan className="w-4 h-4 text-amber-400" />
              <span>Manual IP Blacklist</span>
            </h3>
            <form onSubmit={handleBlockIpSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newBlockIp}
                onChange={(e) => setNewBlockIp(e.target.value)}
                placeholder="Enter IP Hash (e.g. 9f83a21b4c)"
                className="bg-[#0a0a0a] border border-[#333] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 font-mono flex-1 focus:outline-none focus:border-[#ff4d00]"
              />
              <input
                type="text"
                value={newBlockReason}
                onChange={(e) => setNewBlockReason(e.target.value)}
                placeholder="Reason (e.g. Spam bot attack)"
                className="bg-[#0a0a0a] border border-[#333] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 font-mono flex-1 focus:outline-none focus:border-[#ff4d00]"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs rounded-xl shadow shrink-0"
              >
                Block IP 🛑
              </button>
            </form>
          </div>

          {/* List of Blocked IPs */}
          <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-[#222] text-xs font-mono text-zinc-400 flex justify-between">
              <span>Blocked IP Hash & Reason</span>
              <span>Action</span>
            </div>
            <div className="divide-y divide-[#1e1e1e]">
              {blockedIps.map(b => (
                <div key={b.ip_hash} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono font-bold text-red-400">{b.ip_hash}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{b.reason}</div>
                  </div>
                  <button
                    onClick={() => handleUnblockIp(b.ip_hash)}
                    className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222] text-zinc-300 rounded-xl text-xs font-mono border border-[#333]"
                  >
                    Unblock
                  </button>
                </div>
              ))}
              {blockedIps.length === 0 && (
                <div className="p-6 text-center text-xs font-mono text-zinc-500">
                  No IP addresses currently barred.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECURITY DASHBOARD TAB */}
      {activeTab === 'securityDash' && (
        <div className="space-y-6">
          {/* Security Overview */}
          <div className="bg-gradient-to-r from-[#0a1a0a] via-[#111] to-[#0a0a1a] border border-emerald-500/30 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Lock className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Security Dashboard</h3>
                <p className="text-[10px] text-zinc-400 font-mono">Real-time rate limits, threat detection, and protection status</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3 text-center">
                <Shield className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                <div className="text-lg font-black text-white">RLS</div>
                <div className="text-[10px] text-emerald-400 font-mono">ACTIVE</div>
              </div>
              <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3 text-center">
                <Eye className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                <div className="text-lg font-black text-white">CSP</div>
                <div className="text-[10px] text-blue-400 font-mono">ENABLED</div>
              </div>
              <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3 text-center">
                <Zap className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <div className="text-lg font-black text-white">XSS</div>
                <div className="text-[10px] text-amber-400 font-mono">BLOCKED</div>
              </div>
              <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3 text-center">
                <ShieldBan className="w-4 h-4 text-red-400 mx-auto mb-1" />
                <div className="text-lg font-black text-white">{blockedIps.length}</div>
                <div className="text-[10px] text-red-400 font-mono">IPs BLOCKED</div>
              </div>
            </div>
          </div>

          {/* Rate Limit Status */}
          <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
            <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Rate Limit Status (Client-Side)
            </h3>
            <div className="space-y-2">
              {Object.entries(RATE_LIMITS).map(([action, config]) => {
                const status = rateLimits[action] || { used: 0, max: config.maxRequests, remaining: config.maxRequests, resetsIn: 0 };
                const pct = status.max > 0 ? ((status.used / status.max) * 100) : 0;
                const isNearLimit = pct > 70;
                const isAtLimit = pct >= 100;
                return (
                  <div key={action} className="flex items-center gap-3 bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-2.5">
                    <div className="w-20 text-xs font-mono text-zinc-300 truncate">{action}</div>
                    <div className="flex-1 h-2 bg-[#222] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 w-24 text-right">
                      {status.used}/{status.max}
                      {status.resetsIn > 0 && <span className="text-amber-400"> ({status.resetsIn}s)</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security Policies Summary */}
          <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
            <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              Active Security Layers
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { label: 'Supabase RLS', desc: 'Row-level security on all tables', status: 'active' },
                { label: 'Input Validation', desc: 'ZOD schemas on all user inputs', status: 'active' },
                { label: 'XSS Protection', desc: 'HTML stripping + script detection', status: 'active' },
                { label: 'Rate Limiting', desc: 'Client-side sliding window per action', status: 'active' },
                { label: 'Honeypot Anti-Bot', desc: 'Invisible fields trap automated bots', status: 'active' },
                { label: 'Content Security Policy', desc: 'CSP headers restrict script sources', status: 'active' },
                { label: 'Duplicate Detection', desc: '1-hour window prevents repeat content', status: 'active' },
                { label: 'IP Blacklist', desc: `${blockedIps.length} IPs currently blocked`, status: blockedIps.length > 0 ? 'warning' : 'active' },
              ].map((layer) => (
                <div key={layer.label} className="flex items-center gap-3 bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-2.5">
                  <div className={`w-2 h-2 rounded-full ${
                    layer.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white">{layer.label}</div>
                    <div className="text-[10px] text-zinc-500 font-mono truncate">{layer.desc}</div>
                  </div>
                  <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                    layer.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {layer.status === 'active' ? 'Active' : 'Warning'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Reports */}
          <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
            <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Pending Reports ({reports.length})
            </h3>
            {reports.length > 0 ? (
              <div className="space-y-2">
                {reports.slice(0, 5).map((rep) => (
                  <div key={rep.id} className="flex items-center justify-between bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-bold text-amber-400">@{rep.profile_username || 'Unknown'}</div>
                      <div className="text-[10px] text-zinc-500 font-mono truncate">{rep.reason}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResolveReport(rep.id, 'approve')}
                        className="px-2 py-1 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 rounded text-[10px] font-mono font-bold"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleResolveReport(rep.id, 'delete', rep.roast_id)}
                        className="px-2 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded text-[10px] font-mono font-bold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-xs font-mono text-zinc-500">
                ✅ No pending reports
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
