import React from 'react';
import { Flame, Star } from 'lucide-react';

interface ProductHuntBadgeProps {
  className?: string;
}

export const ProductHuntBadge: React.FC<ProductHuntBadgeProps> = ({ className = '' }) => {
  return (
    <a
      id="ph-badge-link"
      href="https://www.producthunt.com/posts/burnboard"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2.5 px-3 py-1.5 bg-[#ff4d00]/10 hover:bg-[#ff4d00]/20 border border-[#ff4d00]/40 hover:border-[#ff4d00] rounded-xl transition-all text-xs font-mono text-white group ${className}`}
    >
      <div className="w-5 h-5 rounded-full bg-[#ff4d00] text-black font-black flex items-center justify-center text-[10px]">
        P
      </div>
      <div className="flex flex-col text-left">
        <span className="text-[9px] text-zinc-400 uppercase tracking-widest leading-none">Featured On</span>
        <span className="font-bold text-white group-hover:text-[#ff4d00] transition-colors leading-tight">Product Hunt</span>
      </div>
      <div className="flex items-center gap-1 pl-1 border-l border-[#333] text-[#ff4d00]">
        <Star className="w-3 h-3 fill-[#ff4d00]" />
        <span className="font-bold text-[11px]">#1 Daily</span>
      </div>
    </a>
  );
};
