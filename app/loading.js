'use client';

import React from 'react';
import { Flame, Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4 font-mono space-y-4">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-[#ff4d00]/20 flex items-center justify-center text-[#ff4d00] animate-pulse">
          <Flame className="w-9 h-9 fill-[#ff4d00]" />
        </div>
        <Loader2 className="w-20 h-20 text-[#ff4d00] animate-spin absolute -top-2 -left-2 opacity-50" />
      </div>
      <h2 className="text-base sm:text-lg font-bold tracking-wider uppercase text-zinc-200 animate-pulse">
        Sharpening the knives...
      </h2>
      <p className="text-xs text-zinc-500 font-mono">
        Preparing 100% human-crafted burns 🔥
      </p>
    </div>
  );
}
