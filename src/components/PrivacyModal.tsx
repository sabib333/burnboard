import React from 'react';
import { Shield, Lock, EyeOff, UserCheck, X } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#222] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#ff4d00]/15 text-[#ff4d00] flex items-center justify-center border border-[#ff4d00]/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                Privacy & Zero PII Policy
              </h3>
              <p className="text-[11px] text-zinc-500 font-mono">100% Anonymous by Design</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-[#1f1f1f]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3.5 text-xs text-zinc-300 leading-relaxed font-sans">
          <div className="p-3 bg-[#0a0a0a] border border-[#222] rounded-xl flex items-start gap-3">
            <EyeOff className="w-5 h-5 text-[#ff4d00] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-white mb-0.5">No Accounts or Personal Data</h4>
              <p className="text-zinc-400">
                BURNBOARD does not require passwords, email addresses, phone numbers, or credit cards. You participate under a pseudorandom alias (e.g. <strong className="text-white">Anonymous #482</strong>).
              </p>
            </div>
          </div>

          <div className="p-3 bg-[#0a0a0a] border border-[#222] rounded-xl flex items-start gap-3">
            <Lock className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-white mb-0.5">Zero Tracking & Fingerprinting</h4>
              <p className="text-zinc-400">
                We do not sell advertising telemetry or track your identity across the web. Client states are stored purely in local storage.
              </p>
            </div>
          </div>

          <div className="p-3 bg-[#0a0a0a] border border-[#222] rounded-xl flex items-start gap-3">
            <UserCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-white mb-0.5">Content Moderation & Deletion Rights</h4>
              <p className="text-zinc-400">
                All burns are filtered through an automated slur/hate speech engine. If your handle is submitted and you wish to have it deleted, use the "Delete my data" tool anytime for immediate removal.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-mono font-black uppercase text-xs rounded-xl tracking-wider transition-colors shadow-lg"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
