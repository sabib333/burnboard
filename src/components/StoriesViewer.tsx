/**
 * BURNBOARD StoriesViewer
 *
 * Fullscreen story viewer with:
 * - Progress bar (auto-advance after 5s)
 * - Tap left/right to navigate
 * - Reactions: 🔥 💀 😂
 * - View count display
 * - Close button
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Flame, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { type StoryWithMeta, recordStoryView } from '../lib/stories';
import { useAuth } from '../lib/auth';

interface StoriesViewerProps {
  stories: StoryWithMeta[];
  startIndex: number;
  onClose: () => void;
}

const STORY_DURATION_MS = 5000; // 5 seconds per story

function timeAgo(dateString: string): string {
  if (!dateString) return '';
  const now = Date.now();
  const past = new Date(dateString).getTime();
  const diff = Math.max(0, Math.floor((now - past) / 1000));
  if (diff < 60) return 'just now';
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export const StoriesViewer: React.FC<StoriesViewerProps> = ({
  stories,
  startIndex,
  onClose,
}) => {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const currentStory = stories[currentIndex];
  const bgColor = currentStory?.background_color || '#ff4500';

  // Record view when story changes
  useEffect(() => {
    if (currentStory && !currentStory.is_viewed) {
      recordStoryView(currentStory.id, user?.id || null);
    }
  }, [currentIndex, currentStory, user?.id]);

  // Auto-advance with progress
  useEffect(() => {
    if (isPaused) return;

    startTimeRef.current = Date.now();
    setProgress(0);

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
      setProgress(pct);

      if (pct >= 100) {
        // Move to next story or close
        if (currentIndex < stories.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          onClose();
        }
      }
    }, 50);

    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [currentIndex, isPaused, stories.length, onClose]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (currentIndex < stories.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          onClose();
        }
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIndex > 0) {
          setCurrentIndex(prev => prev - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, stories.length, onClose]);

  const handleTap = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeft = x < rect.width / 3;
    const isRight = x > (rect.width * 2) / 3;

    if (isLeft && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else if (isRight) {
      if (currentIndex < stories.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        onClose();
      }
    }
  }, [currentIndex, stories.length, onClose]);

  const handleReaction = (emoji: string) => {
    setReaction(emoji);
    setTimeout(() => setReaction(null), 1000);
  };

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-3 pt-4">
        {stories.map((_, idx) => (
          <div key={idx} className="flex-1 h-[2px] bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-75"
              style={{
                width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-6 left-0 right-0 z-10 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black"
            style={{ background: bgColor }}
          >
            <Flame className="w-4 h-4 fill-white" />
          </div>
          <div>
            <span className="text-xs font-bold text-white">
              {currentStory.user_id ? 'User' : `Anon`}
            </span>
            <span className="text-[10px] text-white/50 ml-2">{timeAgo(currentStory.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-white/50">
            <Eye className="w-3 h-3" />
            {currentStory.view_count || 0}
          </span>
          <button
            onClick={onClose}
            className="p-1 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Story Content */}
      <div
        className="w-full h-full flex items-center justify-center p-8 cursor-pointer select-none"
        style={{ background: bgColor }}
        onClick={handleTap}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <p className="text-white text-xl sm:text-2xl md:text-3xl font-black text-center max-w-lg leading-relaxed drop-shadow-lg">
          {currentStory.text}
        </p>
      </div>

      {/* Reaction overlay */}
      {reaction && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <span className="text-7xl animate-bounce">{reaction}</span>
        </div>
      )}

      {/* Navigation arrows (desktop) */}
      {currentIndex > 0 && (
        <button
          onClick={() => setCurrentIndex(prev => prev - 1)}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {currentIndex < stories.length - 1 && (
        <button
          onClick={() => setCurrentIndex(prev => prev + 1)}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Bottom reactions */}
      <div className="absolute bottom-6 left-0 right-0 z-10 flex items-center justify-center gap-4">
        <button
          onClick={() => handleReaction('🔥')}
          className="text-2xl hover:scale-125 transition-transform active:scale-90"
        >
          🔥
        </button>
        <button
          onClick={() => handleReaction('💀')}
          className="text-2xl hover:scale-125 transition-transform active:scale-90"
        >
          💀
        </button>
        <button
          onClick={() => handleReaction('😂')}
          className="text-2xl hover:scale-125 transition-transform active:scale-90"
        >
          😂
        </button>
      </div>
    </div>
  );
};

export default StoriesViewer;
