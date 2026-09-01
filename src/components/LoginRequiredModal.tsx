import React from 'react';
import { Flame, X, ArrowRight, User } from 'lucide-react';

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToAuth: () => void;
  action?: string;
}

export const LoginRequiredModal: React.FC<LoginRequiredModalProps> = ({
  isOpen,
  onClose,
  onGoToAuth,
  action = 'upvote'
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#111] border border-[#262626] rounded-2xl max-w-sm w-full p-6 shadow-2xl relative space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-[#ff4d00]/20 mx-auto flex items-center justify-center">
            <Flame className="w-8 h-8 text-[#ff4d00]" />
          </div>

          <h2 className="text-lg font-black text-white uppercase tracking-tight">
            Login to {action}
          </h2>

          <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
            Create a free account to {action}, earn karma, track your roasts, and build your roast reputation.
          </p>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={onGoToAuth}
            className="w-full py-3 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(255,77,0,0.4)] active:scale-98"
          >
            <User className="w-4 h-4" />
            <span>Create Account / Login</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#1a1a1a] hover:bg-[#222] text-zinc-400 font-mono font-bold text-xs rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>

        <p className="text-center text-[10px] text-zinc-600 font-mono">
          100% free. No spam. No tracking.
        </p>
      </div>
    </div>
  );
};
