'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Scale, Shield, AlertTriangle } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-[#222] pb-4">
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Feed</span>
          </Link>
          <div className="flex items-center gap-2 text-[#ff4d00] font-mono font-black text-sm">
            <FileText className="w-4 h-4" />
            <span>TERMS OF SERVICE</span>
          </div>
        </div>

        <div className="bg-[#111] border border-[#222] rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#ff4d00]/20 text-[#ff4d00] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black font-mono uppercase">Terms of Service</h1>
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
                If you do not agree, please do not use this platform.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                2. The Roast Code
              </h2>
              <p className="text-zinc-400">
                You agree to write roasts that are funny and creative. You agree NOT to post hate speech, slurs, threats, doxxing, or spam.
                You must be at least 18 years old.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold text-white">3. No Warranty</h2>
              <p className="text-zinc-400">
                BURNBOARD is provided "as is" without warranties of any kind. We do not warrant that the service will be uninterrupted or error-free.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold text-white">4. Limitation of Liability</h2>
              <p className="text-zinc-400">
                In no event shall BURNBOARD be liable for any indirect, incidental, special, consequential, or punitive damages.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
