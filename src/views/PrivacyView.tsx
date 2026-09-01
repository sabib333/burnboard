import React from 'react';
import { ArrowLeft, Shield, Lock, Eye, Trash2, AlertTriangle, Flame } from 'lucide-react';

interface PrivacyViewProps {
  onBack: () => void;
}

export const PrivacyView: React.FC<PrivacyViewProps> = ({ onBack }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#141414] hover:bg-[#1f1f1f] text-zinc-300 hover:text-white rounded-xl border border-[#262626] text-xs font-mono font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed</span>
        </button>
      </div>

      <div className="bg-gradient-to-b from-[#141414] to-[#111] border border-[#262626] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">Privacy Policy</h1>
            <p className="text-xs text-zinc-400 font-mono">Last updated: August 2025</p>
          </div>
        </div>

        <div className="space-y-6 text-sm text-zinc-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              1. 100% Anonymous — No Data Collection
            </h2>
            <p className="text-zinc-400">
              BURNBOARD is built on the principle of complete anonymity. We do <strong className="text-white">not collect, store, or sell any personal data</strong>.
              No accounts, no sign-ups, no cookies, no tracking pixels.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              2. What We Store
            </h2>
            <p className="text-zinc-400">
              The only data stored are the roast texts, target profiles (publicly available social media handles), and upvotes — all tied to randomly generated anonymous IDs
              (e.g., "Anonymous #482"). These IDs are assigned randomly and cannot be traced back to any individual.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-emerald-400" />
              3. Right to Delete
            </h2>
            <p className="text-zinc-400">
              You can request deletion of any roast or profile at any time through the admin panel or by contacting us.
              Since all content is anonymous, deletion is permanent and irreversible.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              4. Content Moderation
            </h2>
            <p className="text-zinc-400">
              All roasts go through automated hate speech and slur detection. Content containing slurs, threats, or doxxing is automatically blocked.
              Our human moderation team reviews reported content promptly. We have a strict <strong className="text-white">zero-tolerance policy for hate speech</strong>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              5. No AI — 100% Human Content
            </h2>
            <p className="text-zinc-400">
              All roasts on BURNBOARD are written by real humans. We do not use AI to generate, modify, or curate any content.
              The roast inspiration templates are human-written starting points only.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">6. Age Requirement</h2>
            <p className="text-zinc-400">
              BURNBOARD contains mature humor and is intended for users <strong className="text-white">18 years or older</strong>.
              By using this platform, you confirm you are at least 18 years of age.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">7. Third-Party Services</h2>
            <p className="text-zinc-400">
              We use Vercel for hosting and Supabase for database services. Both services operate under their own privacy policies.
              We do not share any data with third parties for advertising or marketing purposes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">8. Contact</h2>
            <p className="text-zinc-400">
              For privacy concerns, contact us via the footer links. We respond within 48 hours.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
