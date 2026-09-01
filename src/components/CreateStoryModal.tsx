/**
 * BURNBOARD CreateStoryModal
 *
 * Modal for creating a new story.
 * - Text input (max 200 chars)
 * - Color picker (preset colors)
 * - Live preview
 * - Submit to Supabase
 */

import React, { useState } from 'react';
import { X, Flame, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { createStory } from '../lib/stories';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  onShowToast: (text: string, subtext?: string) => void;
}

const STORY_COLORS = [
  '#ff4500', // Orange (default)
  '#e11d48', // Rose
  '#7c3aed', // Violet
  '#2563eb', // Blue
  '#059669', // Emerald
  '#d97706', // Amber
  '#0891b2', // Cyan
  '#be123c', // Red
];

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  onShowToast,
}) => {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [color, setColor] = useState(STORY_COLORS[0]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (text.trim().length < 2) return;

    setLoading(true);
    try {
      const story = await createStory({
        text: text.trim(),
        backgroundColor: color,
        userId: user?.id || null,
      });

      if (story) {
        onShowToast('Story Published! 🔥', 'Your story is live for 24 hours.');
        setText('');
        setColor(STORY_COLORS[0]);
        onCreated();
        onClose();
      } else {
        onShowToast('Failed to publish', 'Please try again.', 'warning');
      }
    } catch (err) {
      console.warn('[CreateStory] Failed:', err);
      onShowToast('Failed to publish', 'Something went wrong.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-[#222] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#ff4d00]/15 text-[#ff4d00] flex items-center justify-center border border-[#ff4d00]/30">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-tight">
                Create Story
              </h3>
              <p className="text-[10px] text-zinc-500 font-mono">Live for 24 hours</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-[#1f1f1f]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview */}
        <div
          className="rounded-xl p-6 flex items-center justify-center min-h-[120px]"
          style={{ background: color }}
        >
          {text.trim() ? (
            <p className="text-white text-lg font-black text-center leading-relaxed drop-shadow-lg">
              {text}
            </p>
          ) : (
            <p className="text-white/40 text-sm font-mono">Your story text here...</p>
          )}
        </div>

        {/* Text Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              What&apos;s on your mind?
            </label>
            <span className={`text-[10px] font-mono ${text.length > 180 ? 'text-red-400' : 'text-zinc-500'}`}>
              {text.length}/200
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 200))}
            placeholder="Drop a hot take..."
            maxLength={200}
            rows={3}
            className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff4d00] resize-none"
          />
        </div>

        {/* Color Picker */}
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block">
            Background Color
          </label>
          <div className="flex items-center gap-2">
            {STORY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-all ${
                  color === c
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-[#111] scale-110'
                    : 'hover:scale-105'
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || text.trim().length < 2}
          className="w-full py-3 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(255,77,0,0.4)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Flame className="w-4 h-4 fill-black" />
              <span>Publish Story</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CreateStoryModal;
