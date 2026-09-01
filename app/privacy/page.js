'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Scale, Shield, AlertTriangle } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-[#222] pb-4">
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Feed</span>
          </Link>
          <div className="flex items-center gap-2 text-emerald-400 font-mono font-black text-sm">
            <Shield className="w-4 h-4" />
            <span>PRIVACY POLICY</span>
          </div>
        </div>

        <div className="bg-[#111] border border-[#222] rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black font-mono uppercase">Privacy Policy</h1>
              <p className="text-xs text-zinc-400 font-mono">Last updated: August 2025</p>
            </div>
          </div>

          <div className="space-y-6 text-sm text-zinc-300 leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                1. 100% Anonymous — No Data Collection
              </h2>
              <p className="text-zinc-400">
                BURNBOARD is built on the principle of complete anonymity. We do <strong className="text-white">not collect, store, or sell any personal data</strong>.
                No accounts, no sign-ups, no cookies, no tracking pixels.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold text-white">2. What We Store</h2>
              <p className="text-zinc-400">
                The only data stored are the roast texts, target profiles (publicly available social media handles), and upvotes — all tied to randomly generated anonymous IDs.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold text-white">3. Right to Delete</h2>
              <p className="text-zinc-400">
                You can request deletion of any roast or profile at any time. Since all content is anonymous, deletion is permanent and irreversible.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                4. Content Moderation
              </h2>
              <p className="text-zinc-400">
                All roasts go through automated hate speech and slur detection. We have a strict <strong className="text-white">zero-tolerance policy for hate speech</strong>.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold text-white">5. Age Requirement</h2>
              <p className="text-zinc-400">
                BURNBOARD contains mature humor and is intended for users <strong className="text-white">18 years or older</strong>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
