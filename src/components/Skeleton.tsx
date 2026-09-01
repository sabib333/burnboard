import React from 'react';

export const ProfileCardSkeleton: React.FC = () => {
  return (
    <div className="bg-[#111] border border-[#222] rounded-2xl p-5 shadow-xl animate-pulse space-y-4">
      {/* Header Skeleton */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#222]" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-[#262626] rounded" />
            <div className="h-3 w-20 bg-[#1e1e1e] rounded" />
          </div>
        </div>
        <div className="h-6 w-16 bg-[#222] rounded-full" />
      </div>

      {/* Bio line skeleton */}
      <div className="space-y-2 py-1">
        <div className="h-3.5 w-full bg-[#1c1c1c] rounded" />
        <div className="h-3.5 w-3/4 bg-[#1a1a1a] rounded" />
      </div>

      {/* Top Roast quote box skeleton */}
      <div className="p-3.5 rounded-xl bg-[#161616] border border-[#222] space-y-2">
        <div className="h-3 w-24 bg-[#262626] rounded" />
        <div className="h-4 w-full bg-[#222] rounded" />
        <div className="h-4 w-2/3 bg-[#1e1e1e] rounded" />
      </div>

      {/* Footer skeleton */}
      <div className="flex items-center justify-between pt-2 border-t border-[#1e1e1e]">
        <div className="h-4 w-20 bg-[#222] rounded" />
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-[#222] rounded-xl" />
          <div className="h-8 w-8 bg-[#222] rounded-xl" />
        </div>
      </div>
    </div>
  );
};

export const FeedSkeletonList: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProfileCardSkeleton key={i} />
      ))}
    </div>
  );
};
