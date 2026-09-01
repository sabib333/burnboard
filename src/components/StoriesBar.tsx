/**
 * BURNBOARD StoriesBar
 *
 * Instagram-style horizontal stories bar at top of feed.
 * - Fetches active (non-expired) stories from Supabase
 * - Groups by user, shows orange ring if not viewed
 * - "Create Story" + button first
 * - Click to open StoriesViewer fullscreen
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Flame, Eye } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import {
  fetchActiveStories,
  fetchViewedStoryIds,
  recordStoryView,
  type Story,
  type StoryWithMeta,
} from '../lib/stories';

interface StoriesBarProps {
  onCreateStory: () => void;
  onOpenStory: (stories: StoryWithMeta[], startIndex: number) => void;
}

function timeAgo(dateString: string): string {
  if (!dateString) return '';
  const now = Date.now();
  const past = new Date(dateString).getTime();
  const diff = Math.max(0, Math.floor((now - past) / 1000));
  if (diff < 60) return 'now';
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({ onCreateStory, onOpenStory }) => {
  const { user } = useAuth();
  const [stories, setStories] = useState<StoryWithMeta[]>([]);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Fetch stories + viewed status
  const loadStories = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    try {
      const [activeStories, viewed] = await Promise.all([
        fetchActiveStories(),
        fetchViewedStoryIds(user?.id || null),
      ]);

      const storiesWithMeta: StoryWithMeta[] = activeStories.map(s => ({
        ...s,
        is_viewed: viewed.has(s.id),
        is_own: s.user_id === user?.id,
      }));

      setStories(storiesWithMeta);
      setViewedIds(viewed);
    } catch (err) {
      console.warn('[StoriesBar] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadStories();
    // Refresh every 30s
    const interval = setInterval(loadStories, 30000);
    return () => clearInterval(interval);
  }, [loadStories]);

  // Group stories by user (user_id or anon_id)
  const groupedStories = React.useMemo(() => {
    const groups = new Map<string, StoryWithMeta[]>();
    for (const story of stories) {
      const key = story.user_id || story.anon_id || 'unknown';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(story);
    }
    return groups;
  }, [stories]);

  // Sort groups: unviewed first, then by newest story
  const sortedGroups = React.useMemo(() => {
    return Array.from(groupedStories.entries()).sort((a, b) => {
      const aHasUnviewed = a[1].some(s => !s.is_viewed);
      const bHasUnviewed = b[1].some(s => !s.is_viewed);
      if (aHasUnviewed && !bHasUnviewed) return -1;
      if (!aHasUnviewed && bHasUnviewed) return 1;
      // Both same view status — sort by newest story
      const aNewest = new Date(a[1][0].created_at).getTime();
      const bNewest = new Date(b[1][0].created_at).getTime();
      return bNewest - aNewest;
    });
  }, [groupedStories]);

  const handleStoryClick = (groupIndex: number) => {
    const group = sortedGroups[groupIndex];
    if (!group) return;
    const [, groupStories] = group;
    onOpenStory(groupStories, 0);
  };

  // Don't render if no stories and not loading
  if (!loading && stories.length === 0) {
    return (
      <div className="bg-[#111] border border-[#222] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 bg-[#ff4d00] rounded-full animate-pulse" />
          <h2 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
            Stories
          </h2>
        </div>
        <div className="flex items-center gap-4">
          {/* Create Story Button */}
          <button
            onClick={onCreateStory}
            className="flex flex-col items-center gap-1.5 shrink-0"
          >
            <div className="w-16 h-16 rounded-full bg-[#1a1a1a] border-2 border-dashed border-[#333] flex items-center justify-center hover:border-[#ff4d00] hover:bg-[#ff4d00]/10 transition-all">
              <Plus className="w-6 h-6 text-zinc-400" />
            </div>
            <span className="text-[9px] font-mono text-zinc-500">Your Story</span>
          </button>
          {/* Empty state */}
          <div className="text-xs text-zinc-500 font-mono">
            No stories yet — be first to share 🔥
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111] border border-[#222] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 bg-[#ff4d00] rounded-full animate-pulse" />
        <h2 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
          Stories
        </h2>
        {stories.length > 0 && (
          <span className="text-[10px] text-zinc-600 font-mono">({stories.length})</span>
        )}
      </div>

      <div className="flex items-start gap-4 overflow-x-auto pb-1 scrollbar-none">
        {/* Create Story Button (always first) */}
        <button
          onClick={onCreateStory}
          className="flex flex-col items-center gap-1.5 shrink-0 group"
        >
          <div className="w-16 h-16 rounded-full bg-[#1a1a1a] border-2 border-dashed border-[#333] flex items-center justify-center group-hover:border-[#ff4d00] group-hover:bg-[#ff4d00]/10 transition-all">
            <Plus className="w-6 h-6 text-zinc-400 group-hover:text-[#ff4d00] transition-colors" />
          </div>
          <span className="text-[9px] font-mono text-zinc-500">Your Story</span>
        </button>

        {/* Loading skeletons */}
        {loading && (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 animate-pulse">
                <div className="w-16 h-16 rounded-full bg-[#222] border-2 border-[#333]" />
                <div className="w-10 h-1.5 bg-[#222] rounded" />
              </div>
            ))}
          </>
        )}

        {/* Story Groups */}
        {!loading && sortedGroups.map(([userId, groupStories], groupIndex) => {
          const hasUnviewed = groupStories.some(s => !s.is_viewed);
          const isOwn = groupStories.some(s => s.is_own);
          const firstStory = groupStories[0];
          const bgColor = firstStory.background_color || '#ff4500';

          // Generate display name from user info
          const displayName = isOwn
            ? 'You'
            : (firstStory.user_id ? 'User' : `Anon ${groupStories.length}`);

          return (
            <button
              key={userId}
              onClick={() => handleStoryClick(groupIndex)}
              className="flex flex-col items-center gap-1.5 shrink-0 group"
            >
              {/* Ring: orange if unviewed, grey if viewed */}
              <div
                className={`w-[68px] h-[68px] rounded-full p-[3px] transition-all ${
                  hasUnviewed
                    ? 'bg-gradient-to-br from-[#ff4d00] via-amber-500 to-[#ff4d00] shadow-[0_0_12px_rgba(255,77,0,0.3)]'
                    : 'bg-[#333]'
                }`}
              >
                <div className="w-full h-full rounded-full p-[2px] bg-[#111]">
                  <div
                    className="w-full h-full rounded-full flex items-center justify-center text-white font-black text-sm"
                    style={{ background: bgColor }}
                  >
                    {groupStories.length > 1 ? (
                      <span className="text-xs">{groupStories.length}</span>
                    ) : (
                      <Flame className="w-5 h-5 fill-white" />
                    )}
                  </div>
                </div>
              </div>
              <span className="text-[9px] font-mono text-zinc-500 max-w-[60px] truncate">
                {displayName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StoriesBar;
