'use client';

import React from 'react';
import { Flame, AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({ error, reset }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4 font-mono text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-xl">
        <Flame className="w-8 h-8 fill-red-500" />
      </div>
      <h2 className="text-xl font-bold text-white tracking-tight uppercase">
        This roast was too brutal, try again 🔥
      </h2>
      <p className="text-xs text-zinc-400 max-w-sm">
        {error?.message || 'A catastrophic flame error occurred on the server.'}
      </p>
      <button
        onClick={() => reset ? reset() : window.location.reload()}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-mono font-black text-xs rounded-xl shadow transition-all active:scale-95"
      >
        <RefreshCw className="w-4 h-4" />
        <span>Extinguish & Reload</span>
      </button>
    </div>
  );
}
