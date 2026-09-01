import React from 'react';
import { Flame, ArrowLeft, Shield } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4 font-mono text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 shadow-xl">
        <Shield className="w-8 h-8 text-zinc-400" />
      </div>
      <div className="space-y-1">
        <div className="text-xs text-[#ff4d00] font-bold uppercase tracking-widest">404 Error</div>
        <h1 className="text-2xl font-black text-white tracking-tight uppercase">
          This profile escaped the roast 🏃‍♂️💨
        </h1>
      </div>
      <p className="text-xs text-zinc-400 max-w-sm">
        The target profile or roast you are looking for has been deleted, purged, or was never submitted.
      </p>
      <a
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-mono font-black text-xs rounded-xl shadow transition-all active:scale-95"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Active Feed</span>
      </a>
    </div>
  );
}
