import React from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';

interface ModerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  foundWords?: string[];
}

export const ModerationModal: React.FC<ModerationModalProps> = ({
  isOpen,
  onClose,
  foundWords = []
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#121212] border border-red-500/40 rounded-2xl max-w-md w-full p-6 shadow-[0_0_50px_rgba(239,68,68,0.25)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                Burn Blocked
              </h3>
              <p className="text-xs text-red-400 font-mono">Content Moderation Triggered</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-[#1f1f1f]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-4 space-y-2">
          <p className="text-sm font-bold text-white leading-relaxed">
            "Keep it brutal but clean - no hate speech"
          </p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            BURNBOARD is for sharp wit, hilarious observations, and brutal reality checks. We have a zero-tolerance policy for slurs, hate speech, and harassment.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-mono font-black uppercase text-xs rounded-xl tracking-wider transition-colors shadow-lg"
        >
          I Understand & Will Reword
        </button>
      </div>
    </div>
  );
};
