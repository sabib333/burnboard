import React, { useState, useEffect } from 'react';
import { ArrowLeft, Flame, User, Save, Trash2, Loader2, Bell, Mail, Swords, UserPlus } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { invalidatePrefs } from '../lib/notificationPrefs';
import { loadSoundSettings, saveSoundSettings, updateSoundSetting, playTestSound, type SoundSettings } from '../lib/notificationSounds';

interface SettingsViewProps {
  onBack: () => void;
  onShowToast: (text: string, subtext?: string, type?: string) => void;
}

const ToggleRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  description: string;
  enabled: boolean;
  onChange: (val: boolean) => void;
}> = ({ icon, label, description, enabled, onChange }) => (
  <div className="flex items-center justify-between p-3 bg-[#0a0a0a] border border-[#262626] rounded-xl">
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xs font-bold text-white">{label}</p>
        <p className="text-[10px] text-zinc-500">{description}</p>
      </div>
    </div>
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-10 h-5 rounded-full transition-colors ${
        enabled ? 'bg-[#ff4d00]' : 'bg-[#333]'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
          enabled ? 'left-5' : 'left-0.5'
        }`}
      />
    </button>
  </div>
);

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack, onShowToast }) => {
  const { user, userProfile, refreshProfile, signOut } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [roastAlerts, setRoastAlerts] = useState(true);
  const [followAlerts, setFollowAlerts] = useState(true);
  const [dmAlerts, setDmAlerts] = useState(true);
  const [upvoteAlerts, setUpvoteAlerts] = useState(true);
  const [levelupAlerts, setLevelupAlerts] = useState(true);
  const [battleAlerts, setBattleAlerts] = useState(true);
  const [soundSettings, setSoundSettings] = useState<SoundSettings | null>(null);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.display_name || '');
      setBio(userProfile.bio || '');
      setAvatarUrl(userProfile.avatar_url || '');
      setPushEnabled(userProfile.push_enabled !== false);
      setEmailNotifications(userProfile.email_notifications !== false);
      setRoastAlerts(userProfile.roast_alerts !== false);
      setFollowAlerts(userProfile.follow_alerts !== false);
      setDmAlerts((userProfile as any).dm_alerts !== false);
      setUpvoteAlerts((userProfile as any).upvote_alerts !== false);
      setLevelupAlerts((userProfile as any).levelup_alerts !== false);
      setBattleAlerts((userProfile as any).battle_alerts !== false);
      setSoundSettings(loadSoundSettings(userProfile.id));
    }
  }, [userProfile]);

  const handleSave = async () => {
    if (!user || !isSupabaseConfigured || !supabase) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
          push_enabled: pushEnabled,
          email_notifications: emailNotifications,
          roast_alerts: roastAlerts,
          follow_alerts: followAlerts,
          dm_alerts: dmAlerts,
          upvote_alerts: upvoteAlerts,
          levelup_alerts: levelupAlerts,
          battle_alerts: battleAlerts,
          last_active: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        onShowToast('Save Failed', error.message, 'warning');
      } else {
        await refreshProfile();          invalidatePrefs(user.id);
          if (soundSettings) saveSoundSettings(user.id, soundSettings);
          onShowToast('Profile Updated! 🔥', 'Your settings have been saved.');
      }
    } catch (err: any) {
      onShowToast('Error', err.message, 'warning');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !isSupabaseConfigured || !supabase) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone. All your roasts and karma will be permanently lost.'
    );

    if (!confirmed) return;

    setDeleting(true);
    try {
      // Delete user profile
      await supabase.from('user_profiles').delete().eq('id', user.id);
      // Sign out
      await signOut();
      onShowToast('Account Deleted', 'Your account has been permanently removed.');
      onBack();
    } catch (err: any) {
      onShowToast('Delete Failed', err.message, 'warning');
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-sm text-zinc-400">Please log in to access settings.</p>
          <button onClick={onBack} className="px-4 py-2 bg-[#ff4d00] text-black font-bold rounded-xl text-xs">
            Back to Feed
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-3.5 py-2 bg-[#141414] hover:bg-[#1f1f1f] text-zinc-300 hover:text-white rounded-xl border border-[#262626] text-xs font-mono font-bold transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Feed</span>
      </button>

      {/* Header */}
      <div className="bg-gradient-to-b from-[#141414] to-[#111] border border-[#262626] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#ff4d00]/20 text-[#ff4d00] flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white uppercase tracking-tight">Account Settings</h1>
            <p className="text-xs text-zinc-400 font-mono">@{userProfile?.username || 'unknown'}</p>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="bg-[#111] border border-[#222] rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            maxLength={40}
            className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff4d00]"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
            Bio
          </label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell the world about yourself (or don't)"
            maxLength={200}
            className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff4d00] resize-none"
          />
          <div className="text-[10px] text-zinc-500 font-mono mt-1">{bio.length}/200</div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
            Avatar URL (optional)
          </label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
            className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff4d00]"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Notification Settings */}
      <div className="bg-[#111] border border-[#222] rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#ff4d00]/20 text-[#ff4d00] flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-tight">Notification Settings</h2>
            <p className="text-xs text-zinc-400 font-mono">Control what alerts you receive</p>
          </div>
        </div>

        <div className="space-y-3">
          <ToggleRow
            icon={<Bell className="w-4 h-4 text-emerald-400" />}
            label="Push Notifications"
            description="Receive native push notifications on mobile"
            enabled={pushEnabled}
            onChange={setPushEnabled}
          />
          <ToggleRow
            icon={<Mail className="w-4 h-4 text-blue-400" />}
            label="Email Notifications"
            description="Get email alerts for important activity"
            enabled={emailNotifications}
            onChange={setEmailNotifications}
          />
          <ToggleRow
            icon={<Flame className="w-4 h-4 text-[#ff4d00]" />}
            label="Roast Alerts"
            description="Notify when someone roasts your profile"
            enabled={roastAlerts}
            onChange={setRoastAlerts}
          />
          <ToggleRow
            icon={<UserPlus className="w-4 h-4 text-purple-400" />}
            label="Follow Alerts"
            description="Notify when someone follows you"
            enabled={followAlerts}
            onChange={setFollowAlerts}
          />
          <ToggleRow
            icon={<span className="text-sm">💬</span>}
            label="DM Alerts"
            description="Notify when someone sends you a message"
            enabled={dmAlerts}
            onChange={setDmAlerts}
          />
          <ToggleRow
            icon={<span className="text-sm">⬆️</span>}
            label="Upvote Alerts"
            description="Notify when your roasts hit upvote milestones"
            enabled={upvoteAlerts}
            onChange={setUpvoteAlerts}
          />
          <ToggleRow
            icon={<span className="text-sm">🎉</span>}
            label="Level Up Alerts"
            description="Notify when you level up (Newbie → Savage)"
            enabled={levelupAlerts}
            onChange={setLevelupAlerts}
          />
          <ToggleRow
            icon={<Swords className="w-4 h-4 text-red-400" />}
            label="Battle Alerts"
            description="Notify about new roast battles"
            enabled={battleAlerts}
            onChange={setBattleAlerts}
          />
        </div>
      </div>

      {/* Sound & Vibration Settings */}
      {soundSettings && (
        <div className="bg-[#111] border border-[#222] rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <span className="text-lg">🔊</span>
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-tight">Sound & Vibration</h2>
              <p className="text-xs text-zinc-400 font-mono">Customize alerts per notification type</p>
            </div>
          </div>

          {/* Global toggles */}
          <div className="space-y-3">
            <ToggleRow
              icon={<span className="text-sm">🔊</span>}
              label="Global Sound"
              description="Enable sounds for all notifications"
              enabled={soundSettings.global_sound}
              onChange={(val) => {
                const updated = updateSoundSetting(user!.id, 'global_sound', 'sound', val);
                setSoundSettings({ ...updated });
              }}
            />
            <ToggleRow
              icon={<span className="text-sm">📳</span>}
              label="Global Vibration"
              description="Enable vibration for all notifications"
              enabled={soundSettings.global_vibration}
              onChange={(val) => {
                const updated = updateSoundSetting(user!.id, 'global_vibration', 'vibration', val);
                setSoundSettings({ ...updated });
              }}
            />
          </div>

          {/* Per-type sound/vibration */}
          <div className="mt-4 space-y-2">
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Per-Type Customization</p>
            {([
              { type: 'roast' as const, icon: '🔥', label: 'Roast', freq: 'High sharp beep' },
              { type: 'follow' as const, icon: '👤', label: 'Follow', freq: 'Medium warm beep' },
              { type: 'dm' as const, icon: '💬', label: 'DM', freq: 'Double high — urgent' },
              { type: 'upvote' as const, icon: '⬆️', label: 'Upvote', freq: 'Quick pop' },
              { type: 'levelup' as const, icon: '🎉', label: 'Level Up', freq: 'Rising celebration' },
              { type: 'battle' as const, icon: '⚔️', label: 'Battle', freq: 'Aggressive double' },
            ]).map(({ type, icon, label, freq }) => (
              <div key={type} className="p-3 bg-[#0a0a0a] border border-[#262626] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{icon}</span>
                    <span className="text-xs font-bold text-white">{label}</span>
                    <span className="text-[9px] text-zinc-600 font-mono">{freq}</span>
                  </div>
                  <button
                    onClick={() => playTestSound(type)}
                    className="px-2 py-1 text-[10px] font-mono text-zinc-400 hover:text-white bg-[#1a1a1a] hover:bg-[#222] border border-[#333] rounded-lg transition-colors"
                  >
                    🔊 Test
                  </button>
                </div>
                <div className="flex items-center gap-4 pl-6">
                  <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                    <input
                      type="checkbox"
                      checked={soundSettings[type]?.sound ?? true}
                      onChange={(e) => {
                        const updated = updateSoundSetting(user!.id, type, 'sound', e.target.checked);
                        setSoundSettings({ ...updated });
                      }}
                      className="w-3 h-3 accent-[#ff4d00]"
                    />
                    Sound
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                    <input
                      type="checkbox"
                      checked={soundSettings[type]?.vibration ?? true}
                      onChange={(e) => {
                        const updated = updateSoundSetting(user!.id, type, 'vibration', e.target.checked);
                        setSoundSettings({ ...updated });
                      }}
                      className="w-3 h-3 accent-[#ff4d00]"
                    />
                    Vibration
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="bg-[#111] border border-red-500/20 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          Danger Zone
        </h3>
        <p className="text-xs text-zinc-400">
          Deleting your account is permanent and cannot be undone. All your roasts, karma, and data will be lost.
        </p>
        <button
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="px-4 py-2.5 bg-red-950/40 hover:bg-red-950/60 border border-red-500/30 text-red-400 font-bold rounded-xl text-xs transition-colors disabled:opacity-40"
        >
          {deleting ? 'Deleting...' : 'Delete Account Permanently'}
        </button>
      </div>
    </div>
  );
};
