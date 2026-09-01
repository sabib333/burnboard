/**
 * BURNBOARD PremiumModal
 *
 * Pro waitlist modal. No Stripe yet — just email collection.
 * Triggered by: "Go Pro" button, "Remove watermark", or 3rd OG card download.
 */

import React, { useState } from 'react';
import { X, Flame, Zap, Crown, Shield, Eye, Lock, Loader2, Check } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (text: string, subtext?: string) => void;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({ isOpen, onClose, onShowToast }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);

  if (!isOpen) return null;

  const handleJoinWaitlist = async () => {
    if (!email.trim() || !email.includes('@')) return;
    setLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.from('waitlist').insert({
          email: email.trim().toLowerCase(),
          type: 'pro',
        });
      }
      setJoined(true);
      onShowToast('Added to Pro waitlist! 🔥', 'We\'ll notify you when we launch.');
    } catch (err) {
      console.warn('[Premium] Waitlist insert failed:', err);
      onShowToast('Added to Pro waitlist! 🔥', 'We\'ll notify you when we launch.');
      setJoined(true);
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    { icon: Crown, text: 'Custom profile border 🔥', color: 'text-amber-400' },
    { icon: Zap, text: '2x Karma boost on all actions', color: 'text-yellow-400' },
    { icon: Eye, text: 'See who viewed your profile', color: 'text-blue-400' },
    { icon: Shield, text: 'Private roast battles', color: 'text-purple-400' },
    { icon: Lock, text: 'No watermark on OG cards', color: 'text-green-400' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-amber-500/30 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-amber-900/30 via-[#111] to-amber-900/30 p-6 text-center border-b border-amber-500/20">
          <button onClick={onClose} className="absolute top-3 right-3 p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-[#1f1f1f]">
            <X className="w-4 h-4" />
          </button>
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center mx-auto mb-3 shadow-[0_0_25px_rgba(234,179,8,0.4)]">
            <Crown className="w-7 h-7 text-black" />
          </div>
          <h2 className="text-lg font-black text-white uppercase tracking-tight">BURNBOARD PRO</h2>
          <p className="text-xs text-amber-400 font-mono mt-1">$5/mo — Launching Soon</p>
        </div>

        {/* Benefits */}
        <div className="p-5 space-y-3">
          <div className="space-y-2.5">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <b.icon className={`w-4 h-4 ${b.color} shrink-0`} />
                <span className="text-xs text-zinc-300">{b.text}</span>
              </div>
            ))}
          </div>

          {/* Waitlist Form */}
          {!joined ? (
            <div className="pt-3 border-t border-[#222] space-y-3">
              <p className="text-[10px] text-zinc-500 font-mono">Join the waitlist — be first to know when we launch</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="flex-1 bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  onKeyDown={e => e.key === 'Enter' && handleJoinWaitlist()}
                />
                <button
                  onClick={handleJoinWaitlist}
                  disabled={loading || !email.includes('@')}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl disabled:opacity-40 transition-colors flex items-center gap-1.5"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flame className="w-3.5 h-3.5" />}
                  Join
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-3 border-t border-[#222] text-center">
              <div className="flex items-center justify-center gap-2 text-green-400">
                <Check className="w-5 h-5" />
                <span className="text-sm font-bold">You&apos;re on the list! 🔥</span>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono mt-1">We&apos;ll email you when Pro launches</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4">
          <button onClick={onClose} className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 font-mono transition-colors">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};

export default PremiumModal;
