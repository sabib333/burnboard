import React from 'react';

export function ProfileCardSkeleton() {
  return (
    <div className="bg-[#111] border border-[#222] rounded-2xl p-5 space-y-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#222]" />
          <div className="space-y-2">
            <div className="w-32 h-4 bg-[#222] rounded" />
            <div className="w-20 h-3 bg-[#1a1a1a] rounded" />
          </div>
        </div>
        <div className="w-16 h-6 bg-[#222] rounded-lg" />
      </div>
      <div className="space-y-1.5 pt-1">
        <div className="w-full h-3 bg-[#1e1e1e] rounded" />
        <div className="w-4/5 h-3 bg-[#1e1e1e] rounded" />
      </div>
    </div>
  );
}

export function RoastItemSkeleton() {
  return (
    <div className="p-4 bg-[#111] border border-[#222] rounded-2xl space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="w-24 h-4 bg-[#222] rounded" />
        <div className="w-16 h-3 bg-[#1a1a1a] rounded" />
      </div>
      <div className="w-full h-4 bg-[#1e1e1e] rounded" />
      <div className="w-2/3 h-4 bg-[#1e1e1e] rounded" />
    </div>
  );
}
