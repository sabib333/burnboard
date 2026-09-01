import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Flame, Trophy, Calendar, MessageSquare, TrendingUp, ExternalLink, Share2, Users, UserPlus, UserMinus, Loader2, MessageCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../lib/auth';
import { Roast, FollowCounts } from '../types';
import { timeAgo } from '../lib/badWords';
import { calculateKarmaLevel } from '../lib/karma';
import { KarmaBar } from '../components/KarmaBar';
import { followUser, unfollowUser, isFollowing, getFollowCounts, getFollowers, getFollowing } from '../lib/follows';
import { FollowButton } from '../components/FollowButton';

interface UserProfileViewProps {
  username: string;
  onBack: () => void;
  onShowToast: (text: string, subtext?: string) => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({ username, onBack, onShowToast }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roasts, setRoasts] = useState<Roast[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followCounts, setFollowCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [followerList, setFollowerList] = useState<Array<{ id: string; username: string; display_name: string | null }>>([]);
  const [followingList, setFollowingList] = useState<Array<{ id: string; username: string; display_name: string | null }>>([]);
  const [followerCursor, setFollowerCursor] = useState<string | null>(null);
  const [followingCursor, setFollowingCursor] = useState<string | null>(null);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<'roasts' | 'profiles' | 'followers' | 'following'>('roasts');

  useEffect(() => {
    const loadProfile = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        // Fetch user profile
        const { data: userData, error: userError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('username', username)
          .single();

        if (userError || !userData) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setProfile(userData as UserProfile);

        // Fetch roasts by this user
        const { data: roastData } = await supabase
          .from('roasts')
          .select('*')
          .eq('user_id', userData.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (roastData) setRoasts(roastData as Roast[]);

        // Fetch profiles created by this user
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userData.id)
          .order('created_at', { ascending: false });

        if (profileData) setProfiles(profileData);

        // Fetch follow counts from cached columns (not COUNT queries)
        const counts = await getFollowCounts(userData.id);
        setFollowCounts(counts);

        // Load initial followers list (first page)
        const followersResult = await getFollowers(userData.id, 20);
        setFollowerList(followersResult.users);
        setFollowerCursor(followersResult.nextCursor);

        // Load initial following list (first page)
        const followingResult = await getFollowing(userData.id, 20);
        setFollowingList(followingResult.users);
        setFollowingCursor(followingResult.nextCursor);

        // Check if current user is following this profile
        if (user && user.id !== userData.id) {
          const alreadyFollowing = await isFollowing(user.id, userData.id);
          setFollowing(alreadyFollowing);
        }

      } catch (err) {
        console.error('Failed to load profile:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [username]);

  const handleShare = () => {
    const url = `${window.location.origin}/u/${username}`;
    navigator.clipboard.writeText(url);
    onShowToast('Profile Link Copied! 🔗', url);
  };

  const handleFollow = useCallback(async () => {
    if (!user || !profile) return;
    if (followLoading) return;

    setFollowLoading(true);
    try {
      if (following) {
        const result = await unfollowUser(user.id, profile.id);
        if (result.error) {
          onShowToast('Error', result.error, 'warning');
        } else {
          setFollowing(false);
          setFollowCounts(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
          onShowToast('Unfollowed', `You unfollowed @${username}`);
        }
      } else {
        const result = await followUser(user.id, profile.id);
        if (result.error) {
          onShowToast('Error', result.error, 'warning');
        } else {
          setFollowing(true);
          setFollowCounts(prev => ({ ...prev, followers: prev.followers + 1 }));
          onShowToast('Following! 🔥', `You are now following @${username}`);
          try { navigator.vibrate?.(50); } catch {}
        }
      }
    } finally {
      setFollowLoading(false);
    }
  }, [user, profile, following, followLoading, username, onShowToast]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Flame className="w-8 h-8 text-[#ff4d00] animate-pulse mx-auto" />
          <p className="text-xs font-mono text-zinc-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-4xl">👤</div>
          <h2 className="text-lg font-bold text-white">User Not Found</h2>
          <p className="text-xs text-zinc-400">@{username} doesn't exist on BURNBOARD.</p>
          <button onClick={onBack} className="px-4 py-2 bg-[#ff4d00] text-black font-bold rounded-xl text-xs">
            Back to Feed
          </button>
        </div>
      </div>
    );
  }

  const karma = calculateKarmaLevel(profile.karma);
  const totalUpvotes = roasts.reduce((sum, r) => sum + (r.upvotes || 0), 0);
  const isOwnProfile = user?.id === profile.id;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-3.5 py-2 bg-[#141414] hover:bg-[#1f1f1f] text-zinc-300 hover:text-white rounded-xl border border-[#262626] text-xs font-mono font-bold transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Feed</span>
      </button>

      {/* Profile Header */}
      <div className="bg-gradient-to-b from-[#14100c] to-[#111] border border-[#ff4d00]/30 rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#ff4d00] to-amber-500 text-black font-black text-3xl flex items-center justify-center shadow-[0_0_30px_rgba(255,77,0,0.35)]">
            {profile.username.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black text-white tracking-tight">
                @{profile.username}
              </h1>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${karma.level === 'Savage' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : karma.level === 'Brutal' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' : karma.level === 'Roaster' ? 'bg-[#ff4d00]/15 text-[#ff4d00] border-[#ff4d00]/30' : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'}`}>
                {karma.badge}
              </span>
            </div>

            {profile.display_name && (
              <p className="text-sm text-zinc-400 mt-0.5">{profile.display_name}</p>
            )}

            {profile.bio && (
              <p className="text-sm text-zinc-300 mt-2">{profile.bio}</p>
            )}

            {/* Stats */}
            <div className="flex items-center gap-4 sm:gap-6 mt-3 text-xs font-mono flex-wrap">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#ff4d00]" />
                <span className="text-white font-bold">{roasts.length}</span>
                <span className="text-zinc-500">roasts</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#ff4d00] font-bold">▲</span>
                <span className="text-white font-bold">{totalUpvotes}</span>
                <span className="text-zinc-500">upvotes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-white font-bold">{profile.karma}</span>
                <span className="text-zinc-500">karma</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-white font-bold">{followCounts.followers}</span>
                <span className="text-zinc-500">followers</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500">following</span>
                <span className="text-white font-bold">{followCounts.following}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-zinc-400">Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!isOwnProfile && (
              <FollowButton followingId={profile.id} />
            )}
            {!isOwnProfile && user && (
              <a
                href="#dm"
                onClick={(e) => {
                  e.preventDefault();
                  // Create DM thread and navigate
                  import('../lib/notify').then(({ getOrCreateDmThread }) => {
                    if (user && profile) {
                      getOrCreateDmThread(user.id, profile.id).then(threadId => {
                        window.location.hash = '#dm';
                      });
                    }
                  });
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#141414] hover:bg-[#1a1a1a] border border-[#262626] text-zinc-300 hover:text-white transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Message</span>
              </a>
            )}
            {!isOwnProfile && !user && (
              <a
                href="#auth"
                onClick={(e) => { e.preventDefault(); window.location.hash = '#auth'; }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#141414] hover:bg-[#1a1a1a] border border-[#262626] text-zinc-300 hover:text-white transition-all"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#ff4d00]" />
                <span>Login to Follow</span>
              </a>
            )}
            <button
              onClick={handleShare}
              className="p-2 bg-[#141414] hover:bg-[#1f1f1f] text-zinc-400 hover:text-white rounded-xl border border-[#262626] transition-colors"
              title="Copy profile link"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Karma Bar */}
      <KarmaBar
        upvotes={profile.karma}
        roastsGiven={roasts.length}
        streak={1}
      />

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-[#111] border border-[#222] rounded-xl p-1">
        {([
          { id: 'roasts' as const, label: `🔥 Roasts (${roasts.length})` },
          { id: 'profiles' as const, label: `🎯 Targets (${profiles.length})` },
          { id: 'followers' as const, label: `👥 Followers (${followCounts.followers})` },
          { id: 'following' as const, label: `➡️ Following (${followCounts.following})` },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 rounded-lg text-[11px] font-mono font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#ff4d00] text-black'
                : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'roasts' && (
        <div className="space-y-3">
          {roasts.length === 0 ? (
            <div className="bg-[#111] border border-dashed border-[#262626] rounded-2xl p-8 text-center">
              <p className="text-sm text-zinc-400">No roasts submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {roasts.map((roast) => (
                <div key={roast.id} className="bg-[#0a0a0a] border border-[#222] p-4 rounded-2xl">
                  <p className="text-sm text-zinc-100 italic">"{roast.roast_text}"</p>
                  <div className="flex items-center gap-4 mt-2 text-[11px] font-mono text-zinc-500">
                    <span>▲ {roast.upvotes}</span>
                    <span>{timeAgo(roast.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'profiles' && (
        <div className="space-y-3">
          {profiles.length === 0 ? (
            <div className="bg-[#111] border border-dashed border-[#262626] rounded-2xl p-8 text-center">
              <p className="text-sm text-zinc-400">No targets submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {profiles.map((p: any) => (
                <div key={p.id} className="bg-[#111] border border-[#222] p-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#ff4d00] text-black font-bold text-sm flex items-center justify-center">
                      {p.avatar_letter || p.username[0]}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white">@{p.username}</span>
                      <span className="text-[10px] text-zinc-500 ml-2">{p.platform}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">🔥 {p.roast_count} burns</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'followers' && (
        <div className="space-y-3">
          {followerList.length === 0 ? (
            <div className="bg-[#111] border border-dashed border-[#262626] rounded-2xl p-8 text-center">
              <Users className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">No followers yet.</p>
              <p className="text-[10px] text-zinc-500 mt-1">When people follow you, they&apos;ll appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {followerList.map((u) => (
                <div key={u.id} className="bg-[#111] border border-[#222] p-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff4d00] to-amber-500 text-black font-bold text-sm flex items-center justify-center">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white">@{u.username}</span>
                      {u.display_name && <span className="text-[10px] text-zinc-500 ml-2">{u.display_name}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {followerCursor && (
                <button
                  onClick={async () => {
                    setLoadingFollowers(true);
                    const result = await getFollowers(profile.id, 20, followerCursor);
                    setFollowerList(prev => [...prev, ...result.users]);
                    setFollowerCursor(result.nextCursor);
                    setLoadingFollowers(false);
                  }}
                  disabled={loadingFollowers}
                  className="w-full py-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
                >
                  {loadingFollowers ? 'Loading...' : 'Load more followers'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'following' && (
        <div className="space-y-3">
          {followingList.length === 0 ? (
            <div className="bg-[#111] border border-dashed border-[#262626] rounded-2xl p-8 text-center">
              <Users className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">Not following anyone yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {followingList.map((u) => (
                <div key={u.id} className="bg-[#111] border border-[#222] p-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff4d00] to-amber-500 text-black font-bold text-sm flex items-center justify-center">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white">@{u.username}</span>
                      {u.display_name && <span className="text-[10px] text-zinc-500 ml-2">{u.display_name}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {followingCursor && (
                <button
                  onClick={async () => {
                    setLoadingFollowing(true);
                    const result = await getFollowing(profile.id, 20, followingCursor);
                    setFollowingList(prev => [...prev, ...result.users]);
                    setFollowingCursor(result.nextCursor);
                    setLoadingFollowing(false);
                  }}
                  disabled={loadingFollowing}
                  className="w-full py-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
                >
                  {loadingFollowing ? 'Loading...' : 'Load more following'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
