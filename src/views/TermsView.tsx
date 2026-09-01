import React from 'react';
import { ArrowLeft, FileText, AlertTriangle, Flame, Scale, Shield } from 'lucide-react';

interface TermsViewProps {
  onBack: () => void;
}

export const TermsView: React.FC<TermsViewProps> = ({ onBack }) => {
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
          <div className="w-10 h-10 rounded-2xl bg-[#ff4d00]/20 text-[#ff4d00] flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">Terms of Service</h1>
            <p className="text-xs text-zinc-400 font-mono">Last updated: August 2025</p>
          </div>
        </div>

        <div className="space-y-6 text-sm text-zinc-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#ff4d00]" />
              1. Acceptance of Terms
            </h2>
            <p className="text-zinc-400">
              By accessing or using BURNBOARD, you agree to be bound by these Terms of Service.
              If you do not agree, please do not use this platform. BURNBOARD is provided "as is" without warranty of any kind.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              2. Acceptable Use — The Roast Code
            </h2>
            <p className="text-zinc-400">
              BURNBOARD is a comedy platform for roasting publicly available social media personas.
              You agree to:
            </p>
            <ul className="list-disc list-inside text-zinc-400 space-y-1 ml-4">
              <li>Write roasts that are <strong className="text-white">funny, witty, and creative</strong></li>
              <li><strong className="text-red-400">NOT</strong> post hate speech, slurs, threats, or content targeting protected characteristics</li>
              <li><strong className="text-red-400">NOT</strong> doxx anyone or share private/personal information</li>
              <li><strong className="text-red-400">NOT</strong> spam, bot, or use automated scripts</li>
              <li>Be at least <strong className="text-white">18 years old</strong> to use this platform</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#ff4d00]" />
              3. Content Ownership
            </h2>
            <p className="text-zinc-400">
              All roasts you submit are released into the public domain as anonymous content. Since all content is anonymous,
              there is no claim of authorship. BURNBOARD reserves the right to remove any content that violates these terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">4. No Warranty</h2>
            <p className="text-zinc-400">
              BURNBOARD is provided "as is" and "as available" without warranties of any kind, either express or implied.
              We do not warrant that the service will be uninterrupted, error-free, or free of harmful components.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">5. Limitation of Liability</h2>
            <p className="text-zinc-400">
              In no event shall BURNBOARD, its creators, or affiliates be liable for any indirect, incidental, special,
              consequential, or punitive damages resulting from your use of or inability to use the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">6. Termination</h2>
            <p className="text-zinc-400">
              We reserve the right to terminate or restrict access to any user who violates these terms,
              at our sole discretion, without prior notice.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">7. Changes to Terms</h2>
            <p className="text-zinc-400">
              We may update these terms at any time. Continued use of BURNBOARD after changes constitutes acceptance
              of the new terms.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
