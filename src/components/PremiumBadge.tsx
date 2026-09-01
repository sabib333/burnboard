/**
 * BURNBOARD Premium Badge — Monetization Teaser
 *
 * Shows "PRO" badge on features that will be premium.
 * Collects waitlist emails for early access.
 */

import React, { useState } from 'react';
import { Crown, X, Mail, Check, Sparkles } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface PremiumBadgeProps {
  feature?: string;
  className?: string;
}

export const PremiumBadge: React.FC<PremiumBadgeProps> = ({
  feature = 'Premium',
  className = '',
}) => {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;

    setSubmitting(true);
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.from('waitlist').insert({
          email: email.toLowerCase().trim(),
          feature,
        });
      }
      setSubmitted(true);
    } catch (err) {
      // Still show success — don't block UX
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${className}`}
      >
        <Crown className="w-3 h-3" />
        <span>PRO</span>
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-[#111] border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-[#1a1a1a]"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center mx-auto">
                <Crown className="w-7 h-7 text-black" />
              </div>

              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider">
                  BURNBOARD PRO
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Coming Soon — $5/month
                </p>
              </div>

              <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Remove all watermarks & ads</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Custom roast cards with your branding</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Priority in feed algorithm (+50 score)</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Advanced analytics dashboard</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Early access to new features</span>
                </div>
              </div>

              {!submitted ? (
                <form onSubmit={handleWaitlist} className="space-y-2">
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Join the waitlist — get 50% off launch week
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      className="flex-1 bg-[#0a0a0a] border border-[#333] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl transition-all disabled:opacity-50"
                    >
                      {submitting ? '...' : 'Join'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-mono font-bold">
                  <Check className="w-4 h-4" />
                  <span>You're on the list! We'll email you at launch.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
