import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Flame, TrendingUp, Sparkles, Skull, ArrowRight, Target, CheckCircle, Users, Clock } from 'lucide-react';
import { Profile, Roast, DailyChallenge } from '../types';
import { LeaderboardLive } from './LeaderboardLive';
import { fetchDailyChallenges, fetchChallengeProgress } from '../lib/karma';
import { t } from '../lib/lang';
import { useAuth } from '../lib/auth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { FollowButton } from './FollowButton';

function timeAgo(dateString: string): string {
  if (!dateString) return '';
  const now = Date.now();
  const past = new Date(dateString).getTime();
  const diff = Math.max(0, Math.floor((now - past) / 1000));
  if (diff < 60) return 'now';
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

interface SidebarRightProps {
  profiles: Profile[];
  roasts: Roast[];
  onSelectProfile: (profileId: string) => void;
  onSelectRoast: (roast: Roast) => void;
}

export const SidebarRight: React.FC<SidebarRightProps> = ({
  profiles,
  roasts,
  onSelectProfile,
  onSelectRoast
}) => {
  // Real trending roasts from Supabase
  const [trendingReal, setTrendingReal] = useState<any[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setTrendingLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('roasts')
          .select('id, roast_text, upvotes, created_at, profiles!inner(username, platform)')
          .eq('is_hidden', false)
          .order('upvotes', { ascending: false })
          .limit(3);

        if (error) throw error;
        setTrendingReal(data || []);
      } catch (err) {
        console.warn('[SidebarRight] Trending fetch failed:', err);
        setTrendingReal([]);
      } finally {
        setTrendingLoading(false);
      }
    };

    fetchTrending();
    // Refresh every 60s
    const interval = setInterval(fetchTrending, 60000);
    return () => clearInterval(interval);
  }, []);

  // Suggested Users sub-component
  const SuggestedUsers = () => {
    const { user } = useAuth();
    const [suggested, setSuggested] = useState<any[]>([]);

    useEffect(() => {
      if (!user || !isSupabaseConfigured || !supabase) return;

      const fetchSuggested = async () => {
        // Get users not followed by current user
        const { data: following } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        const followedIds = (following || []).map((f: any) => f.following_id);
        followedIds.push(user.id); // exclude self

        const { data } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, avatar_url, bio, karma')
          .not('id', 'in', `(${followedIds.join(',')})`)
          .order('karma', { ascending: false })
          .limit(3);

        if (data) setSuggested(data as any[]);
      };

      fetchSuggested();
    }, [user]);

    if (!user || suggested.length === 0) return null;

    return (
      <div>
        <h2 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-3 flex items-center gap-2">
          <Users className="w-3 h-3 text-blue-400" />
          Suggested for you
        </h2>
        <div className="space-y-2">
          {suggested.map(u => (
            <div key={u.id} className="flex items-center justify-between p-2 rounded-xl bg-[#111] border border-[#222]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff4d00] to-amber-500 text-black font-black text-xs flex items-center justify-center shrink-0">
                  {u.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-white truncate">@{u.username}</div>
                  {u.bio && <div className="text-[9px] text-zinc-500 truncate">{u.bio.slice(0, 40)}</div>}
                </div>
              </div>
              <FollowButton followingId={u.id} size="sm" />
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Daily Challenges Widget (Real Data) ─────────────────────
  const DailyChallengesWidget = () => {
    const { user } = useAuth();
    const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
    const [progress, setProgress] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const load = async () => {
        setLoading(true);
        const chs = await fetchDailyChallenges();
        const prog = await fetchChallengeProgress(user?.id || null, null);
        setChallenges(chs);
        setProgress(prog);
        setLoading(false);
      };
      load();
    }, [user]);

    if (loading || challenges.length === 0) {
      return (
        <div>
          <h2 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
            {t('challenge')}
          </h2>
          <div className="p-3 bg-[#111] border border-[#222] rounded-xl text-center">
            <p className="text-[10px] text-zinc-500 font-mono">
              {loading ? 'Loading challenges...' : 'No challenges yet — check back tomorrow'}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div>
        <h2 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
          {t('challenge')}
        </h2>
        <div className="space-y-2">
          {challenges.map((ch) => {
            const current = progress[ch.type] || 0;
            const isDone = current >= ch.targetCount;
            return (
              <div
                key={ch.id}
                className={`p-2.5 rounded-xl border transition-all ${
                  isDone
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-[#111] border-[#222] hover:border-[#333]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isDone ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span className={`text-xs font-bold ${isDone ? 'text-emerald-300 line-through' : 'text-white'}`}>
                      {ch.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                    {current}/{ch.targetCount}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1 pl-5.5">{ch.description}</p>
                <div className="text-[10px] text-amber-400/80 font-mono mt-1 pl-5.5">
                  🎁 {ch.reward}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <aside
      id="sidebar-right"
      className="hidden lg:flex w-80 border-l border-[#222] flex-col p-4 bg-[#0a0a0a] overflow-y-auto shrink-0 gap-5 select-none"
    >
      {/* Live Leaderboard Interactive Widget */}
      <LeaderboardLive
        profiles={profiles}
        roasts={roasts}
        onSelectProfile={onSelectProfile}
      />

      {/* Suggested Users */}
      <SuggestedUsers />

      {/* Trending Roasts — Real Data from Supabase */}
      <div>
        <h2 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-[#ff4d00] rounded-full animate-pulse"></span>
          Trending Roasts
        </h2>

        <div className="space-y-2.5">
          {trendingLoading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-2.5 rounded-xl bg-[#111] border border-[#222] animate-pulse">
                  <div className="h-2 bg-[#222] rounded w-16 mb-2" />
                  <div className="h-2 bg-[#222] rounded w-full mb-1" />
                  <div className="h-2 bg-[#222] rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : trendingReal.length === 0 ? (
            <div className="p-4 text-center bg-[#111] border border-dashed border-[#222] rounded-xl">
              <p className="text-[10px] text-zinc-500 font-mono">
                No trending yet — be first to roast 🔥
              </p>
            </div>
          ) : (
            trendingReal.map((item: any) => {
              const platformTag = item.profiles?.platform ? `#${item.profiles.platform}` : '#Roast';
              return (
                <div
                  key={item.id}
                  className="group p-2.5 rounded-xl bg-[#111] hover:bg-[#161616] border border-[#222] transition-all cursor-pointer"
                  onClick={() => onSelectRoast(item)}
                >
                  <div className="text-xs text-[#ff4d00] mb-1 font-mono font-bold flex items-center justify-between">
                    <span>{platformTag}</span>
                    <TrendingUp className="w-3 h-3 text-zinc-500 group-hover:text-white transition-colors" />
                  </div>
                  <p className="text-xs text-zinc-300 group-hover:text-white transition-colors leading-relaxed line-clamp-2">
                    &ldquo;{item.roast_text?.slice(0, 80)}{item.roast_text?.length > 80 ? '…' : ''}&rdquo;
                  </p>
                  <div className="text-[10px] text-zinc-500 font-mono mt-1.5 flex items-center justify-between">
                    <span>{item.upvotes || 0} burns</span>
                    <span>{timeAgo(item.created_at)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Daily Challenges — Real Data from Supabase */}
      <DailyChallengesWidget />

      {/* Community Rules Notice */}
      <div className="mt-auto bg-[#0d0d0d] border border-[#222] p-3 rounded-xl text-[11px] text-zinc-400">
        <div className="font-bold text-zinc-300 mb-1 flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-[#ff4d00]" />
          <span>The Roast Code</span>
        </div>
        <p className="text-[10px] text-zinc-500 leading-relaxed">
          Be witty, be ruthless, but avoid hate speech or real doxxing. 100% human accountability.
        </p>
      </div>
    </aside>
  );
};
